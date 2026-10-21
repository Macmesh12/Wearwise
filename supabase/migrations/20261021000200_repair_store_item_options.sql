-- Keep deployed databases compatible when the original store item options
-- migration was skipped or only partially applied.
alter table public.store_items
  add column if not exists size_options text[] not null default '{}',
  add column if not exists color_options text[] not null default '{}';