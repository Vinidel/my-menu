alter table public.orders
drop constraint if exists orders_status_check;

alter table public.orders
add constraint orders_status_check
check (
  status in (
    'aguardando_confirmacao',
    'em_preparo',
    'pronto_para_retirada',
    'saiu_para_entrega',
    'entregue'
  )
);

alter table public.orders
drop constraint if exists orders_ready_for_pickup_status_matches_fulfillment_check;

alter table public.orders
add constraint orders_ready_for_pickup_status_matches_fulfillment_check
check (
  status <> 'pronto_para_retirada'
  or fulfillment_type is distinct from 'entrega'
);

drop policy if exists "authenticated_can_update_order_status" on public.orders;
create policy "authenticated_can_update_order_status"
on public.orders
for update
to authenticated
using (true)
with check (
  status in (
    'aguardando_confirmacao',
    'em_preparo',
    'pronto_para_retirada',
    'saiu_para_entrega',
    'entregue'
  )
);

create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'aguardando_confirmacao' and new.status = 'em_preparo' then
    return new;
  end if;

  if old.status = 'em_preparo' and old.fulfillment_type = 'entrega' and new.status = 'saiu_para_entrega' then
    return new;
  end if;

  if old.status = 'em_preparo' and old.fulfillment_type is distinct from 'entrega' and new.status = 'pronto_para_retirada' then
    return new;
  end if;

  if old.status = 'pronto_para_retirada' and old.fulfillment_type is distinct from 'entrega' and new.status = 'entregue' then
    return new;
  end if;

  if old.status = 'saiu_para_entrega' and old.fulfillment_type = 'entrega' and new.status = 'entregue' then
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

comment on function public.enforce_order_status_transition() is
  'Impede transições de status fora do fluxo aguardando_confirmacao -> em_preparo -> pronto_para_retirada -> entregue para retirada/legado e aguardando_confirmacao -> em_preparo -> saiu_para_entrega -> entregue para entrega.';
