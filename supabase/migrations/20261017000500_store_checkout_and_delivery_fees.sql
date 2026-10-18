-- Delivery fees are public checkout prices, configured by the owner.
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

-- An unrecorded item cost is unknown, not free; preserve that distinction in
-- order snapshots so future profit reports do not overstate profit.
alter table public.order_items
  alter column estimated_unit_cost drop not null,
  alter column estimated_unit_cost drop default;

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

-- A quantity is deducted when checkout starts so two customers cannot buy the
-- last counted item at the same time. Cancelling the unpaid order restores it.
create table if not exists public.store_inventory_reservations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  store_item_id uuid not null references public.store_items(id),
  quantity integer not null check (quantity > 0),
  stock_deducted boolean not null,
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.store_inventory_reservations enable row level security;
revoke all on public.store_inventory_reservations from public, anon, authenticated;

create or replace function public.create_store_purchase(
  p_item_id uuid,
  p_quantity integer,
  p_size text,
  p_color text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_method text,
  p_delivery_area text,
  p_delivery_address text,
  p_delivery_instructions text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_item public.store_items%rowtype;
  fee_settings public.store_delivery_settings%rowtype;
  new_order public.orders%rowtype;
  chosen_fee numeric(12,2);
  unit_cost numeric(12,2);
  area_is_free boolean := false;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Choose a quantity between 1 and 20.';
  end if;
  if coalesce(length(trim(p_customer_name)), 0) < 2 or coalesce(length(trim(p_customer_phone)), 0) < 7 then
    raise exception 'Enter your name and a valid phone number.';
  end if;
  if p_delivery_method not in ('campus_handoff', 'sister_office_handoff', 'courier', 'other') then
    raise exception 'Choose one of the available delivery methods.';
  end if;
  if p_delivery_method = 'courier' and coalesce(length(trim(p_delivery_address)), 0) = 0 then
    raise exception 'Enter the address for courier delivery.';
  end if;

  select * into selected_item from public.store_items
    where id = p_item_id and is_published and is_available
    for update;
  if not found then raise exception 'This item is no longer available.'; end if;
  if cardinality(selected_item.size_options) > 0 and not exists (
    select 1 from unnest(selected_item.size_options) option where lower(trim(option)) = lower(trim(coalesce(p_size, '')))
  ) then raise exception 'Choose one of the listed sizes.'; end if;
  if cardinality(selected_item.color_options) > 0 and not exists (
    select 1 from unnest(selected_item.color_options) option where lower(trim(option)) = lower(trim(coalesce(p_color, '')))
  ) then raise exception 'Choose one of the listed colours.'; end if;
  if selected_item.stock_quantity is not null and selected_item.stock_quantity < p_quantity then
    raise exception 'There is not enough stock for that quantity.';
  end if;

  select * into fee_settings from public.store_delivery_settings where singleton = true;
  if not found then raise exception 'Delivery prices are not configured yet.'; end if;
  if coalesce(trim(p_delivery_area), '') <> '' then
    select exists (
      select 1 from unnest(fee_settings.free_delivery_areas) area
      where lower(trim(area)) = lower(trim(p_delivery_area))
    ) into area_is_free;
  end if;
  if area_is_free then
    chosen_fee := 0;
  else
    chosen_fee := case p_delivery_method
      when 'campus_handoff' then fee_settings.campus_handoff_fee
      when 'sister_office_handoff' then fee_settings.sister_office_handoff_fee
      when 'courier' then fee_settings.courier_fee
      else fee_settings.other_fee
    end;
  end if;
  if chosen_fee is null then raise exception 'This delivery option is not available yet. Please contact WearWise.'; end if;

  select case when c.purchase_cost is not null and c.other_cost is not null
    then c.purchase_cost + c.other_cost else null end
    into unit_cost from public.store_item_costs c where c.store_item_id = selected_item.id;

  insert into public.orders (
    order_type, status, payment_status, customer_name, customer_phone, customer_email,
    delivery_method, delivery_area, delivery_address, delivery_instructions,
    subtotal, delivery_fee, total_amount, estimated_delivery_date
  ) values (
    'store_purchase', 'awaiting_payment', 'awaiting_payment', trim(p_customer_name),
    trim(p_customer_phone), nullif(lower(trim(coalesce(p_customer_email, ''))), ''),
    p_delivery_method, nullif(trim(coalesce(p_delivery_area, '')), ''),
    nullif(trim(coalesce(p_delivery_address, '')), ''),
    nullif(trim(coalesce(p_delivery_instructions, '')), ''),
    selected_item.price * p_quantity, chosen_fee,
    selected_item.price * p_quantity + chosen_fee, current_date + 2
  ) returning * into new_order;

  insert into public.order_items (
    order_id, store_item_id, product_name_snapshot, category_snapshot,
    requested_size, requested_color, quantity, quoted_unit_price, estimated_unit_cost
  ) values (
    new_order.id, selected_item.id, selected_item.name, selected_item.category,
    nullif(trim(coalesce(p_size, '')), ''), nullif(trim(coalesce(p_color, '')), ''),
    p_quantity, selected_item.price, unit_cost
  );

  if selected_item.stock_quantity is not null then
    update public.store_items set stock_quantity = stock_quantity - p_quantity,
      updated_at = now() where id = selected_item.id;
  end if;
  insert into public.store_inventory_reservations (order_id, store_item_id, quantity, stock_deducted)
    values (new_order.id, selected_item.id, p_quantity, selected_item.stock_quantity is not null);

  return jsonb_build_object(
    'order_id', new_order.id,
    'order_code', new_order.order_code,
    'subtotal', new_order.subtotal,
    'delivery_fee', new_order.delivery_fee,
    'total_amount', new_order.total_amount
  );
end;
$$;

create or replace function public.restore_unpaid_store_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.store_inventory_reservations%rowtype;
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    if exists (
      select 1 from public.order_payments p
      where p.order_id = new.id and p.provider = 'paystack'
        and p.transaction_type = 'payment' and p.status = 'pending'
        and p.created_at > now() - interval '20 minutes'
    ) then
      raise exception 'Wait for the active payment checkout to finish before cancelling this order.';
    end if;
    select * into reservation from public.store_inventory_reservations
      where order_id = new.id and status = 'reserved' for update;
    if found then
      if reservation.stock_deducted then
        update public.store_items set stock_quantity = stock_quantity + reservation.quantity,
          updated_at = now() where id = reservation.store_item_id;
      end if;
      update public.store_inventory_reservations set status = 'released', updated_at = now()
        where order_id = new.id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists restore_unpaid_store_inventory_trigger on public.orders;
create trigger restore_unpaid_store_inventory_trigger
  after update of status on public.orders
  for each row execute function public.restore_unpaid_store_inventory();

create or replace function public.commit_store_inventory_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from new.payment_status then
    update public.store_inventory_reservations set status = 'committed', updated_at = now()
      where order_id = new.id and status = 'reserved';
  end if;
  return new;
end;
$$;
drop trigger if exists commit_store_inventory_on_payment_trigger on public.orders;
create trigger commit_store_inventory_on_payment_trigger
  after update of payment_status on public.orders
  for each row execute function public.commit_store_inventory_on_payment();

revoke all on function public.create_store_purchase(uuid, integer, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_store_purchase(uuid, integer, text, text, text, text, text, text, text, text, text) to service_role;
revoke all on function public.restore_unpaid_store_inventory() from public, anon, authenticated;
revoke all on function public.commit_store_inventory_on_payment() from public, anon, authenticated;
