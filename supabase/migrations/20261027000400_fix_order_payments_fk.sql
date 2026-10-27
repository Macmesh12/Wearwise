-- Fix order_payments FK violation: order_items insert overwrites new_order variable
-- Use a separate variable for order_items insert result so new_order.id stays the order id.

drop function if exists public.create_store_purchase_with_area(uuid, integer, text, text, text, text, text, text, text, text, text, text);

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
  new_order public.orders%rowtype;
  new_item public.order_items%rowtype;
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
    p_size, p_color, p_quantity, coalesce(unit_cost, selected_item.price), coalesce(unit_cost, selected_item.price)
  ) returning * into new_item;

  insert into public.order_payments (
    order_id, provider, provider_reference, amount, currency_code, status, transaction_type
  ) values (
    new_order.id, 'paystack', null, selected_item.price * p_quantity + chosen_fee,
    'GHS', 'pending', 'payment'
  );

  return jsonb_build_object(
    'order_code', new_order.order_code,
    'order_id', new_order.id,
    'amount', new_order.total_amount,
    'currency', new_order.total_amount
  );
end;
$$;

revoke all on function public.create_store_purchase_with_area(uuid, integer, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_store_purchase_with_area(uuid, integer, text, text, text, text, text, text, text, text, text, text) to service_role;