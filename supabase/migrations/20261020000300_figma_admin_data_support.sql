-- Data structures used by the original Figma admin screens. Existing tables,
-- checkout routines and policies are not removed or replaced.

alter table public.store_items
  add column if not exists category_id uuid references public.categories(id) on delete set null;
update public.store_items p set category_id = c.id
from public.categories c
where p.category_id is null and lower(trim(p.category)) = lower(trim(c.name));
create index if not exists store_items_category_id_idx on public.store_items(category_id);

alter table public.orders
  add column if not exists payment_link text,
  add column if not exists payment_link_expiry timestamptz,
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','revision_requested','rejected')),
  add column if not exists discount_id uuid references public.discounts(id) on delete set null,
  add column if not exists cost_price_locked numeric(12,2) check (cost_price_locked is null or cost_price_locked >= 0),
  add column if not exists cost_locked_at timestamptz,
  add column if not exists supplier_cost numeric(12,2) check (supplier_cost is null or supplier_cost >= 0),
  add column if not exists profit numeric(12,2),
  add column if not exists delivery_fee_override_reason text;

create table if not exists public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  area text not null,
  fee numeric(12,2) not null default 0 check (fee >= 0),
  free_delivery boolean not null default false,
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region, area)
);
alter table public.delivery_areas enable row level security;
drop policy if exists wearwise_public_delivery_areas on public.delivery_areas;
create policy wearwise_public_delivery_areas on public.delivery_areas for select to anon, authenticated using (status = 'active');
drop policy if exists wearwise_owner_manage_delivery_areas on public.delivery_areas;
create policy wearwise_owner_manage_delivery_areas on public.delivery_areas for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.delivery_areas from public, anon, authenticated;
grant select on public.delivery_areas to anon, authenticated;
grant insert, update, delete on public.delivery_areas to authenticated;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_items(id) on delete cascade,
  size text not null default '',
  color text not null default '',
  stock integer not null default 0 check (stock >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index if not exists product_variants_product_idx on public.product_variants(product_id);
alter table public.product_variants enable row level security;
drop policy if exists wearwise_public_product_variants on public.product_variants;
create policy wearwise_public_product_variants on public.product_variants for select to anon, authenticated
  using (status = 'active' and exists (select 1 from public.store_items p where p.id = product_id and p.is_published and p.is_available));
drop policy if exists wearwise_owner_manage_product_variants on public.product_variants;
create policy wearwise_owner_manage_product_variants on public.product_variants for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.product_variants from public, anon, authenticated;
grant select (id, product_id, size, color, stock, selling_price, status, created_at, updated_at) on public.product_variants to anon;
grant select on public.product_variants to authenticated;
grant insert, update, delete on public.product_variants to authenticated;

create table if not exists public.product_variant_costs (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  cost_price numeric(12,2) check (cost_price is null or cost_price >= 0),
  updated_at timestamptz not null default now()
);
alter table public.product_variant_costs enable row level security;
drop policy if exists wearwise_owner_manage_product_variant_costs on public.product_variant_costs;
create policy wearwise_owner_manage_product_variant_costs on public.product_variant_costs for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.product_variant_costs from public, anon, authenticated;
grant select, insert, update, delete on public.product_variant_costs to authenticated;

create table if not exists public.admin_preferences (
  singleton boolean primary key default true check (singleton),
  owner_name text not null default '',
  owner_phone text not null default '',
  quote_whatsapp_template text not null default 'Hi {{name}}, your WEARWISE quote {{code}} is ready. Total: GHS {{total}}.',
  dispatched_whatsapp_template text not null default 'Your order {{code}} is on the way. Track it here: {{link}}',
  notify_paid_orders boolean not null default true,
  notify_design_requests boolean not null default true,
  notify_low_stock boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.admin_preferences(singleton) values (true) on conflict (singleton) do nothing;
alter table public.admin_preferences enable row level security;
drop policy if exists wearwise_owner_manage_admin_preferences on public.admin_preferences;
create policy wearwise_owner_manage_admin_preferences on public.admin_preferences for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.admin_preferences from public, anon, authenticated;
grant select, insert, update on public.admin_preferences to authenticated;

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  customer_phone text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  redeemed_at timestamptz not null default now()
);
create index if not exists discount_redemptions_customer_idx on public.discount_redemptions(discount_id, customer_phone);
alter table public.discount_redemptions enable row level security;
drop policy if exists wearwise_owner_read_discount_redemptions on public.discount_redemptions;
create policy wearwise_owner_read_discount_redemptions on public.discount_redemptions for select to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.discount_redemptions from public, anon, authenticated;
grant select on public.discount_redemptions to authenticated;

create or replace function public.record_paid_order_discount_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid')
     and new.discount_id is not null then
    insert into public.discount_redemptions(discount_id, order_id, customer_phone, amount)
    values (new.discount_id, new.id, coalesce(new.customer_phone,''), new.discount_amount)
    on conflict (order_id) do nothing;
    if found then
      update public.discounts set used_count = used_count + 1, updated_at = now()
      where id = new.discount_id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists record_paid_order_discount_redemption_trigger on public.orders;
create trigger record_paid_order_discount_redemption_trigger
  after insert or update of payment_status on public.orders
  for each row execute function public.record_paid_order_discount_redemption();
revoke all on function public.record_paid_order_discount_redemption() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-proofs', 'order-proofs', false, 10485760, array['image/png','image/jpeg','application/pdf'])
on conflict (id) do nothing;
drop policy if exists wearwise_owner_read_order_proofs on storage.objects;
create policy wearwise_owner_read_order_proofs on storage.objects for select to authenticated
  using (bucket_id = 'order-proofs' and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
drop policy if exists wearwise_owner_add_order_proofs on storage.objects;
create policy wearwise_owner_add_order_proofs on storage.objects for insert to authenticated
  with check (bucket_id = 'order-proofs' and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
drop policy if exists wearwise_owner_update_order_proofs on storage.objects;
create policy wearwise_owner_update_order_proofs on storage.objects for update to authenticated
  using (bucket_id = 'order-proofs' and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (bucket_id = 'order-proofs' and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
drop policy if exists wearwise_owner_delete_order_proofs on storage.objects;
create policy wearwise_owner_delete_order_proofs on storage.objects for delete to authenticated
  using (bucket_id = 'order-proofs' and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
