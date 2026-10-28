create extension if not exists pgcrypto;

create table public.products (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  category text not null,
  price numeric(10, 2) not null check (price > 0),
  size text not null,
  condition text not null,
  tag text not null default 'JUST FOUND',
  image text not null,
  description text not null default '',
  measurements jsonb not null default '{}'::jsonb,
  stock integer not null default 1 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.reservations (
  product_id text primary key references public.products(id) on delete cascade,
  reservation_token uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index reservations_expiry_idx on public.reservations (expires_at);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_address text not null,
  destination text not null check (destination in ('metro', 'luzon', 'vismin')),
  shipping_fee numeric(10, 2) not null check (shipping_fee >= 0),
  subtotal numeric(10, 2) not null check (subtotal > 0),
  total numeric(10, 2) not null check (total > 0),
  payment_method text not null check (payment_method in ('COD', 'GCash')),
  payment_reference text,
  receipt_path text,
  status text not null check (status in (
    'Payment review', 'Pending COD', 'Paid', 'Processing', 'Shipped',
    'Delivered', 'Cancelled', 'Rejected'
  )),
  courier text not null default '',
  tracking_number text not null default '',
  estimated_delivery text not null default '',
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_placed_at_idx on public.orders (placed_at desc);
create index orders_email_number_idx on public.orders (lower(customer_email), order_number);

create table public.order_items (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  title text not null,
  unit_price numeric(10, 2) not null check (unit_price > 0),
  quantity integer not null default 1 check (quantity > 0),
  primary key (order_id, product_id)
);

alter table public.products enable row level security;
alter table public.store_admins enable row level security;
alter table public.reservations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant usage on schema public to anon, authenticated;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_admins
    where user_id = (select auth.uid())
  );
$$;

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
      and not exists (
        select 1
        from public.reservations r
        where r.product_id = p.id
          and r.expires_at > now()
      )
  );
$$;

revoke all on function public.is_store_admin() from public, anon, authenticated;
revoke all on function public.is_product_available(text) from public, anon, authenticated;
grant execute on function public.is_store_admin() to anon, authenticated;
grant execute on function public.is_product_available(text) to anon, authenticated;

create policy "Public can view available products"
on public.products for select to anon, authenticated
using (is_active and (public.is_product_available(id) or public.is_store_admin()));

create policy "Admins can insert products"
on public.products for insert to authenticated
with check (public.is_store_admin());

create policy "Admins can update products"
on public.products for update to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "Admins can delete products"
on public.products for delete to authenticated
using (public.is_store_admin() and public.is_product_available(id));

create policy "Admins can view orders"
on public.orders for select to authenticated
using (public.is_store_admin());

create policy "Admins can view order items"
on public.order_items for select to authenticated
using (public.is_store_admin());

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
revoke all on public.store_admins, public.reservations from anon, authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;

create or replace function public.reserve_product(
  p_product_id text,
  p_reservation_token uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
  v_expires_at timestamptz;
begin
  if p_reservation_token is null then
    raise exception 'A reservation token is required';
  end if;

  select p.stock into v_stock
  from public.products p
  where p.id = p_product_id
  for update;

  if not found or v_stock < 1 then
    raise exception 'This item is no longer available';
  end if;

  delete from public.reservations
  where product_id = p_product_id
    and expires_at <= now();

  if exists (
    select 1 from public.reservations r
    where r.product_id = p_product_id
      and r.reservation_token <> p_reservation_token
      and r.expires_at > now()
  ) then
    raise exception 'This item is already reserved';
  end if;

  v_expires_at := now() + interval '10 minutes';
  insert into public.reservations (product_id, reservation_token, expires_at)
  values (p_product_id, p_reservation_token, v_expires_at)
  on conflict (product_id) do update
    set reservation_token = excluded.reservation_token,
        expires_at = excluded.expires_at,
        created_at = now()
    where public.reservations.reservation_token = excluded.reservation_token
       or public.reservations.expires_at <= now();

  if not found then
    raise exception 'This item is already reserved';
  end if;

  return v_expires_at;
end;
$$;

create or replace function public.release_reservation(
  p_product_id text,
  p_reservation_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.reservations
  where product_id = p_product_id
    and reservation_token = p_reservation_token;
end;
$$;

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
  if p_reservation_token is null
     or coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception 'Your bag is empty or the reservation expired';
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

    if not exists (
      select 1 from public.reservations r
      where r.product_id = v_product_id
        and r.reservation_token = p_reservation_token
        and r.expires_at > now()
    ) then
      raise exception 'Your reservation expired; please reserve the item again';
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

    delete from public.reservations
    where product_id = v_product_id
      and reservation_token = p_reservation_token;
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

create or replace function public.lookup_order(
  p_order_number text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
begin
  select o.* into v_order
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and lower(o.customer_email) = lower(trim(p_email));

  if not found then
    raise exception 'No order matches that order number and email';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'title', oi.title,
    'price', oi.unit_price,
    'quantity', oi.quantity
  )), '[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'id', v_order.order_number,
    'status', v_order.status,
    'payment', v_order.payment_method,
    'total', v_order.total,
    'placedAt', v_order.placed_at,
    'tracking', v_order.tracking_number,
    'courier', v_order.courier,
    'eta', v_order.estimated_delivery,
    'products', v_items
  );
end;
$$;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status text default null,
  p_courier text default null,
  p_tracking_number text default null,
  p_estimated_delivery text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_status text;
  v_next_status text;
begin
  if p_status is not null and p_status not in (
    'Payment review', 'Pending COD', 'Paid', 'Processing',
    'Shipped', 'Delivered', 'Cancelled', 'Rejected'
  ) then
    raise exception 'Invalid order status';
  end if;

  select o.status into v_previous_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  v_next_status := coalesce(p_status, v_previous_status);
  if v_next_status in ('Cancelled', 'Rejected')
     and v_previous_status not in ('Cancelled', 'Rejected') then
    update public.products p
    set stock = p.stock + oi.quantity, updated_at = now()
    from public.order_items oi
    where oi.order_id = p_order_id and p.id = oi.product_id;
  elsif v_previous_status in ('Cancelled', 'Rejected')
     and v_next_status not in ('Cancelled', 'Rejected') then
    if exists (
      select 1
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = p_order_id and p.stock < oi.quantity
    ) then
      raise exception 'A cancelled item has already been sold';
    end if;
    update public.products p
    set stock = p.stock - oi.quantity, updated_at = now()
    from public.order_items oi
    where oi.order_id = p_order_id and p.id = oi.product_id;
  end if;

  update public.orders
  set status = v_next_status,
      courier = coalesce(p_courier, courier),
      tracking_number = coalesce(p_tracking_number, tracking_number),
      estimated_delivery = coalesce(p_estimated_delivery, estimated_delivery),
      updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.reserve_product(text, uuid) from public;
revoke all on function public.release_reservation(text, uuid) from public;
revoke all on function public.create_order(jsonb, text, text, text, text, text[], uuid) from public;
revoke all on function public.lookup_order(text, text) from public;
revoke all on function public.admin_update_order(uuid, text, text, text, text) from public;
grant execute on function public.reserve_product(text, uuid) to service_role;
grant execute on function public.release_reservation(text, uuid) to service_role;
grant execute on function public.create_order(jsonb, text, text, text, text, text[], uuid) to service_role;
grant execute on function public.lookup_order(text, text) to service_role;
grant execute on function public.admin_update_order(uuid, text, text, text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gcash-receipts', 'gcash-receipts', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
