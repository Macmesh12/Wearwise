-- Shirt types available for custom-design requests. This is separate from
-- `store_items`, which powers the ready-to-buy shop catalogue.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null check (char_length(trim(category)) between 1 and 40),
  usual_sizes text[] not null default '{}',
  usual_colors text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- Customers (anon) can see the active shirt types they can request from.
drop policy if exists wearwise_public_products on public.products;
create policy wearwise_public_products
  on public.products for select to anon, authenticated
  using (is_active = true);

-- Only the WearWise store owner can add / edit / remove shirt types.
drop policy if exists wearwise_owner_products on public.products;
create policy wearwise_owner_products
  on public.products for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
