# Feature Brief — Admin Edit Orders

Status: Stage 0 — Framing
Date: 2026-03-23
Author: Orchestrator Agent
Workflow: Full

---

## Workflow Routing Decision

Change type: feature
Workflow selected: Full
Reason:
- Scope: Adds authenticated admin write capabilities to existing order records, including new UI edit flow, validation, persistence guards, and concurrency handling.
- Risk: Medium/high. This mutates live order data and can affect fulfillment operations if validation or stale-update behavior is wrong.
- Blast radius: `/admin` dashboard UI, admin server actions/data access layer, Supabase update permissions/policies, and order parsing/display logic.
- Urgency: Normal.
- Required stages:
  - Orchestrator
  - Implementer
  - Tester
  - Hardener
  - Documenter
- Skipped stages and why:
  - None. This is a workflow-sensitive feature in an operational admin path and should run full staged delivery.

---

## Alternative Name

Editar pedido no `/admin` / Correção de dados do pedido por funcionários / Admin order correction workflow

---

## Problem

Today, admins can inspect orders and progress status, but cannot correct order details when customers send incomplete or incorrect information (for example typo in phone, missing e-mail, or notes that need clarification).

When corrections are needed, staff must rely on out-of-system workarounds. That creates operational friction, weakens data quality, and increases mismatch risk between what the team is preparing and what is recorded in the system.

Without a controlled edit flow in `/admin`, the dashboard is operationally incomplete for real-world order handling.

---

## Goal

Allow authenticated admins to edit safe order details directly in `/admin` with validation and stale-write protection, while preserving existing status progression and list/dashboard behavior.

Success = an admin opens an order, updates allowed fields, saves successfully with pt-BR feedback, and all admin views reflect the persisted update without breaking current fulfillment/status flows.

---

## Who

- **Employees (burger owner/staff):** Need to correct customer/order metadata during operations.
- **Customers (indirectly):** Benefit from fewer fulfillment/contact mistakes caused by stale or incorrect recorded details.
- **Developers/operators:** Need explicit edit boundaries and invariant protections so order mutations remain safe.

---

## What We Capture / Change

- **Admin UI (`/admin`):**
  - Add an edit mode in order details (desktop + mobile details parity).
  - Add save/cancel actions and in-flight/disabled states.
  - Show pt-BR success and failure messages.
- **Editable fields (locked for this feature):**
  - `customerName`
  - `customerPhone`
  - `customerEmail`
  - `notes`
  - `paymentMethod`
- **Explicitly not editable in this feature:**
  - ordered items (`items`), quantities, extras, removed ingredients
  - `status` progression model (existing progress action remains the only status write path)
  - `fulfillmentType` and `deliveryFeeCents`
- **Server/data-access:**
  - Add a dedicated authenticated admin update action for allowed fields only.
  - Enforce allowlist updates server-side (never trust client field list).
  - Protect against stale overwrite using `updated_at` compare semantics.
  - Reject edit load/save for non-operational rows (`is_deleted = true`).
  - Reuse existing server-authoritative normalization/validation rules for name, phone (BR), and e-mail.
- **Persistence/auth constraints:**
  - Extend DB update permissions/policies only to required editable columns for authenticated admins.
  - Keep anonymous/public clients unable to update orders.

---

## Success Criteria

- [ ] Authenticated admin can enter edit mode for an order in `/admin` and update only allowed fields.
- [ ] Save persists the edited values and refreshes admin list/details consistently.
- [ ] Cancel exits edit mode without persisting changes.
- [ ] UI prevents duplicate submission while save is pending.
- [ ] Server rejects updates that contain non-allowlisted fields.
- [ ] Stale edits (another admin updated first) are rejected safely with a clear pt-BR message and refreshed current values.
- [ ] Edit load/save rejects non-operational orders (`is_deleted = true`) with safe pt-BR feedback.
- [ ] Admin edit save reuses existing server-authoritative normalization/validation for `customer_name`, `customer_phone` (BR), and `customer_email`.
- [ ] Existing status progression flow and buttons remain unchanged and functional.
- [ ] Existing polling behavior does not discard a currently open local edit draft before user action (locked behavior below).
- [ ] Validation errors are shown in pt-BR and no internal details leak to users.
- [ ] All new user-facing labels/messages remain Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Editing ordered items, extras, quantities, or recalculating totals.
- Editing fulfillment type (`retirada`/`entrega`) or delivery fee.
- Editing status via free-form selection, rollback, or arbitrary jumps.
- Audit log UI/timeline for historical changes (deferred).
- Role split between owner and staff (all authenticated admins keep same permissions).
- Customer-facing notification when admin edits an order.

---

## Acceptance Scenarios

### Happy Paths

1. **Admin edits customer contact info.** In `/admin`, admin opens an order, enters edit mode, updates phone/e-mail, saves, and sees success feedback in pt-BR with updated details rendered.
2. **Admin edits notes only.** Admin edits the `Observações` value, saves, and list/details continue to load and render normally.
3. **Admin edits payment method correction.** Admin adjusts `paymentMethod` to a valid allowed value and save persists correctly.
4. **Mobile details parity.** On mobile accordion details, admin can perform the same edit flow with equivalent save/cancel behavior.
5. **Status progression remains stable after metadata save.** After a successful metadata edit, the existing forward-only status action still behaves correctly and reflects the current persisted status.

### Unhappy Paths

1. **Validation failure (required field).** Admin provides invalid required field input (for example blank name); save fails with pt-BR validation feedback and no persistence.
2. **Stale update conflict.** Admin A opens edit mode; Admin B saves first; Admin A save is rejected as stale, receives pt-BR conflict message, and UI reloads current persisted values.
3. **Unauthorized session.** Expired/invalid admin session attempting save gets auth error messaging and no update is applied.
4. **Disallowed field attempt.** A crafted request includes forbidden fields (`items`, `status`, `fulfillmentType`); server rejects safely.
5. **Invalid BR phone update.** Admin tries to save a phone value that violates existing BR phone normalization/validation rules; save fails with pt-BR validation feedback and no persistence.
6. **Invalid e-mail update.** Admin tries to save an invalid e-mail format; save fails with pt-BR validation feedback and no persistence.
7. **Non-operational order edit attempt.** Admin attempts to edit an order that is soft-deleted (`is_deleted = true`); system rejects safely and does not persist changes.
8. **Operational failure.** DB/service error during save returns safe generic pt-BR error; previous persisted values remain authoritative.

---

## Edge Cases

- **Polling while editing:** Auto-refresh must not silently overwrite an active local form draft; locked behavior below.
- **Optional notes:** Empty notes are allowed (stored as null/empty per existing conventions), with consistent rendering afterward.
- **Legacy rows with missing optional values:** Edit form should initialize safely even when optional fields are null/unknown.
- **Payment method unknown/null:** Form must handle null as selectable fallback and enforce only supported canonical values on save.
- **Whitespace normalization:** Inputs with leading/trailing spaces should normalize deterministically server-side.
- **Phone/e-mail normalization parity:** Admin edit validation must follow the same server rules used by customer submission paths to avoid split-brain data quality.
- **Concurrent status progression + edit:** If status changes while metadata edit is open, metadata save still must use stale-write protection and never regress status.
- **Soft-deleted rows:** Orders already marked `is_deleted = true` are non-operational and must not enter editable admin flow.

---

## Approach (High-Level Rationale)

1. **Constrained edit surface first.** Deliver high-value operational corrections by allowing metadata edits only, avoiding item/pricing mutation complexity.
2. **Server-authoritative allowlist.** Treat client form payload as untrusted; map and validate only locked editable fields on the server.
3. **Optimistic concurrency control.** Require stale-write detection (using `updated_at` snapshot) so one admin cannot unknowingly overwrite another admin’s recent changes.
4. **Preserve existing fulfillment flow.** Keep status progression contract and fulfillment-specific status logic untouched.
5. **Keep UI predictable under polling.** Protect active edit draft from background refresh churn, then reconcile after save/cancel.

---

## Decisions (Locked)

- **Workflow depth:** Full workflow required.
- **Editable field allowlist (locked):** `customer_name`, `customer_phone`, `customer_email`, `notes`, `payment_method` only.
- **Non-editable fields (locked):** `items`, `status`, `fulfillment_type`, `delivery_fee_cents`, `reference`, timestamps.
- **Status editing policy:** Status remains editable only through the existing forward-only progress action.
- **Concurrency policy (locked):** Save requires stale-write guard using current persisted `updated_at`; conflicts are rejected and surfaced in pt-BR.
- **Polling + draft policy (locked):** While an order is in edit mode with unsaved changes, polling must not auto-apply incoming field updates into that active draft.
- **Validation policy:** Reuse existing server-authoritative normalization/validation rules for `customer_name`, `customer_phone` (BR), and `customer_email`; payment method must be one of canonical values or null where allowed by schema.
- **Operational-row policy (locked):** Edit load/save applies only to operational rows; if `is_deleted = true`, the order is non-editable and save attempts are rejected safely.
- **Auth boundary:** Only authenticated admin path can update order fields; public/anon paths remain read/insert-only as currently defined.
- **Boundary consistency:** Keep using the existing `admin/orders` data-access boundary and provider-agnostic app-layer client entrypoints; do not introduce new direct provider-specific imports in app-layer admin routes/actions/components.
- **Language:** All employee-facing copy remains pt-BR.
- **Migration filenames:** Any new Supabase migration uses full timestamp prefix (`YYYYMMDDHHMMSS_*`).

---

## Security / Operational Constraints

- Enforce field allowlist and validation on server action/data-access boundary, not only in UI.
- Reject crafted payload attempts to mutate forbidden columns.
- Keep auth/session checks mandatory before updates.
- Do not leak raw DB errors to admin UI; log server-side with context.
- Treat soft-deleted (`is_deleted = true`) orders as non-operational for admin edit load/save paths.
- Preserve compatibility with current admin polling and status progression behavior.

---

## Stage 0 Exit Gate

- [x] Workflow routing decision is explicit and justified
- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Major security and operational constraints are surfaced when relevant
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
