-- ============================================================================
-- LYRA — Storage buckets (privés) + RLS owner
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false), ('imports', 'imports', false)
on conflict (id) do nothing;

drop policy if exists "lyra_storage_select" on storage.objects;
drop policy if exists "lyra_storage_insert" on storage.objects;
drop policy if exists "lyra_storage_update" on storage.objects;
drop policy if exists "lyra_storage_delete" on storage.objects;

create policy "lyra_storage_select" on storage.objects for select
  using (bucket_id in ('attachments','imports') and public.is_owner());
create policy "lyra_storage_insert" on storage.objects for insert
  with check (bucket_id in ('attachments','imports') and public.is_owner());
create policy "lyra_storage_update" on storage.objects for update
  using (bucket_id in ('attachments','imports') and public.is_owner())
  with check (bucket_id in ('attachments','imports') and public.is_owner());
create policy "lyra_storage_delete" on storage.objects for delete
  using (bucket_id in ('attachments','imports') and public.is_owner());
