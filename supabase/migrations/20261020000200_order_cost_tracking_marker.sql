-- Lets the admin distinguish an order whose actual costs were entered (including
-- zero-cost items) from one whose costs are still unknown.
alter table public.orders
  add column if not exists actual_costs_recorded_at timestamptz;
