-- Link orders to customers and allow public order creation (customer flow on /)

alter table public.orders
  add column if not exists customer_id uuid null references public.customers(id) on delete set null;

create index if not exists orders_customer_id_idx on public.orders (customer_id);

grant insert (customer_id, customer_name, customer_email, customer_phone, items, status, notes)
  on public.orders to anon;
grant insert (customer_id, customer_name, customer_email, customer_phone, items, status, notes)
  on public.orders to authenticated;

drop policy if exists "public_can_insert_orders" on public.orders;
create policy "public_can_insert_orders"
on public.orders
for insert
to anon, authenticated
with check (
  customer_id is not null
  and btrim(customer_name) <> ''
  and btrim(customer_email) <> ''
  and btrim(customer_phone) <> ''
  and jsonb_typeof(items) = 'array'
  and status = 'aguardando_confirmacao'
);

comment on column public.orders.customer_id is
  'Vínculo opcional com public.customers. Nulo apenas para pedidos legados.';
