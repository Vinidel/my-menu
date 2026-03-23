# Stage Handoff

Feature: admin-order-editing
Stage: implementer
Workflow: full

---

## Files Changed

- `app/admin/actions.ts`
- `app/admin/actions.test.ts`
- `components/admin-orders-dashboard.tsx`
- `components/admin-orders-dashboard.test.tsx`
- `lib/admin-orders-data-access.ts`
- `lib/supabase/admin-orders-data-access.ts`
- `lib/supabase/admin-orders-data-access.test.ts`
- `lib/admin-orders-query.ts`
- `lib/orders.ts`
- `app/actions.ts`
- `lib/customer-contact.ts`
- `supabase/migrations/20260323173000_allow_admin_order_metadata_edits.sql`
- `docs/implementation-notes.md`

---

## What Changed

Implemented Stage 1 for admin order editing within approved brief scope:

- Added new authenticated server action `updateOrderDetails` in `app/admin/actions.ts`.
  - Enforces allowlisted editable fields only (`customer_name`, `customer_phone`, `customer_email`, `notes`, `payment_method`, `items`).
  - Reuses server-authoritative contact validation/normalization (name/e-mail/BR phone).
  - Uses stale-write guard via `expectedUpdatedAt` and `updated_at` conditional update.
  - Rejects non-operational rows (`is_deleted = true`) through active-row lookups/updates.
  - Handles unhappy paths with pt-BR messages (validation/auth/stale/unknown).

- Extended `admin/orders` data-access boundary.
  - Added active-row `getAdminOrderById` and `getAdminOrderEditSnapshot` methods.
  - Added `updateAdminOrderDetailsConditionally` with `id + updated_at + is_deleted=false` optimistic update shape.
  - Kept provider-specific implementation in Supabase adapter and app-layer boundary intact.

- Added UI edit mode to `/admin` details in `components/admin-orders-dashboard.tsx`.
  - Added `Editar pedido`, `Salvar alterações`, `Cancelar` flow in desktop + mobile details.
  - Edit form fields: Nome, Telefone, E-mail, Forma de pagamento, Observações.
  - Added item-level editing controls (quantity input) and line removal action during edit mode.
  - Save/cancel/in-flight behavior and pt-BR feedback banners.
  - Preserved existing status progression action and behavior.
  - Prevented polling from overwriting active local draft by preserving current row while editing.

- Added shared contact helpers in `lib/customer-contact.ts` and reused them from customer submission (`app/actions.ts`) and admin edit action (`app/admin/actions.ts`) so server-side rules stay aligned.

- Added migration `20260323173000_allow_admin_order_metadata_edits.sql` to grant authenticated updates for newly editable metadata columns.

- Logged unrelated lint warning in `docs/implementation-notes.md`.

---

## Known Gaps

- Stage 2 tests are not part of this handoff; only Stage 1 implementation + targeted verification is included.
- Existing unrelated lint warning in `components/customer-order-page.tsx` remains out of scope and logged.

---

## Evidence

- Targeted tests passed:
  - `npm run test -- app/admin/actions.test.ts lib/supabase/admin-orders-data-access.test.ts components/admin-orders-dashboard.test.tsx`
  - Result: 57 tests passed.
- Lint executed:
  - `npm run lint`
  - Result: passes with one pre-existing warning logged in implementation notes.

---

## Next Review Focus

1. Critic: verify Stage 1 implementation matches brief lock decisions (allowlist fields, stale guard, non-operational row rejection, validation parity, polling draft protection).
2. Tester: expand from targeted tests to full Stage 2 acceptance coverage based on brief scenarios.
3. Hardener: evaluate migration/policy posture and concurrent edit/status interactions under polling.
