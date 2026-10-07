-- Boutique Gravity Basketball — déjà appliqué sur le projet Supabase
-- aevoulzotvmnrnclfuek le 7 octobre 2026 (migration create_shop_products).
-- Gardé ici pour référence seulement : ne pas réexécuter.
create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'gravity-basketball',
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  image_url text,
  tag text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.shop_products enable row level security;
create policy shop_products_admin_all on public.shop_products for all to authenticated
  using (exists (select 1 from admin_users au where au.id = auth.uid() and shop_products.site = any (au.sites)))
  with check (exists (select 1 from admin_users au where au.id = auth.uid() and shop_products.site = any (au.sites)));
create policy shop_products_public_select on public.shop_products for select to anon
  using (active = true);
