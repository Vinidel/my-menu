-- Admin menu generation/import pipeline (image -> draft -> publish)

create table if not exists public.menu_import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid null,
  status text not null default 'uploaded' check (
    status in (
      'uploaded',
      'processing',
      'ready',
      'ready_with_issues',
      'failed',
      'published',
      'discarded'
    )
  ),
  storage_bucket text not null check (btrim(storage_bucket) <> ''),
  storage_path text not null check (btrim(storage_path) <> ''),
  storage_mime text not null check (btrim(storage_mime) <> ''),
  storage_size_bytes integer not null check (storage_size_bytes > 0),
  menu_version_id uuid null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_versions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'image_import' check (source in ('seed_json', 'image_import')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  data jsonb not null check (jsonb_typeof(data) = 'array'),
  created_by uuid null,
  published_by uuid null,
  import_job_id uuid null,
  image_bucket text null,
  image_path text null,
  image_mime text null,
  image_size_bytes integer null check (image_size_bytes is null or image_size_bytes > 0),
  extraction_provider text null,
  extraction_issues jsonb not null default '[]'::jsonb check (jsonb_typeof(extraction_issues) = 'array'),
  notes text null,
  created_at timestamptz not null default now(),
  published_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.menu_import_jobs
  drop constraint if exists menu_import_jobs_menu_version_id_fkey;
alter table public.menu_import_jobs
  add constraint menu_import_jobs_menu_version_id_fkey
  foreign key (menu_version_id) references public.menu_versions(id) on delete set null;

alter table public.menu_versions
  drop constraint if exists menu_versions_import_job_id_fkey;
alter table public.menu_versions
  add constraint menu_versions_import_job_id_fkey
  foreign key (import_job_id) references public.menu_import_jobs(id) on delete set null;

drop trigger if exists menu_import_jobs_set_updated_at on public.menu_import_jobs;
create trigger menu_import_jobs_set_updated_at
before update on public.menu_import_jobs
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists menu_versions_set_updated_at on public.menu_versions;
create trigger menu_versions_set_updated_at
before update on public.menu_versions
for each row
execute function public.set_updated_at_timestamp();

create index if not exists menu_import_jobs_created_at_idx on public.menu_import_jobs (created_at desc);
create index if not exists menu_import_jobs_status_idx on public.menu_import_jobs (status);
create index if not exists menu_versions_created_at_idx on public.menu_versions (created_at desc);
create index if not exists menu_versions_status_idx on public.menu_versions (status);
create unique index if not exists menu_versions_single_active_uidx
  on public.menu_versions (status)
  where status = 'active';

alter table public.menu_import_jobs enable row level security;
alter table public.menu_versions enable row level security;

revoke all on public.menu_import_jobs from anon;
revoke all on public.menu_import_jobs from authenticated;
revoke all on public.menu_versions from anon;
revoke all on public.menu_versions from authenticated;

grant select on public.menu_versions to anon;
grant select on public.menu_versions to authenticated;

drop policy if exists "public_can_select_active_menu_versions" on public.menu_versions;
create policy "public_can_select_active_menu_versions"
on public.menu_versions
for select
to anon, authenticated
using (status = 'active');

comment on table public.menu_import_jobs is
  'Jobs de importação de cardápio por imagem (upload/storage/processamento/publicação).';

comment on table public.menu_versions is
  'Versões de cardápio. Somente uma versão ativa é lida pelo app em produção.';

