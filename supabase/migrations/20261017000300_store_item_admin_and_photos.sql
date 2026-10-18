-- Public product images can be viewed in the shop. Only the WearWise owner
-- may add, replace, or remove objects in this bucket.

-- A blank private cost means "not recorded yet"; it must not look like a
-- zero-cost purchase in future profit reports.
alter table public.store_item_costs
  alter column purchase_cost drop not null,
  alter column purchase_cost drop default,
  alter column other_cost drop not null,
  alter column other_cost drop default;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-items',
  'store-items',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists wearwise_public_store_item_photos on storage.objects;
create policy wearwise_public_store_item_photos
  on storage.objects for select to public
  using (bucket_id = 'store-items');

drop policy if exists wearwise_owner_upload_store_item_photos on storage.objects;
create policy wearwise_owner_upload_store_item_photos
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'store-items'
    and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid
  );

drop policy if exists wearwise_owner_update_store_item_photos on storage.objects;
create policy wearwise_owner_update_store_item_photos
  on storage.objects for update to authenticated
  using (
    bucket_id = 'store-items'
    and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid
  )
  with check (
    bucket_id = 'store-items'
    and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid
  );

drop policy if exists wearwise_owner_delete_store_item_photos on storage.objects;
create policy wearwise_owner_delete_store_item_photos
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'store-items'
    and auth.uid() = 'c219bece-37e4-4357-a61d-0cb75674ed4c'::uuid
  );
