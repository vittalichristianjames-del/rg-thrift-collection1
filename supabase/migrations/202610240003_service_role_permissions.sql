grant usage on schema public to service_role;

grant select on public.products to service_role;
grant insert, update, delete on public.products to service_role;
grant select on public.store_admins to service_role;
grant select on public.reservations to service_role;
grant select on public.orders to service_role;
grant select on public.order_items to service_role;
