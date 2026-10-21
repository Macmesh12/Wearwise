-- Connect admin-managed delivery areas and preferences to checkout and the
-- admin notification center. Existing checkout and order tables remain intact.

create or replace function public.create_store_purchase_with_area(
  p_item_id uuid,
  p_quantity integer,
  p_size text,
  p_color text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_method text,
  p_delivery_region text,
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
  selected_area public.delivery_areas%rowtype;
  new_order public.orders%rowtype;
  chosen_fee numeric(12,2);
  unit_cost numeric(12,2);
  area_found boolean := false;
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
  if p_delivery_method in ('courier', 'other') and coalesce(length(trim(p_delivery_address)), 0) = 0 then
    raise exception 'Enter the address for delivery.';
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

  if coalesce(trim(p_delivery_area), '') <> '' and coalesce(trim(p_delivery_region), '') <> '' then
    select * into selected_area from public.delivery_areas
    where lower(trim(area)) = lower(trim(p_delivery_area))
      and lower(trim(region)) = lower(trim(p_delivery_region))
      and status = 'active'
    limit 1;
    area_found := found;
  end if;

  if area_found then
    area_is_free := selected_area.free_delivery;
  elsif coalesce(trim(p_delivery_area), '') <> '' then
    select exists (
      select 1 from unnest(fee_settings.free_delivery_areas) legacy_area
      where lower(trim(legacy_area)) = lower(trim(p_delivery_area))
    ) into area_is_free;
  end if;

  if area_is_free then
    chosen_fee := 0;
  elsif area_found and p_delivery_method in ('courier', 'other') then
    chosen_fee := selected_area.fee;
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
    p_delivery_method,
    nullif(concat_ws(', ', nullif(trim(p_delivery_area), ''), nullif(trim(p_delivery_region), '')), ''),
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
revoke all on function public.create_store_purchase_with_area(uuid, integer, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_store_purchase_with_area(uuid, integer, text, text, text, text, text, text, text, text, text, text) to service_role;

create or replace function public.set_design_request_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.order_type in ('existing_design', 'custom_design') and new.order_code like 'WW-%' then
    new.order_code := 'WQ-' || substr(new.order_code, 4);
  end if;
  return new;
end;
$$;
revoke all on function public.set_design_request_code() from public, anon, authenticated;
drop trigger if exists set_design_request_code_trigger on public.orders;
create trigger set_design_request_code_trigger before insert on public.orders
  for each row execute function public.set_design_request_code();

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
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);
alter table public.admin_notifications enable row level security;
drop policy if exists wearwise_owner_read_admin_notifications on public.admin_notifications;
create policy wearwise_owner_read_admin_notifications on public.admin_notifications for select to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
drop policy if exists wearwise_owner_update_admin_notifications on public.admin_notifications;
create policy wearwise_owner_update_admin_notifications on public.admin_notifications for update to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);
revoke all on public.admin_notifications from public, anon, authenticated;
grant select, update on public.admin_notifications to authenticated;

create or replace function public.create_admin_notifications_for_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare prefs public.admin_preferences%rowtype;
  just_paid boolean := false;
begin
  select * into prefs from public.admin_preferences where singleton = true;
  if tg_op = 'INSERT' and new.order_type <> 'store_purchase' and coalesce(prefs.notify_design_requests, true) then
    insert into public.admin_notifications(kind, title, body, order_id)
    values ('design_request', 'New design request', new.order_code || ' · ' || new.customer_name, new.id);
  end if;
  if tg_op = 'INSERT' then
    just_paid := new.payment_status = 'paid';
  elsif tg_op = 'UPDATE' then
    just_paid := new.payment_status = 'paid' and old.payment_status is distinct from 'paid';
  end if;
  if just_paid and coalesce(prefs.notify_paid_orders, true) then
    insert into public.admin_notifications(kind, title, body, order_id)
    values ('paid_order', 'Payment confirmed', new.order_code || ' · GHS ' || to_char(new.amount_paid, 'FM999999990.00'), new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.create_admin_notifications_for_order() from public, anon, authenticated;
drop trigger if exists create_admin_notifications_for_order_trigger on public.orders;
create trigger create_admin_notifications_for_order_trigger
  after insert or update of payment_status on public.orders
  for each row execute function public.create_admin_notifications_for_order();

create or replace function public.create_admin_notification_for_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare notify_stock boolean := true;
  crossed_low_stock boolean := false;
begin
  select coalesce(notify_low_stock, true) into notify_stock from public.admin_preferences where singleton = true;
  if tg_op = 'INSERT' then
    crossed_low_stock := true;
  elsif tg_op = 'UPDATE' then
    crossed_low_stock := old.stock_quantity is null or old.stock_quantity >= 5;
  end if;
  if notify_stock and new.is_published and new.stock_quantity is not null and new.stock_quantity < 5 and crossed_low_stock then
    insert into public.admin_notifications(kind, title, body, store_item_id)
    values ('low_stock', 'Low stock alert', new.name || ' · ' || new.stock_quantity || ' left', new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.create_admin_notification_for_low_stock() from public, anon, authenticated;
drop trigger if exists create_admin_notification_for_low_stock_trigger on public.store_items;
create trigger create_admin_notification_for_low_stock_trigger
  after insert or update of stock_quantity, is_published on public.store_items
  for each row execute function public.create_admin_notification_for_low_stock();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'admin_notifications'
     ) then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end;
$$;
