-- Harden status integrity: enforce forward-only transitions in the database.
-- Allowed progression:
--   aguardando_confirmacao -> em_preparo -> entregue
-- No reverse transitions, no jumps, no unknown statuses.

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Only enforce when the status actually changes.
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'aguardando_confirmacao' and new.status = 'em_preparo' then
    return new;
  end if;

  if old.status = 'em_preparo' and new.status = 'entregue' then
    return new;
  end if;

  raise exception using
    errcode = '23514',
    message = format(
      'Transição de status inválida para pedido %s: %s -> %s',
      old.id,
      coalesce(old.status, '<null>'),
      coalesce(new.status, '<null>')
    );
end;
$$;

drop trigger if exists orders_enforce_status_transition on public.orders;
create trigger orders_enforce_status_transition
before update on public.orders
for each row
execute function public.enforce_order_status_transition();

comment on function public.enforce_order_status_transition() is
  'Impede transições de status fora do fluxo aguardando_confirmacao -> em_preparo -> entregue.';
