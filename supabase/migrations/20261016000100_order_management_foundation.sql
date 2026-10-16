-- WearWise MVP: private order-management foundation.
-- Run this in the Supabase SQL Editor. Guest order creation and customer
-- tracking will be added through server-side functions in a later step.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique
    default ('WW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  tracking_token text not null unique
    default replace(gen_random_uuid()::text, '-', ''),

  order_type text not null
    check (order_type in ('existing_design', 'custom_design')),
  status text not null default 'request_received'
    check (status in (
      'request_received',
      'awaiting_payment',
      'paid',
      'design_in_progress',
      'proof_sent',
      'revision_requested',
      'proof_approved',
      'sourcing',
      'alternative_offered',
      'refund_pending',
      'refunded',
      'in_production',
      'ready_for_handoff',
      'out_for_delivery',
      'delivered',
      'completed',
      'cancelled'
    )),
  payment_status text not null default 'awaiting_payment'
    check (payment_status in (
      'awaiting_payment',
      'pending',
      'paid',
      'failed',
      'refund_pending',
      'partially_refunded',
      'refunded'
    )),

  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  delivery_method text
    check (delivery_method is null or delivery_method in (
      'campus_handoff',
      'sister_office_handoff',
      'courier',
      'other'
    )),
  delivery_area text,
  delivery_address text,
  delivery_instructions text,

  customer_request text,
  customer_artwork_path text,
  proof_image_path text,
  selected_design_snapshot jsonb not null default '{}'::jsonb,

  currency_code text not null default 'GHS'
    check (currency_code = 'GHS'),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  rush_days_early smallint not null default 0 check (rush_days_early >= 0),
  rush_fee numeric(12, 2) not null default 0 check (rush_fee >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  amount_refunded numeric(12, 2) not null default 0 check (amount_refunded >= 0),

  estimated_delivery_date date,
  actual_sourcing_cost numeric(12, 2) not null default 0 check (actual_sourcing_cost >= 0),
  actual_printing_cost numeric(12, 2) not null default 0 check (actual_printing_cost >= 0),
  actual_delivery_cost numeric(12, 2) not null default 0 check (actual_delivery_cost >= 0),
  actual_payment_fee numeric(12, 2) not null default 0 check (actual_payment_fee >= 0),
  actual_other_cost numeric(12, 2) not null default 0 check (actual_other_cost >= 0),

  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,

  product_name_snapshot text not null,
  category_snapshot text,
  selected_design_snapshot jsonb not null default '{}'::jsonb,
  requested_size text,
  requested_color text,
  quantity integer not null default 1 check (quantity > 0),
  customization_details jsonb not null default '{}'::jsonb,

  quoted_unit_price numeric(12, 2) not null default 0 check (quoted_unit_price >= 0),
  estimated_unit_cost numeric(12, 2) not null default 0 check (estimated_unit_cost >= 0),
  actual_unit_cost numeric(12, 2) not null default 0 check (actual_unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  transaction_type text not null default 'payment'
    check (transaction_type in ('payment', 'refund')),
  status text not null default 'pending'
    check (status in ('pending', 'successful', 'failed', 'refund_pending', 'refunded')),
  provider text,
  payment_method text,
  provider_reference text unique,
  amount numeric(12, 2) not null check (amount > 0),
  currency_code text not null default 'GHS' check (currency_code = 'GHS'),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status, created_at desc);
create index if not exists orders_customer_phone_idx on public.orders (customer_phone);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_payments_order_id_idx on public.order_payments (order_id, created_at desc);
create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id, created_at desc);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_status_history enable row level security;

-- Only the WearWise owner can access private order and payment information.
-- Guests will submit orders through a server-side function added later;
-- these tables are never directly readable by the public browser client.
drop policy if exists wearwise_owner_orders on public.orders;
create policy wearwise_owner_orders
  on public.orders for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

drop policy if exists wearwise_owner_order_items on public.order_items;
create policy wearwise_owner_order_items
  on public.order_items for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

drop policy if exists wearwise_owner_order_payments on public.order_payments;
create policy wearwise_owner_order_payments
  on public.order_payments for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

drop policy if exists wearwise_owner_order_status_history on public.order_status_history;
create policy wearwise_owner_order_status_history
  on public.order_status_history for all to authenticated
  using (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid)
  with check (auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid);

revoke all on public.orders, public.order_items, public.order_payments, public.order_status_history from public, anon, authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, insert, update, delete on public.order_payments to authenticated;
grant select, insert, update, delete on public.order_status_history to authenticated;

-- Enforce the payment-first commitment: custom design work cannot begin until
-- the order has been marked paid after payment confirmation.
create or replace function public.enforce_custom_design_paid_first()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_type = 'custom_design'
     and new.status in ('design_in_progress', 'proof_sent', 'revision_requested', 'proof_approved')
     and new.payment_status <> 'paid' then
    raise exception 'Custom design work can only begin after payment is confirmed.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_custom_design_paid_first_trigger on public.orders;
create trigger enforce_custom_design_paid_first_trigger
  before insert or update of status, payment_status on public.orders
  for each row execute function public.enforce_custom_design_paid_first();

-- Keep a private audit trail whenever an order moves to a new status.
create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists record_order_status_change_trigger on public.orders;
create trigger record_order_status_change_trigger
  after insert or update of status on public.orders
  for each row execute function public.record_order_status_change();

revoke all on function public.enforce_custom_design_paid_first() from public, anon, authenticated;
revoke all on function public.record_order_status_change() from public, anon, authenticated;
