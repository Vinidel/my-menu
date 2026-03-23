grant update (
  status,
  customer_name,
  customer_email,
  customer_phone,
  notes,
  payment_method,
  items
)
on public.orders to authenticated;
