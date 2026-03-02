# Feature Brief — E-mail Opcional no Pedido

Status: Stage 5 — Documentation Complete (pending Critic)
Date: 2026-03-02
Author: Orchestrator Agent

---

## Alternative Name

Checkout sem e-mail obrigatório / Pedido com contato por telefone obrigatório

---

## Problem

Today, customer order submission requires `nome`, `e-mail`, and `telefone`. In real usage, some customers do not want to provide e-mail or do not have one available at order time.

Because e-mail is mandatory, valid orders are being blocked even when phone contact is present, increasing friction and drop-off.

---

## Goal

Make customer e-mail optional in the order flow while preserving reliable contact and safe data handling.

Success = customer can submit an order with only `nome + telefone + forma de pagamento + itens`, server still validates format when e-mail is provided, and admin/order history continues to work with legacy and new rows.

---

## Who

- **Customers (public users):** Can complete checkout without e-mail.
- **Employees (burger owner/staff):** Continue seeing contact info in `/admin`, including explicit fallback when e-mail is absent.
- **Developers/operators:** Need schema + validation + dedupe behavior that remains backward compatible.

---

## What We Capture / Change

- **Customer checkout UI (`/`):**
  - `E-mail` field becomes optional (label/placeholder/validation copy updated in pt-BR).
  - Required-fields validation message no longer blocks on empty e-mail.
- **Server submit validation (`/api/orders` + `app/actions.ts`):**
  - Accept empty e-mail.
  - Keep format validation for non-empty e-mail values.
- **Persistence schema (Supabase):**
  - Allow nullable e-mail storage for new orders/customers using canonical `NULL` for missing values.
  - Keep legacy rows compatible.
  - Add/adjust uniqueness strategy for `public.customers` to safely support both dedupe modes under concurrency.
- **Customer dedupe behavior:**
  - When e-mail is present: dedupe by normalized `(email, phone)` (existing behavior).
  - When e-mail is absent: dedupe by normalized `phone` only.
- **Admin display (`/admin`):**
  - Missing e-mail displays deterministic pt-BR fallback (`Não informado`).

---

## Success Criteria

- [ ] Checkout allows submission without filling `E-mail`.
- [ ] Client-side required validation enforces only: `nome`, `telefone`, `forma de pagamento`, and at least one item.
- [ ] If e-mail is provided, invalid formats are rejected with pt-BR validation message.
- [ ] Server accepts empty e-mail and still rejects invalid non-empty e-mail values.
- [ ] New rows in `public.orders` and `public.customers` can be persisted without e-mail.
- [ ] Customer dedupe works for both flows: `(email+phone)` when e-mail exists, `phone` when e-mail is absent.
- [ ] `/admin` renders missing e-mail safely as `Não informado`.
- [ ] Legacy orders/customers with non-empty e-mail remain fully compatible.
- [ ] All new/updated user-facing text remains Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Making phone optional.
- Changing employee login/auth flows.
- Adding customer accounts.
- Backfilling/rewriting historical customer e-mails.
- Building advanced customer identity resolution beyond the locked dedupe rules.

---

## Acceptance Scenarios

### Happy Paths

1. **Submit without e-mail:** Customer fills name/phone/payment/items, leaves e-mail empty, submits successfully.
2. **Submit with valid e-mail:** Customer provides valid e-mail and order succeeds as usual.
3. **Admin view without e-mail:** Employee opens `/admin` order details and sees `E-mail: Não informado`.
4. **Dedupe without e-mail:** Two orders from same normalized phone and no e-mail reuse the same customer row.
5. **Phone-only customer upgraded later:** Customer first submits without e-mail, then submits with valid e-mail on the same normalized phone; existing customer row is upgraded with e-mail (no duplicate customer row).

### Unhappy Paths

1. **Invalid non-empty e-mail:** Customer enters malformed e-mail; submission is rejected with pt-BR validation.
2. **Missing required phone:** Customer omits phone; submission is rejected as before.
3. **Tampered payload e-mail type/value:** API receives invalid e-mail shape; request is rejected safely.
4. **Legacy compatibility:** Existing rows with mandatory e-mail assumptions still render without runtime errors.
5. **Concurrent phone-only submits:** Simultaneous no-e-mail submissions with same normalized phone do not create duplicate customer rows.

---

## Edge Cases

- E-mail with only whitespace should be normalized as empty.
- Case-insensitive e-mail normalization still applies when e-mail is present.
- Existing customer row created without e-mail should still match later no-e-mail submits by phone.
- If a later order provides e-mail for a phone-only customer, behavior should remain deterministic and avoid duplicate-customer explosions.

---

## Approach (High-Level Rationale)

1. **Validation contract update first:** Relax required-field checks for e-mail in client and server while retaining optional format validation.
2. **Schema migration for optional e-mail:** Update `orders` and `customers` columns/check constraints so empty/null e-mail is valid for new writes.
3. **Deterministic dedupe branching:** Keep current `(email+phone)` dedupe when e-mail exists, and use `phone` fallback path when absent.
4. **Identity upgrade path:** If a phone-only customer later submits with e-mail, update that existing customer row to store normalized e-mail rather than creating a second customer row.
5. **Defensive admin rendering:** Display fallback label for absent e-mail instead of blank/null.
6. **Test coverage from scenarios:** Add/adjust tests for optional flow, invalid non-empty e-mail, dedupe fallback, phone-only upgrade, concurrency behavior, and admin rendering.

---

## Decisions (Locked)

- **Customer e-mail requirement:** `E-mail` is optional for order submission.
- **Still required:** `nome`, `telefone`, `forma de pagamento`, and at least one item.
- **Validation rule (locked):**
  - Empty e-mail is allowed.
  - Non-empty e-mail must pass existing basic format validation.
- **Normalization rule (locked):**
  - E-mail: trim + lowercase when provided; otherwise `null`.
  - Phone: trim + digits-only (required).
- **Canonical missing-email storage (locked):**
  - Missing/blank e-mail is persisted as `NULL` (never as empty string) for:
    - `public.orders.customer_email`
    - `public.customers.email`
    - `public.customers.email_normalized`
- **Dedupe rule (locked):**
  - With e-mail: match by `(email_normalized, phone_normalized)`.
  - Without e-mail: match by `phone_normalized`.
- **Customer uniqueness/index strategy (locked):**
  - Enforce uniqueness for e-mail-present customers with a partial unique index on `(email_normalized, phone_normalized)` where `email_normalized is not null`.
  - Enforce uniqueness for phone-only customers with a partial unique index on `phone_normalized` where `email_normalized is null`.
  - Server find-or-create path must handle race conflicts (`23505`) by re-selecting using the matching dedupe rule.
- **Phone-only to email upgrade behavior (locked):**
  - When a submit includes e-mail and an existing phone-only customer (`same phone_normalized`, `email_normalized is null`) exists, update that row with the new e-mail/e-mail_normalized.
  - Do not create a second customer row for that transition.
  - After upgrade, subsequent dedupe follows `(email_normalized, phone_normalized)`.
- **Persistence rule (locked):**
  - `public.orders.customer_email` may be null.
  - `public.customers.email` and `public.customers.email_normalized` may be null.
- **Admin fallback label (locked):** `Não informado`.
- **Language:** All new user-facing strings/messages remain pt-BR.
- **Migration naming:** New Supabase migrations must use full timestamps (`YYYYMMDDHHMMSS_*`).

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
