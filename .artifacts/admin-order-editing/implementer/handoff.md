# Stage Handoff

Feature: admin-order-editing
Stage: implementer
Workflow: full

---

## Files Changed
- `supabase/migrations/20260323100000_admin_order_edit_grants.sql` (new)
- `lib/order-submit-validation.ts` (new)
- `lib/orders.ts` (AdminOrderItem.menuItemId, parseOrderItemsWithTotal)
- `lib/admin-orders-data-access.ts` (UpdateAdminOrderPayload, updateAdminOrder)
- `lib/supabase/admin-orders-data-access.ts` (updateAdminOrder impl)
- `app/actions.ts` (refactored to use validateAndBuildOrderPayload)
- `app/admin/actions.ts` (updateOrder action, fulfillment+status validation)
- `app/admin/page.tsx` (pass menuItems to dashboard)
- `components/admin-orders-dashboard.tsx` (Editar button, AdminOrderEditSheet, menuItems prop)
- `components/admin-order-edit-sheet.tsx` (new)
- `docs/implementation-notes.md` (Admin Order Editing notes)

---

## What Changed
- **DB migration:** Extended `authenticated` grant on `orders` for customer_name, customer_email, customer_phone, payment_method, fulfillment_type, delivery_fee_cents, notes, items. Updated RLS policy to `using (is_deleted = false)`.
- **Shared validation:** `lib/order-submit-validation.ts` exports `validateAndBuildOrderPayload`; used by customer submit and admin edit.
- **Admin data access:** Added `updateAdminOrder` to update edit columns on non-deleted orders.
- **Admin action:** `updateOrder` with auth check, validation, fulfillment-vs-status constraint check (rejects retirada when saiu_para_entrega, entrega when pronto_para_retirada).
- **Admin UI:** "Editar pedido" button opens modal; form pre-filled from order, items editable (legacy items without menuItemId excluded), add items from menu, contact/payment/fulfillment/notes. Submit calls updateOrder.
- **Order parsing:** `menuItemId` added to AdminOrderItem when present in snapshot for edit form resolution.

---

## Known Gaps
- No in-form notice when legacy items are excluded (brief suggested as non-blocking).

---

## Evidence
- `npm run build` passes
- `npm run test` passes (208 tests)
- Happy paths manually verifiable: open order, click Editar, change fields, save
- Unhappy paths: invalid phone, empty items, fulfillment+status conflict (server rejects with pt-BR message)

---

## Next Review Focus
- Tester: acceptance scenarios from brief; admin edit flow tests
- Gate Keeper: package as stage-1-impl
