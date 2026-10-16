-- Atomic admin actions for recording verified manual payments and refunds.
-- Paystack payments will later be recorded by a server-side webhook instead.

create or replace function public.record_manual_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_provider_reference text default null,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  new_amount_paid numeric(12, 2);
begin
  if auth.uid() is distinct from 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid then
    raise exception 'WearWise owner access is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if nullif(trim(p_payment_method), '') is null then
    raise exception 'Payment method is required.';
  end if;

  select * into target_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order was not found.';
  end if;

  if target_order.status in ('cancelled', 'refunded') then
    raise exception 'A cancelled or refunded order cannot receive payment.';
  end if;

  new_amount_paid := target_order.amount_paid + round(p_amount, 2);

  if new_amount_paid > target_order.total_amount then
    raise exception 'Payment is greater than the remaining order balance.';
  end if;

  insert into public.order_payments (
    order_id,
    transaction_type,
    status,
    provider,
    payment_method,
    provider_reference,
    amount,
    currency_code,
    confirmed_at,
    notes
  ) values (
    p_order_id,
    'payment',
    'successful',
    'manual',
    trim(p_payment_method),
    nullif(trim(p_provider_reference), ''),
    round(p_amount, 2),
    target_order.currency_code,
    now(),
    nullif(trim(p_notes), '')
  );

  update public.orders
  set amount_paid = new_amount_paid,
      payment_status = case
        when new_amount_paid >= total_amount then 'paid'
        else 'pending'
      end,
      status = case
        when new_amount_paid >= total_amount and status in ('request_received', 'awaiting_payment') then 'paid'
        else status
      end,
      estimated_delivery_date = case
        when new_amount_paid >= total_amount and estimated_delivery_date is null
          then current_date + greatest(1, 7 - rush_days_early)
        else estimated_delivery_date
      end,
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.record_manual_order_refund(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text default null,
  p_provider_reference text default null,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  new_amount_refunded numeric(12, 2);
begin
  if auth.uid() is distinct from 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid then
    raise exception 'WearWise owner access is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be greater than zero.';
  end if;

  select * into target_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order was not found.';
  end if;

  new_amount_refunded := target_order.amount_refunded + round(p_amount, 2);

  if new_amount_refunded > target_order.amount_paid then
    raise exception 'Refund is greater than the amount paid.';
  end if;

  insert into public.order_payments (
    order_id,
    transaction_type,
    status,
    provider,
    payment_method,
    provider_reference,
    amount,
    currency_code,
    confirmed_at,
    notes
  ) values (
    p_order_id,
    'refund',
    'refunded',
    'manual',
    nullif(trim(p_payment_method), ''),
    nullif(trim(p_provider_reference), ''),
    round(p_amount, 2),
    target_order.currency_code,
    now(),
    nullif(trim(p_notes), '')
  );

  update public.orders
  set amount_refunded = new_amount_refunded,
      payment_status = case
        when new_amount_refunded >= amount_paid then 'refunded'
        else 'partially_refunded'
      end,
      status = case
        when new_amount_refunded >= amount_paid then 'refunded'
        else status
      end,
      updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.record_manual_order_payment(uuid, numeric, text, text, text) from public, anon;
revoke all on function public.record_manual_order_refund(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.record_manual_order_payment(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.record_manual_order_refund(uuid, numeric, text, text, text) to authenticated;
