alter table public.menu_import_jobs
  add column if not exists storage_pages jsonb not null default '[]'::jsonb
  check (jsonb_typeof(storage_pages) = 'array');

alter table public.menu_versions
  add column if not exists image_pages jsonb not null default '[]'::jsonb
  check (jsonb_typeof(image_pages) = 'array');

update public.menu_import_jobs
set storage_pages = jsonb_build_array(
  jsonb_build_object(
    'page', 1,
    'bucket', storage_bucket,
    'path', storage_path,
    'mime', storage_mime,
    'sizeBytes', storage_size_bytes
  )
)
where jsonb_array_length(storage_pages) = 0
  and btrim(storage_path) <> '';

update public.menu_versions
set image_pages = jsonb_build_array(
  jsonb_build_object(
    'page', 1,
    'bucket', image_bucket,
    'path', image_path,
    'mime', image_mime,
    'sizeBytes', image_size_bytes
  )
)
where jsonb_array_length(image_pages) = 0
  and image_path is not null
  and btrim(image_path) <> '';
