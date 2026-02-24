-- Customer tracking for public order submissions
-- Uses normalized email+phone for dedupe (trim/lowercase email, digits-only phone).

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  email text not null check (btrim(email) <> ''),
  phone text not null check (btrim(phone) <> ''),
  email_normalized text not null check (btrim(email_normalized) <> ''),
  phone_normalized text not null check (btrim(phone_normalized) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at_timestamp();

create unique index if not exists customers_email_phone_normalized_uidx
  on public.customers (email_normalized, phone_normalized);

create index if not exists customers_created_at_idx on public.customers (created_at asc);

alter table public.customers enable row level security;

revoke all on public.customers from anon;
revoke all on public.customers from authenticated;

grant select, insert on public.customers to anon;
grant select, insert on public.customers to authenticated;

drop policy if exists "public_can_select_customers_for_dedupe" on public.customers;
create policy "public_can_select_customers_for_dedupe"
on public.customers
for select
to anon, authenticated
using (true);

drop policy if exists "public_can_insert_customers" on public.customers;
create policy "public_can_insert_customers"
on public.customers
for insert
to anon, authenticated
with check (
  btrim(name) <> ''
  and btrim(email) <> ''
  and btrim(phone) <> ''
  and btrim(email_normalized) <> ''
  and btrim(phone_normalized) <> ''
);

comment on table public.customers is
  'Clientes identificados por contato para reaproveitamento em novos pedidos.';
