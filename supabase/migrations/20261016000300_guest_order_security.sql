-- Security support for guest order requests and private artwork.

create table if not exists public.guest_order_submission_limits (
  ip_hash text primary key check (length(ip_hash) = 64),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.guest_order_submission_limits enable row level security;
revoke all on public.guest_order_submission_limits from public, anon, authenticated;

create or replace function public.check_guest_order_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64 then
    return false;
  end if;

  insert into public.guest_order_submission_limits as limits (
    ip_hash,
    window_started_at,
    request_count
  ) values (
    p_ip_hash,
    now(),
    1
  )
  on conflict (ip_hash) do update
  set window_started_at = case
        when limits.window_started_at < now() - interval '1 hour' then now()
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at < now() - interval '1 hour' then 1
        else limits.request_count + 1
      end
  returning request_count into current_count;

  delete from public.guest_order_submission_limits
  where window_started_at < now() - interval '48 hours';

  return current_count <= 10;
end;
$$;

revoke all on function public.check_guest_order_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_guest_order_rate_limit(text) to service_role;

-- Artwork stays in a private bucket. Only the owner account may sign and view
-- customer-submitted files; no public policy is added.
drop policy if exists wearwise_owner_read_customer_artwork on storage.objects;
create policy wearwise_owner_read_customer_artwork
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-artwork'
    and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid
  );
