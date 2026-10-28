alter table public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_id_placed_at_idx
  on public.orders (customer_id, placed_at desc);

create or replace function public.create_order(
  p_customer jsonb,
  p_payment_method text,
  p_destination text,
  p_reference text,
  p_receipt_path text,
  p_product_ids text[],
  p_reservation_token uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order jsonb;
begin
  v_order := public.create_order(
    p_customer,
    p_payment_method,
    p_destination,
    p_reference,
    p_receipt_path,
    p_product_ids,
    p_reservation_token
  );

  if p_customer_id is not null then
    update public.orders
    set customer_id = p_customer_id
    where id = (v_order->>'id')::uuid;
  end if;

  return v_order;
end;
$$;

revoke all on function public.create_order(jsonb, text, text, text, text, text[], uuid, uuid) from public;
grant execute on function public.create_order(jsonb, text, text, text, text, text[], uuid, uuid) to service_role;
