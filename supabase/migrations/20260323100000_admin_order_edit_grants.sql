-- Admin Order Editing: extend authenticated grant to allow update of customer-editable columns
-- Brief: docs/briefs/admin-order-editing.md

-- Grant update on edit columns (in addition to existing status grant)
grant update (
  customer_name,
  customer_email,
  customer_phone,
  payment_method,
  fulfillment_type,
  delivery_fee_cents,
  notes,
  items
) on public.orders to authenticated;

-- Replace policy to restrict updates to non-deleted orders only
drop policy if exists "authenticated_can_update_order_status" on public.orders;
create policy "authenticated_can_update_order_status"
on public.orders
for update
to authenticated
using (is_deleted = false)
with check (
  status in (
    'aguardando_confirmacao',
    'em_preparo',
    'pronto_para_retirada',
    'saiu_para_entrega',
    'entregue'
  )
);
