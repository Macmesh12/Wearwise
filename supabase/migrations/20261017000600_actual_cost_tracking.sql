-- Distinguish costs that have been entered from default zero values so the
-- admin dashboard can report profit only for orders with complete costs.
alter table public.orders
  add column if not exists actual_costs_recorded_at timestamptz;
