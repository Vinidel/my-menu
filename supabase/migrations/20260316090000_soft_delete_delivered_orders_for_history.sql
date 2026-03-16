-- Soft delete delivered orders for retained history.
-- Replaces hard deletion with soft deletion and keeps the existing cron entrypoint name
-- so previously scheduled jobs continue to invoke the updated behavior.

alter table public.orders
add column if not exists is_deleted boolean not null default false,
add column if not exists soft_deleted_at timestamptz;

comment on column public.orders.is_deleted is
  'Explicit soft-delete flag for active vs historical order filtering.';

comment on column public.orders.soft_deleted_at is
  'When non-null, the order is retained for history but excluded from operational admin order reads.';

alter table public.orders
drop constraint if exists orders_soft_delete_consistency_check;

alter table public.orders
add constraint orders_soft_delete_consistency_check
check (
  (is_deleted = false and soft_deleted_at is null)
  or
  (is_deleted = true and soft_deleted_at is not null)
);

create or replace function public.delete_entregue_orders_from_previous_day()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_soft_deleted integer;
begin
  -- Orders become eligible once they are older than the start of the current
  -- calendar day in America/Sao_Paulo. This lets the daily job catch up older
  -- delivered rows if one or more prior runs were missed.
  v_cutoff := (
    (now() at time zone 'America/Sao_Paulo')::date
    at time zone 'America/Sao_Paulo'
  );

  with updated as (
    update public.orders
    set is_deleted = true,
        soft_deleted_at = now()
    where is_deleted = false
      and soft_deleted_at is null
      and status = 'entregue'
      and updated_at < v_cutoff
    returning 1
  )
  select count(*)::integer from updated into v_soft_deleted;

  raise notice 'delete_entregue_orders_from_previous_day: % rows soft deleted', v_soft_deleted;
  return v_soft_deleted;
end;
$$;

comment on function public.delete_entregue_orders_from_previous_day() is
  'Soft deletes delivered orders older than the current America/Sao_Paulo calendar day by setting is_deleted = true and soft_deleted_at. Returns count of rows updated. Invoked by pg_cron daily.';
