alter table public.discount_redemptions
  drop constraint if exists discount_redemptions_order_id_fkey;

alter table public.discount_redemptions
  add constraint discount_redemptions_order_id_fkey
  foreign key (order_id)
  references public.orders(id)
  on delete cascade;

create or replace function public.decrement_discount_redemption_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discounts
  set used_count = greatest(0, used_count - 1),
      updated_at = now()
  where id = old.discount_id;
  return old;
end;
$$;

drop trigger if exists decrement_discount_redemption_count_trigger
  on public.discount_redemptions;

create trigger decrement_discount_redemption_count_trigger
  after delete on public.discount_redemptions
  for each row
  execute function public.decrement_discount_redemption_count();

revoke all on function public.decrement_discount_redemption_count()
  from public, anon, authenticated;
