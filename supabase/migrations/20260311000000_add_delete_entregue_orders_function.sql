-- Recurring deletion of delivered orders (delete-orders feature)
-- Deletes orders with status 'entregue' from the previous calendar day (America/Sao_Paulo).
-- Invoked by pg_cron daily at 03:05 UTC (00:05 BRT).

create or replace function public.delete_entregue_orders_from_previous_day()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_deleted integer;
begin
  -- Previous calendar day in America/Sao_Paulo (half-open interval [start, end))
  -- Use now() to derive date in Brazil timezone; avoids session-timezone dependence.
  v_start := (
    ((now() at time zone 'America/Sao_Paulo')::date - interval '1 day')::date
    at time zone 'America/Sao_Paulo'
  );
  v_end := v_start + interval '1 day';

  with deleted as (
    delete from public.orders
    where status = 'entregue'
      and updated_at >= v_start
      and updated_at < v_end
    returning 1
  )
  select count(*)::integer from deleted into v_deleted;

  raise notice 'delete_entregue_orders_from_previous_day: % rows deleted', v_deleted;
  return v_deleted;
end;
$$;

comment on function public.delete_entregue_orders_from_previous_day() is
  'Deletes orders with status entregue from the previous calendar day (America/Sao_Paulo). Returns count of deleted rows. Invoked by pg_cron daily.';

-- Cron schedule: configure via Supabase Dashboard or SQL editor after migration.
-- Run: SELECT cron.schedule('delete-entregue-orders-daily', '5 3 * * *', 'SELECT public.delete_entregue_orders_from_previous_day()');
-- 03:05 UTC = 00:05 BRT. To disable: SELECT cron.unschedule('delete-entregue-orders-daily');
