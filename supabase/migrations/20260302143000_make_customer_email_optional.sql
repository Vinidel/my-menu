-- Make customer e-mail optional for order submission while preserving deterministic dedupe.

alter table public.orders
  alter column customer_email drop not null;

update public.orders
set customer_email = null
where customer_email is not null
  and btrim(customer_email) = '';

alter table public.orders
  drop constraint if exists orders_customer_email_check;

alter table public.orders
  add constraint orders_customer_email_optional_check check (
    customer_email is null or btrim(customer_email) <> ''
  );

alter table public.customers
  alter column email drop not null,
  alter column email_normalized drop not null;

update public.customers
set email = null
where email is not null
  and btrim(email) = '';

update public.customers
set email_normalized = null
where email_normalized is not null
  and btrim(email_normalized) = '';

update public.customers
set email = null
where email_normalized is null;

update public.customers
set email_normalized = null
where email is null;

alter table public.customers
  drop constraint if exists customers_email_check;

alter table public.customers
  drop constraint if exists customers_email_normalized_check;

alter table public.customers
  add constraint customers_email_optional_check check (
    email is null or btrim(email) <> ''
  );

alter table public.customers
  add constraint customers_email_normalized_optional_check check (
    email_normalized is null or btrim(email_normalized) <> ''
  );

alter table public.customers
  drop constraint if exists customers_email_pair_consistency_check;

alter table public.customers
  add constraint customers_email_pair_consistency_check check (
    (email is null and email_normalized is null)
    or (email is not null and email_normalized is not null)
  );

drop index if exists customers_email_phone_normalized_uidx;

create unique index if not exists customers_email_phone_normalized_present_uidx
  on public.customers (email_normalized, phone_normalized)
  where email_normalized is not null;

create unique index if not exists customers_phone_normalized_email_missing_uidx
  on public.customers (phone_normalized)
  where email_normalized is null;

