-- PGMQ wrappers for menu import worker flow

create or replace function public.menu_import_queue_enqueue(
  p_job_id uuid,
  p_version_id uuid
)
returns bigint
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.send(
    'menu-imports-queue',
    jsonb_build_object(
      'jobId', p_job_id,
      'versionId', p_version_id
    )
  );
$$;

create or replace function public.menu_import_queue_read(
  p_visibility_timeout_seconds integer default 60,
  p_limit integer default 1
)
returns table(
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language sql
security definer
set search_path = public, pgmq
as $$
  select
    r.msg_id,
    r.read_ct,
    r.enqueued_at,
    r.vt,
    r.message
  from pgmq.read('menu-imports-queue', p_visibility_timeout_seconds, p_limit) as r;
$$;

create or replace function public.menu_import_queue_delete(
  p_msg_id bigint
)
returns boolean
language sql
security definer
set search_path = public, pgmq
as $$
  select pgmq.delete('menu-imports-queue', p_msg_id);
$$;

grant execute on function public.menu_import_queue_enqueue(uuid, uuid) to service_role;
grant execute on function public.menu_import_queue_read(integer, integer) to service_role;
grant execute on function public.menu_import_queue_delete(bigint) to service_role;
