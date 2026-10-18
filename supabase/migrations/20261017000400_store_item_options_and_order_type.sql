-- Store products may offer their own size and colour options. Keep these
-- separate from the options used for custom-design shirt requests.
alter table public.store_items
  add column if not exists size_options text[] not null default '{}',
  add column if not exists color_options text[] not null default '{}';

-- Store purchases use the same orders and payment ledger, with a distinct
-- order type so the admin workflow can tell them apart from design requests.
alter table public.orders
  drop constraint if exists orders_order_type_check;

alter table public.orders
  add constraint orders_order_type_check
  check (order_type in ('existing_design', 'custom_design', 'store_purchase'));
