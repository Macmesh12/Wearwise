-- Restore the delivery settings table when the original checkout migration
-- was skipped or only partially applied in a deployed database.
create table if not exists public.store_delivery_settings (
  singleton boolean primary key default true check (singleton),
  campus_handoff_fee numeric(12, 2) not null default 0 check (campus_handoff_fee >= 0),
  sister_office_handoff_fee numeric(12, 2) not null default 0 check (sister_office_handoff_fee >= 0),
  courier_fee numeric(12, 2) check (courier_fee is null or courier_fee >= 0),
  other_fee numeric(12, 2) check (other_fee is null or other_fee >= 0),
  free_delivery_areas text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.store_delivery_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.store_delivery_settings enable row level security;
drop policy if exists wearwise_public_store_delivery_settings on public.store_delivery_settings;
create policy wearwise_public_store_delivery_settings
  on public.store_delivery_settings for select to anon, authenticated using (singleton);
drop policy if exists wearwise_owner_manage_store_delivery_settings on public.store_delivery_settings;
create policy wearwise_owner_manage_store_delivery_settings
  on public.store_delivery_settings for update to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

revoke all on public.store_delivery_settings from public, anon, authenticated;
grant select on public.store_delivery_settings to anon, authenticated;
grant update on public.store_delivery_settings to authenticated;