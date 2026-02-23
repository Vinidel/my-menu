-- Employee orders dashboard / customer order storage
-- Canonical statuses are locked by the brief:
--   aguardando_confirmacao -> em_preparo -> entregue

create extension if not exists pgcrypto;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'PED-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_name text not null check (btrim(customer_name) <> ''),
  customer_email text not null check (btrim(customer_email) <> ''),
  customer_phone text not null check (btrim(customer_phone) <> ''),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  status text not null default 'aguardando_confirmacao' check (
    status in ('aguardando_confirmacao', 'em_preparo', 'entregue')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at_timestamp();

create index if not exists orders_created_at_idx on public.orders (created_at asc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at asc);

alter table public.orders enable row level security;

-- Lock table access down, then grant the minimum needed to authenticated employees.
revoke all on public.orders from anon;
revoke all on public.orders from authenticated;

grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

drop policy if exists "authenticated_can_select_orders" on public.orders;
create policy "authenticated_can_select_orders"
on public.orders
for select
to authenticated
using (true);

drop policy if exists "authenticated_can_update_order_status" on public.orders;
create policy "authenticated_can_update_order_status"
on public.orders
for update
to authenticated
using (true)
with check (
  status in ('aguardando_confirmacao', 'em_preparo', 'entregue')
);

comment on table public.orders is
  'Pedidos do burger. Usado pelo dashboard de funcionários e fluxo de pedidos.';

comment on column public.orders.items is
  'Array JSON de itens do pedido (ex.: [{\"name\":\"X-Burger\",\"quantity\":2}]).';
