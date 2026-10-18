-- WearWise shop catalog. Keep this separate from `products`, which currently
-- describes shirt types used by custom-design requests.

create table if not exists public.store_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null check (char_length(trim(category)) between 1 and 40),
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  currency_code text not null default 'GHS' check (currency_code = 'GHS'),
  image_paths text[] not null default '{}',
  is_available boolean not null default true,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_items_public_listing_idx
  on public.store_items (category, created_at desc)
  where is_published = true and is_available = true;

-- Purchase cost stays separate from the public catalog so customers can never
-- read the business's cost or calculate its margin.
create table if not exists public.store_item_costs (
  store_item_id uuid primary key references public.store_items(id) on delete cascade,
  purchase_cost numeric(12, 2) not null default 0 check (purchase_cost >= 0),
  other_cost numeric(12, 2) not null default 0 check (other_cost >= 0),
  updated_at timestamptz not null default now()
);

-- Link future ready-to-buy orders to catalog items while preserving the
-- existing snapshot fields used for custom-design orders.
alter table public.order_items
  add column if not exists store_item_id uuid
  references public.store_items(id) on delete set null;

create index if not exists order_items_store_item_id_idx
  on public.order_items (store_item_id);

alter table public.store_items enable row level security;
alter table public.store_item_costs enable row level security;

drop policy if exists wearwise_public_store_items on public.store_items;
create policy wearwise_public_store_items
  on public.store_items for select to anon, authenticated
  using (is_published = true and is_available = true);

drop policy if exists wearwise_owner_store_items on public.store_items;
create policy wearwise_owner_store_items
  on public.store_items for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

drop policy if exists wearwise_owner_store_item_costs on public.store_item_costs;
create policy wearwise_owner_store_item_costs
  on public.store_item_costs for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

revoke all on public.store_items, public.store_item_costs from public, anon, authenticated;
grant select on public.store_items to anon, authenticated;
grant insert, update, delete on public.store_items to authenticated;
grant select, insert, update, delete on public.store_item_costs to authenticated;
