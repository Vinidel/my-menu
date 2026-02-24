alter table public.orders
add column payment_method text null;

alter table public.orders
add constraint orders_payment_method_check
check (
  payment_method is null
  or payment_method in ('dinheiro', 'pix', 'cartao')
);
