create or replace function public.is_product_available(p_product_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.is_active
      and p.stock > 0
  );
$$;

delete from public.reservations;

revoke all on function public.reserve_product(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.release_reservation(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on table public.reservations from anon, authenticated, service_role;

create or replace function public.create_order(
  p_customer jsonb,
  p_payment_method text,
  p_destination text,
  p_reference text,
  p_receipt_path text,
  p_product_ids text[],
  p_reservation_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id text;
  v_product public.products%rowtype;
  v_shipping numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_order_id uuid;
  v_order_number text;
  v_status text;
  v_count integer;
  v_product_ids text[];
begin
  if coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception 'Your bag is empty';
  end if;

  select count(distinct item_id) into v_count
  from unnest(p_product_ids) as requested_items(item_id);
  if v_count <> cardinality(p_product_ids) then
    raise exception 'An item can only be ordered once';
  end if;

  if coalesce(trim(p_customer->>'name'), '') = ''
     or coalesce(trim(p_customer->>'email'), '') = ''
     or coalesce(trim(p_customer->>'phone'), '') = ''
     or coalesce(trim(p_customer->>'address'), '') = '' then
    raise exception 'Complete all required delivery details';
  end if;

  if p_destination not in ('metro', 'luzon', 'vismin') then
    raise exception 'Choose a valid shipping destination';
  end if;

  if p_payment_method not in ('COD', 'GCash') then
    raise exception 'Choose a valid payment method';
  end if;

  if p_payment_method = 'GCash'
     and (coalesce(trim(p_reference), '') = ''
          or p_receipt_path is null
          or p_reservation_token is null
          or split_part(p_receipt_path, '/', 1) <> p_reservation_token::text
          or not exists (
            select 1 from storage.objects o
            where o.bucket_id = 'gcash-receipts'
              and o.name = p_receipt_path
          )) then
    raise exception 'GCash requires a reference number and uploaded receipt';
  end if;

  v_shipping := case p_destination
    when 'metro' then 80
    when 'luzon' then 130
    else 180
  end;
  v_status := case p_payment_method
    when 'COD' then 'Pending COD'
    else 'Payment review'
  end;
  select array_agg(item_id order by item_id)
  into v_product_ids
  from unnest(p_product_ids) as requested_items(item_id);

  foreach v_product_id in array v_product_ids loop
    select p.* into v_product
    from public.products p
    where p.id = v_product_id
    for update;

    if not found or not v_product.is_active or v_product.stock < 1 then
      raise exception 'An item in your bag is no longer available';
    end if;

    v_subtotal := v_subtotal + v_product.price;
  end loop;

  v_order_id := gen_random_uuid();
  v_order_number := 'RW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  insert into public.orders (
    id, order_number, customer_name, customer_email, customer_phone,
    shipping_address, destination, shipping_fee, subtotal, total,
    payment_method, payment_reference, receipt_path, status
  )
  values (
    v_order_id, v_order_number,
    trim(p_customer->>'name'), lower(trim(p_customer->>'email')),
    trim(p_customer->>'phone'), trim(p_customer->>'address'),
    p_destination, v_shipping, v_subtotal, v_subtotal + v_shipping,
    p_payment_method, nullif(trim(p_reference), ''), p_receipt_path, v_status
  );

  foreach v_product_id in array v_product_ids loop
    select p.* into v_product
    from public.products p
    where p.id = v_product_id
    for update;

    insert into public.order_items (order_id, product_id, title, unit_price)
    values (v_order_id, v_product.id, v_product.title, v_product.price);

    update public.products
    set stock = stock - 1, updated_at = now()
    where id = v_product_id;
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'status', v_status,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'total', v_subtotal + v_shipping
  );
end;
$$;

revoke all on function public.create_order(jsonb, text, text, text, text, text[], uuid)
  from public;
grant execute on function public.create_order(jsonb, text, text, text, text, text[], uuid)
  to service_role;
