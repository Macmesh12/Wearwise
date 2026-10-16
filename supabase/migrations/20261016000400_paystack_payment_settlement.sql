-- Atomically settle a Paystack payment after the server verifies it with Paystack.
create or replace function public.settle_paystack_order_payment(
  p_reference text,
  p_amount numeric,
  p_currency text,
  p_payment_method text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment public.order_payments%rowtype;
  target_order public.orders%rowtype;
  next_paid numeric(12, 2);
begin
  if coalesce(trim(p_reference), '') = '' or p_amount is null or p_amount <= 0 or p_currency <> 'GHS' then
    raise exception 'Invalid verified Paystack payment details.';
  end if;

  select * into target_payment from public.order_payments
  where provider_reference = p_reference and provider = 'paystack' and transaction_type = 'payment'
  for update;
  if not found then raise exception 'Paystack payment reference was not found.'; end if;
  if target_payment.status = 'successful' then return 'already_settled'; end if;
  if round(target_payment.amount, 2) <> round(p_amount, 2) or target_payment.currency_code <> p_currency then
    raise exception 'Verified Paystack amount does not match the order payment.';
  end if;

  select * into target_order from public.orders where id = target_payment.order_id for update;
  if not found then raise exception 'Order was not found.'; end if;
  if target_order.status in ('cancelled', 'refunded') then raise exception 'This order cannot receive payment.'; end if;
  next_paid := target_order.amount_paid + target_payment.amount;
  if next_paid > target_order.total_amount then raise exception 'Payment exceeds the remaining order balance.'; end if;

  update public.order_payments set status = 'successful', payment_method = nullif(trim(p_payment_method), ''),
    confirmed_at = now(), updated_at = now() where id = target_payment.id;
  update public.orders set amount_paid = next_paid,
    payment_status = case when next_paid >= total_amount then 'paid' else 'pending' end,
    status = case when next_paid >= total_amount and status in ('request_received', 'awaiting_payment') then 'paid' else status end,
    estimated_delivery_date = case when next_paid >= total_amount and estimated_delivery_date is null
      then current_date + greatest(1, 7 - rush_days_early) else estimated_delivery_date end,
    updated_at = now() where id = target_order.id;
  return 'settled';
end;
$$;

-- Reserve a single live checkout per order to prevent simultaneous checkouts
-- from charging the customer twice. A checkout older than 20 minutes expires.
create or replace function public.reserve_paystack_checkout(
  p_order_code text,
  p_phone text,
  p_email text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  due numeric(12,2);
begin
  select * into target_order from public.orders
  where order_code = upper(trim(p_order_code))
    and regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
  for update;
  if not found then raise exception 'We could not match that order code and phone number.'; end if;
  if target_order.status <> 'awaiting_payment' or target_order.currency_code <> 'GHS' then
    raise exception 'This order is not ready for payment.';
  end if;
  due := round(target_order.total_amount - target_order.amount_paid, 2);
  if due <= 0 then raise exception 'This order has no balance to pay.'; end if;

  update public.order_payments set status = 'failed', notes = 'Checkout expired before payment.', updated_at = now()
    where order_id = target_order.id and provider = 'paystack' and transaction_type = 'payment'
      and status = 'pending' and created_at < now() - interval '20 minutes';
  if exists (select 1 from public.order_payments where order_id = target_order.id and provider = 'paystack'
      and transaction_type = 'payment' and status = 'pending') then
    raise exception 'A checkout is already active for this order. Please wait 20 minutes before trying again.';
  end if;

  insert into public.order_payments (order_id, transaction_type, status, provider, payment_method, provider_reference, amount, currency_code, notes)
  values (target_order.id, 'payment', 'pending', 'paystack', 'checkout', p_reference, due, 'GHS', 'Customer checkout initialized.');
  if target_order.customer_email is null then
    update public.orders set customer_email = lower(trim(p_email)), updated_at = now() where id = target_order.id;
  end if;
  return jsonb_build_object('order_id', target_order.id, 'order_code', target_order.order_code, 'amount', due);
end;
$$;

revoke all on function public.settle_paystack_order_payment(text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.settle_paystack_order_payment(text, numeric, text, text) to service_role;
revoke all on function public.reserve_paystack_checkout(text, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_paystack_checkout(text, text, text, text) to service_role;
