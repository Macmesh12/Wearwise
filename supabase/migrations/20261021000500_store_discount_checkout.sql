-- Allow public checkout to validate a discount without exposing the discounts
-- table or private usage data.
create or replace function public.preview_store_discount(
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  discount_row public.discounts%rowtype;
  discount_amount numeric(12, 2);
begin
  select * into discount_row
  from public.discounts
  where code = upper(trim(p_code));

  if not found or discount_row.status <> 'active'
      or discount_row.applies_to not in ('shop', 'both')
     or (discount_row.start_date is not null and discount_row.start_date > now())
     or (discount_row.end_date is not null and discount_row.end_date < now())
     or p_subtotal < discount_row.min_order_amount
     or (discount_row.total_limit is not null and discount_row.used_count >= discount_row.total_limit) then
    raise exception 'This discount code is not currently valid.';
  end if;

  discount_amount := least(
    coalesce(discount_row.max_cap, p_subtotal),
    case when discount_row.type = 'percentage'
      then p_subtotal * discount_row.value / 100
      else discount_row.value
    end
  );

  return jsonb_build_object(
    'id', discount_row.id,
    'code', discount_row.code,
    'type', discount_row.type,
    'value', discount_row.value,
    'max_cap', discount_row.max_cap,
    'amount', greatest(0, discount_amount)
  );
end;
$$;

revoke all on function public.preview_store_discount(text, numeric) from public, anon, authenticated;
grant execute on function public.preview_store_discount(text, numeric) to anon, authenticated;