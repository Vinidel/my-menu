alter table public.orders
add column fulfillment_type text null,
add column delivery_fee_cents integer null;

alter table public.orders
add constraint orders_fulfillment_type_check
check (
  fulfillment_type is null
  or fulfillment_type in ('retirada', 'entrega')
);

alter table public.orders
add constraint orders_delivery_fee_cents_check
check (
  delivery_fee_cents is null
  or delivery_fee_cents >= 0
);
