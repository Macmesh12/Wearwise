-- Additive admin support for catalog categories, discount management, and safe
-- customer-facing store settings. Existing tables and policies are untouched.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image_url text,
  status text not null default 'active' check (status in ('active', 'hidden', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_status_name_idx
  on public.categories (status, name);

alter table public.categories enable row level security;
drop policy if exists wearwise_public_active_categories on public.categories;
create policy wearwise_public_active_categories
  on public.categories for select to anon, authenticated
  using (status = 'active');
drop policy if exists wearwise_owner_manage_categories on public.categories;
create policy wearwise_owner_manage_categories
  on public.categories for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.categories from public, anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(trim(code)) and char_length(code) between 3 and 40),
  type text not null check (type in ('percentage', 'fixed')),
  value numeric(12, 2) not null check (value > 0),
  max_cap numeric(12, 2) check (max_cap is null or max_cap >= 0),
  start_date timestamptz,
  end_date timestamptz,
  total_limit integer check (total_limit is null or total_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  min_order_amount numeric(12, 2) not null default 0 check (min_order_amount >= 0),
  applies_to text not null default 'shop' check (applies_to in ('shop', 'explore', 'both')),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'archived')),
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'percentage' or value <= 100),
  check (end_date is null or start_date is null or end_date > start_date)
);

create index if not exists discounts_status_period_idx
  on public.discounts (status, start_date, end_date);

alter table public.discounts enable row level security;
drop policy if exists wearwise_owner_manage_discounts on public.discounts;
create policy wearwise_owner_manage_discounts
  on public.discounts for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.discounts from public, anon, authenticated;
grant select, insert, update, delete on public.discounts to authenticated;

create table if not exists public.store_settings (
  singleton boolean primary key default true check (singleton),
  store_name text not null default 'WearWise',
  whatsapp_number text not null default '',
  delivery_min_days smallint not null default 1 check (delivery_min_days >= 0),
  delivery_max_days smallint not null default 2 check (delivery_max_days >= delivery_min_days),
  urgent_fee_per_day_percent numeric(5, 2) not null default 20 check (urgent_fee_per_day_percent >= 0),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.store_settings enable row level security;
drop policy if exists wearwise_public_store_settings on public.store_settings;
create policy wearwise_public_store_settings
  on public.store_settings for select to anon, authenticated
  using (singleton);
drop policy if exists wearwise_owner_manage_store_settings on public.store_settings;
create policy wearwise_owner_manage_store_settings
  on public.store_settings for update to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.store_settings from public, anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
