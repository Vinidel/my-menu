---
# Critique

Date: 2026-03-23
Reviewed by: Critic Agent
Scope: Admin Order Editing — implementation (Stage 1) vs `docs/briefs/admin-order-editing.md`, `PROJECT.md`, `.artifacts/admin-order-editing/implementer/handoff.md`
Verdict: APPROVE

## Findings

### Required Changes

None. The implementation matches the locked brief on the dimensions checked below:

- **Shared validation & snapshots:** `lib/order-submit-validation.ts` + `validateAndBuildOrderPayload` used by customer submit and `updateOrder` (`app/admin/actions.ts`). Evidence: `app/actions.ts`, `app/admin/actions.ts`.
- **Authenticated write path (RLS):** `updateOrder` uses `createRequestClient()` and `updateAdminOrder` on the user-scoped client — not service role for the order write. Evidence: `app/admin/actions.ts`, `lib/supabase/admin-orders-data-access.ts`.
- **DB grants / policy:** Migration extends `UPDATE` on edit columns and keeps `is_deleted = false` via policy. Evidence: `supabase/migrations/20260323100000_admin_order_edit_grants.sql`.
- **Fulfillment vs status:** Server rejects conflicting fulfillment changes when status is `saiu_para_entrega` or `pronto_para_retirada`. Evidence: `app/admin/actions.ts` (matches brief Unhappy Path #6 / Decisions).
- **Menu parity with customer flow:** `/admin` loads menu via `getRuntimeMenuItems()` and `updateOrder` validates with `getRuntimeMenuItemMap()` — aligned with `/` (`app/page.tsx`) so `menuItemId` resolution matches order submission. Evidence: `app/admin/page.tsx`, `app/admin/actions.ts`, `lib/menu-runtime.ts`. This addresses the prior mismatch where admin used only `data/menu.json`.
- **Legacy items:** Items without resolvable `menuItemId` are excluded from initial edit state per Decisions; server rebuilds snapshots from validated payload.

---

### Suggested Improvements

1. **Automated tests (Tester stage):** There are no Vitest tests targeting `updateOrder` or `AdminOrderEditSheet`. `PROJECT.md` calls for tests derived from acceptance scenarios; the implementer handoff points Tester at brief scenarios. Add tests for at least: successful edit, invalid phone, empty items, fulfillment+status conflict, unauthenticated rejection pattern (if testable without full E2E).

2. **Legacy-only orders UX:** Handoff notes missing in-form notice when legacy lines are excluded. Brief Decisions allow drop-on-save; a short pt-BR warning would reduce surprise (non-blocking).

3. **RLS policy name:** Policy remains named `authenticated_can_update_order_status` while it now governs broader column updates — consider a rename in a follow-up migration for clarity (maintenance only).

4. **Documentation drift:** Brief says “same menu JSON as customer flow”; implementation correctly uses runtime menu (DB active version + fallback). Consider a one-line clarification in `docs/implementation-notes.md` or brief addendum so future readers do not revert admin to static-only `getMenuItems()`.

5. **`customer_id` on contact edit:** `updateAdminOrder` does not update `customer_id` when name/email/phone change. Brief Decisions allow re-match or clear; current behaviour leaves FK unchanged while snapshot fields update — acceptable but worth documenting in implementation notes for operators (risk of stale link to `customers` row).

---

### Risks / Assumptions

- **Service role dependency for menu resolution:** `getRuntimeMenuItems` / `getRuntimeMenuItemMap` use `createServiceRoleClient()` to read `menu_versions`. If `SUPABASE_SERVICE_ROLE_KEY` is missing or misconfigured in an environment, both paths fall back to `getMenuItems()` (`data/menu.json`). If only the DB-backed menu is published and env is broken, customer and admin both degrade together — but a partial misconfiguration could still theoretically diverge; worth monitoring in deployment checklists.

- **Concurrent edits:** Brief locks “last write wins”; no optimistic locking — acceptable for scale per `PROJECT.md`.

- **Polling + edit sheet:** Admin dashboard polls orders; an open edit form could show stale order metadata if another session saved — acceptable for initial scope; Hardener may note UX edge case.

---

## Acceptance Criteria

Use before advancing Tester / Hardener (verify against running app and repo):

- [x] Admin can open edit flow from `/admin` and save changes to contact, items, payment, fulfillment, notes.
- [x] Server validates with same payload path as customer submit; snapshots derived server-side.
- [x] Fulfillment-type conflicts with status return pt-BR errors.
- [x] Order update uses authenticated Supabase client (not privileged) for the `orders` write.
- [x] Menu used for admin edit matches customer runtime menu (`getRuntimeMenuItems` / `getRuntimeMenuItemMap`).
- [ ] Vitest coverage for `updateOrder` and/or edit UI (recommended for Tester gate).
- [ ] Optional: legacy exclusion notice; docs note on `customer_id` behaviour.

---
