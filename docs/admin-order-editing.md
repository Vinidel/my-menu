# Admin Order Editing — Feature Documentation

Summary for the next engineer: what was built, where it lives, what is locked by the brief, and how to operate the edit flow safely.

**Brief:** [docs/briefs/admin-order-editing.md](briefs/admin-order-editing.md)

---

## What Was Delivered

- **Employee edit flow in `/admin`:** Employees can open an order edit sheet from the order details UI and update customer-editable fields.
- **Editable fields (per brief scope):** items (add/remove + quantity + extras/removals), `nome`, `telefone`, `e-mail`, payment method, fulfillment type, and notes.
- **Server-authoritative validation + snapshots:** The server rebuilds item snapshots (name, pricing cents, extras/removal snapshots) using the *current active menu*; the client only sends ids/quantities/customization selections.
- **Runtime menu parity between customer and admin:** `/admin` uses the same menu source as `/` (active `menu_versions` with fallback), so `menuItemId` resolution matches what was used to place the order.
- **RLS / grants for edit writes:** Supabase policy + grant extensions allow authenticated employees to update the edit columns while still enforcing `is_deleted = false`.
- **Deterministic handling for legacy/unknown items:**  
  - Legacy lines without `menuItemId` are not shown in the editable list.  
  - Lines whose `menuItemId` no longer exists in the active menu are displayed as “Item fora do cardápio atual” and must be removed/replaced before save; server rejects unknown items.
- **Item removal controls:** Admin can remove items using `Remover item` or by setting quantity to `0` (client removes the line; server enforces empty-items rejection).

---

## Where It Lives

- Edit sheet UI: `components/admin-order-edit-sheet.tsx`
- Admin server action (`updateOrder`): `app/admin/actions.ts`
- Admin update data access: `lib/admin-orders-data-access.ts`, `lib/supabase/admin-orders-data-access.ts`
- Shared validation + snapshot derivation: `lib/order-submit-validation.ts`
- Orders parsing (`menuItemId`): `lib/orders.ts`
- `/admin` menu source parity: `app/admin/page.tsx` (+ tests)
- Supabase migration (grants/policy): `supabase/migrations/20260323100000_admin_order_edit_grants.sql`
- Tests covering updateOrder edit flow: `app/admin/actions.test.ts`

---

## Decisions (Locked)

- **Edit scope:** Admin can edit the customer-editable fields: `items`, `customer_name`, `customer_email`, `customer_phone`, `payment_method`, `fulfillment_type`, `notes`. Delivery fee is derived from fulfillment type.
- **Status:** Edit flow does not change order status; existing status progression controls remain the only path to mutate status.
- **Validation authority:** Same rule set as customer submit. Server validates `menuItemId`, extras, removals, and contact field lengths. Server derives item snapshots from the current menu.
- **Items no longer in menu:** If the edit payload contains items whose `menuItemId` no longer exists in the active menu, the server rejects the edit with a pt-BR validation error.
- **Legacy items without `menuItemId`:** Legacy lines without `menuItemId` are excluded from the editable list. If an admin saves without re-adding them, those legacy-only items are dropped from the updated order.
- **Fulfillment-type vs status constraints:**  
  - When status is `saiu_para_entrega`, server rejects fulfillment change to `retirada`.  
  - When status is `pronto_para_retirada`, server rejects fulfillment change to `entrega`.
- **Auth:** Update path requires an authenticated Supabase session (employee login). No public access.

---

## Operational Contract (How It Behaves)

### Save / update path

- Client submits an edit payload via `updateOrder`.
- Server:
  - Auth-checks session.
  - Loads the current order status snapshot (to enforce fulfillment-vs-status constraints).
  - Loads the current active menu and validates/rebuilds item snapshots (`validateAndBuildOrderPayload`).
  - Updates the order via authenticated Supabase client (RLS applies) through `updateAdminOrder`.

### Item removal

- If the admin removes a line via `Remover item`, the line is removed from the client state before submit.
- If the admin sets quantity to `0`, the UI removes the line as well.
- Server still rejects saves if the final `items` list is empty (same as customer submit behavior).

### Unknown / legacy item UX

- **Unknown menuItemId (“Item fora do cardápio atual”):** shown when the snapshot `menuItemId` no longer exists in the active menu.
- Admin must remove or replace unknown lines before saving; server will reject unknown items if they remain in the payload.
- **Legacy-only lines (no menuItemId):** excluded from the editable list; they are not revalidated on the client.

---

## Setup / Rollout Notes

- **Run the Supabase migration:**  
  - `supabase/migrations/20260323100000_admin_order_edit_grants.sql`  
  - This adds update grants and ensures edit writes are restricted to `is_deleted = false`.
- **Ensure runtime menu reads work in production:**
  - `/` and `/admin` both use runtime menu loading from `menu_versions` with fallback.
  - If `SUPABASE_SERVICE_ROLE_KEY` is missing/misconfigured, both paths can fall back to `data/menu.json`, which may cause menu drift symptoms (unknown-item labels) when order snapshots were created from a different active menu.

---

## Testing

- `npm test` passes after implementing the edit flow.
- `app/admin/actions.test.ts` includes coverage for `updateOrder`:
  - Valid edit happy path
  - Invalid phone rejection
  - Empty-items rejection
  - Fulfillment-type vs status conflict rejection
  - Unauthenticated session rejection

---

## Known Gaps & Deferred Work

- **Optional UX improvement:** When server rejects unknown menu items, the UI currently surfaces the server validation message. A more explicit pt-BR “remove/replace these lines” instruction in the edit sheet could reduce confusion.
- **`customer_id` re-linking:** Updating contact snapshot fields does not currently re-match `customer_id` when contact changes. Snapshot fields are updated, but the foreign-key link may remain as stored. (Allowed by the brief; deferred.)
- **No audit log / revision history:** Out of scope for this feature.

---

## For the Next Engineer

- If menu JSON / menu item shape changes, update the shared snapshot building in `lib/order-submit-validation.ts` and the parsing in `lib/orders.ts`.
- Keep `/admin` menu parity aligned with `/` so `menuItemId` resolution stays consistent end-to-end.
- If you change legacy/unknown item handling, update both:
  - `AdminOrderEditSheet` initial state behavior (`initialLines`)
  - Server validation rules (which remain the final authority).

---

## Rollback / Safety Notes

- Code rollback is safe, but the Supabase migration changes grants/policy. A full rollback would require reverting the migration and related policy/grant changes (not covered by this feature doc).
