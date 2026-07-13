insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'assembled-pcs',
  'assembled-pcs',
  true,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists "assembled_pcs_public_read" on storage.objects;
create policy "assembled_pcs_public_read"
on storage.objects
for select
to public
using (bucket_id = 'assembled-pcs');

drop policy if exists "assembled_pcs_anon_upload" on storage.objects;
create policy "assembled_pcs_anon_upload"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'assembled-pcs'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "assembled_pcs_anon_update" on storage.objects;
create policy "assembled_pcs_anon_update"
on storage.objects
for update
to anon
using (
  bucket_id = 'assembled-pcs'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
)
with check (
  bucket_id = 'assembled-pcs'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "assembled_pcs_anon_delete" on storage.objects;
create policy "assembled_pcs_anon_delete"
on storage.objects
for delete
to anon
using (bucket_id = 'assembled-pcs');
