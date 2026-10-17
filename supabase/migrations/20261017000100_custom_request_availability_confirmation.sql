-- A custom design quote can be sent only after WearWise confirms it can source
-- the requested garment and fulfill the design.
alter table public.orders
  add column if not exists availability_confirmed_at timestamptz;

create or replace function public.require_custom_order_availability_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_type = 'custom_design'
     and new.status = 'awaiting_payment'
     and new.availability_confirmed_at is null then
    raise exception 'Confirm garment availability and design feasibility before requesting payment.';
  end if;
  return new;
end;
$$;

drop trigger if exists require_custom_order_availability_confirmation_trigger on public.orders;
create trigger require_custom_order_availability_confirmation_trigger
  before insert or update of status, availability_confirmed_at on public.orders
  for each row execute function public.require_custom_order_availability_confirmation();

revoke all on function public.require_custom_order_availability_confirmation() from public, anon, authenticated;
