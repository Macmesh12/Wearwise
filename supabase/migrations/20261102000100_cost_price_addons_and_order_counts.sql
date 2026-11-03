alter table public.store_items
  add column if not exists additional_cost_options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(additional_cost_options) = 'array');

alter table public.order_items
  add column if not exists additional_costs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(additional_costs) = 'array');

update public.order_items item
set estimated_unit_cost = (
  select costs.cost_price
  from public.product_variants variant
  join public.product_variant_costs costs on costs.variant_id = variant.id
  where variant.product_id = item.store_item_id
    and lower(trim(variant.size)) = lower(trim(coalesce(item.requested_size, '')))
    and lower(trim(variant.color)) = lower(trim(coalesce(item.requested_color, '')))
  limit 1
)
where item.store_item_id is not null;

create or replace function public.commit_store_inventory_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status is distinct from new.payment_status) then
    update public.store_items item
    set stock_quantity = item.stock_quantity - ordered.quantity,
        updated_at = now()
    from (
      select store_item_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = new.id and store_item_id is not null
      group by store_item_id
    ) ordered
    where item.id = ordered.store_item_id
      and item.stock_quantity is not null;
  end if;
  return new;
end;
$$;

drop function if exists public.create_store_purchase_with_area(
  uuid, integer, text, text, text, text, text, text, text, text, text, text
);
drop function if exists public.create_store_purchase_with_area(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, jsonb
);

create or replace function public.create_store_purchase_with_area(
  p_items jsonb,
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
  requested_product record;
  requested_line jsonb;
  chosen_fee numeric(12,2);
  variant_price numeric(12,2);
  unit_cost numeric(12,2);
  line_unit_price numeric(12,2);
  addons_total numeric(12,2) := 0;
  subtotal_amount numeric(12,2) := 0;
  area_is_free boolean := false;
  requested_addon jsonb;
  configured_addon jsonb;
  snapshot_addons jsonb := '[]'::jsonb;
  line_snapshots jsonb := '[]'::jsonb;
  addon_details text;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) < 1
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 20 then
    raise exception 'Add between 1 and 20 items to your cart.';
  end if;
  if coalesce(length(trim(p_customer_name)), 0) < 2 or coalesce(length(trim(p_customer_phone)), 0) < 7 then
    raise exception 'Enter your name and a valid phone number.';
  end if;
  if (
    select coalesce(sum((line.value->>'quantity')::integer), 0)
    from jsonb_array_elements(p_items) as line(value)
  ) > 20 then
    raise exception 'Your cart is limited to 20 items.';
  end if;

  for requested_product in
    select (line.value->>'itemId')::uuid as item_id,
      sum((line.value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as line(value)
    group by (line.value->>'itemId')::uuid
    order by item_id
  loop
    select * into selected_item from public.store_items
      where id = requested_product.item_id and is_published and is_available
      for update;
    if not found then raise exception 'An item in your cart is no longer available.'; end if;
    if selected_item.stock_quantity is not null
       and selected_item.stock_quantity < requested_product.quantity then
      raise exception 'There is not enough stock for %.', selected_item.name;
    end if;
  end loop;

  for requested_line in select value from jsonb_array_elements(p_items)
  loop
    select * into selected_item from public.store_items
      where id = (requested_line->>'itemId')::uuid
        and is_published and is_available;
    if not found then raise exception 'An item in your cart is no longer available.'; end if;

    if cardinality(selected_item.size_options) > 0 and not exists (
      select 1 from unnest(selected_item.size_options) option
      where lower(trim(option)) = lower(trim(coalesce(requested_line->>'size', '')))
    ) then raise exception 'Choose one of the listed sizes.'; end if;
    if cardinality(selected_item.color_options) > 0 and not exists (
      select 1 from unnest(selected_item.color_options) option
      where lower(trim(option)) = lower(trim(coalesce(requested_line->>'color', '')))
    ) then raise exception 'Choose one of the listed colours.'; end if;

    select variant.selling_price, costs.cost_price
      into variant_price, unit_cost
      from public.product_variants variant
      left join public.product_variant_costs costs on costs.variant_id = variant.id
      where variant.product_id = selected_item.id
        and variant.status = 'active'
        and lower(trim(variant.size)) = lower(trim(coalesce(requested_line->>'size', '')))
        and lower(trim(variant.color)) = lower(trim(coalesce(requested_line->>'color', '')))
      limit 1;
    if not found then
      if exists (
        select 1 from public.product_variants
        where product_id = selected_item.id and status = 'active'
      ) then
        raise exception 'A size and colour combination in your cart is no longer available.';
      end if;
      variant_price := selected_item.price;
      unit_cost := null;
    end if;

    addons_total := 0;
    snapshot_addons := '[]'::jsonb;
    if jsonb_typeof(coalesce(requested_line->'additionalCosts', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(requested_line->'additionalCosts', '[]'::jsonb)) > 20 then
      raise exception 'Review the selected product options and try again.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(requested_line->'additionalCosts', '[]'::jsonb)) as requested(value)
      group by requested.value->>'id'
      having count(*) > 1
    ) then
      raise exception 'An additional option was selected more than once.';
    end if;

    for requested_addon in
      select value
      from jsonb_array_elements(coalesce(requested_line->'additionalCosts', '[]'::jsonb))
    loop
      if coalesce(requested_addon->>'id', '') = '' then
        raise exception 'Review the selected product options and try again.';
      end if;
      select value into configured_addon
        from jsonb_array_elements(selected_item.additional_cost_options) as option(value)
        where value->>'id' = requested_addon->>'id'
        limit 1;
      if not found then
        raise exception 'A selected additional option is no longer available.';
      end if;

      addon_details := left(trim(coalesce(requested_addon->>'details', '')), 200);
      if coalesce(configured_addon->>'details_prompt', '') <> '' and addon_details = '' then
        raise exception 'Enter the requested details for %.', configured_addon->>'name';
      end if;
      addons_total := addons_total + coalesce((configured_addon->>'price')::numeric, 0);
      snapshot_addons := snapshot_addons || jsonb_build_array(jsonb_build_object(
        'id', configured_addon->>'id',
        'name', configured_addon->>'name',
        'price', coalesce((configured_addon->>'price')::numeric, 0),
        'details', addon_details
      ));
    end loop;

    line_unit_price := variant_price + addons_total;
    subtotal_amount := subtotal_amount +
      line_unit_price * (requested_line->>'quantity')::integer;
    line_snapshots := line_snapshots || jsonb_build_array(jsonb_build_object(
      'store_item_id', selected_item.id,
      'product_name_snapshot', selected_item.name,
      'category_snapshot', selected_item.category,
      'requested_size', nullif(trim(coalesce(requested_line->>'size', '')), ''),
      'requested_color', nullif(trim(coalesce(requested_line->>'color', '')), ''),
      'quantity', (requested_line->>'quantity')::integer,
      'quoted_unit_price', line_unit_price,
      'estimated_unit_cost', unit_cost,
      'additional_costs', snapshot_addons
    ));
  end loop;

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
    subtotal_amount, chosen_fee,
    subtotal_amount + chosen_fee, current_date + 2
  ) returning * into new_order;

  for requested_line in select value from jsonb_array_elements(line_snapshots)
  loop
    insert into public.order_items (
      order_id, store_item_id, product_name_snapshot, category_snapshot,
      requested_size, requested_color, quantity, quoted_unit_price,
      estimated_unit_cost, additional_costs
    ) values (
      new_order.id,
      (requested_line->>'store_item_id')::uuid,
      requested_line->>'product_name_snapshot',
      requested_line->>'category_snapshot',
      requested_line->>'requested_size',
      requested_line->>'requested_color',
      (requested_line->>'quantity')::integer,
      (requested_line->>'quoted_unit_price')::numeric,
      (requested_line->>'estimated_unit_cost')::numeric,
      requested_line->'additional_costs'
    );
  end loop;

  return jsonb_build_object(
    'order_code', new_order.order_code,
    'order_id', new_order.id,
    'subtotal', new_order.subtotal,
    'total_amount', new_order.total_amount,
    'amount', new_order.total_amount,
    'currency', new_order.currency_code
  );
end;
$$;

revoke all on function public.create_store_purchase_with_area(
  jsonb, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_store_purchase_with_area(
  jsonb, text, text, text, text, text, text, text, text
) to service_role;
