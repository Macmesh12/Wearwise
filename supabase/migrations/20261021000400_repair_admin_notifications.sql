-- Restore the notification table when the delivery/notification migration was
-- skipped or only partially applied in a deployed database.
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('paid_order', 'design_request', 'low_stock')),
  title text not null,
  body text not null,
  order_id uuid references public.orders(id) on delete cascade,
  store_item_id uuid references public.store_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_notifications_created_idx
  on public.admin_notifications(created_at desc);

alter table public.admin_notifications enable row level security;
drop policy if exists wearwise_owner_read_admin_notifications on public.admin_notifications;
create policy wearwise_owner_read_admin_notifications
  on public.admin_notifications for select to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
drop policy if exists wearwise_owner_update_admin_notifications on public.admin_notifications;
create policy wearwise_owner_update_admin_notifications
  on public.admin_notifications for update to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

revoke all on public.admin_notifications from public, anon, authenticated;
grant select, update on public.admin_notifications to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_notifications'
  ) then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end;
$$;