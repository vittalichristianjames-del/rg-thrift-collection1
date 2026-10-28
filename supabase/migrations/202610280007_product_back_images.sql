alter table public.products
  add column if not exists back_image text not null default '';
