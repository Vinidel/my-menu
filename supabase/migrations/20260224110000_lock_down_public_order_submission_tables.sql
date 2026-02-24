-- Harden customer order submission after moving writes to server-only /api/orders (service role).
-- Public clients should no longer read/write customers directly or insert orders directly.

revoke select, insert on public.customers from anon;
revoke select, insert on public.customers from authenticated;

drop policy if exists "public_can_select_customers_for_dedupe" on public.customers;
drop policy if exists "public_can_insert_customers" on public.customers;

revoke insert on public.orders from anon;
revoke insert on public.orders from authenticated;

drop policy if exists "public_can_insert_orders" on public.orders;
