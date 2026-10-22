create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists wearwise_owner_manage_push_subscriptions on public.push_subscriptions;
create policy wearwise_owner_manage_push_subscriptions
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;