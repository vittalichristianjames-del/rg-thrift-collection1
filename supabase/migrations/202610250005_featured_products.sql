alter table public.products
  add column if not exists is_featured boolean not null default false;

update public.products
set is_featured = true
where id in ('p1', 'p2', 'p3', 'p4', 'p5', 'p6')
  and is_active = true
  and stock > 0;
