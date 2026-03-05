# Feature Brief — Customer Menu Phone Display + BR Phone Mask/Validation

Status: Stage 0 — Framing  
Date: 2026-03-05  
Author: Orchestrator Agent

---

## Alternative Name

Contato rápido no cardápio / Telefone BR com máscara no checkout

---

## Problem

Two related gaps exist in the customer experience:

1. The menu page does not clearly show the burger place phone number as a direct contact option.
2. Customer phone input accepts loosely formatted values, which can reduce order contact reliability.

This creates friction both for customers (contact discoverability) and operations (follow-up calls/messages with invalid numbers).

---

## Goal

Add the burger place phone number to the customer menu page and enforce a Brazilian phone UX in checkout through input masking plus server-side validation.

---

## Who

- **Customers:** need a visible contact number and a guided phone input format.
- **Owner/Employees:** need reliable customer phone numbers for confirmation/contact.
- **Developers:** need deterministic phone handling rules across UI and API.

---

## What We Capture / Change

- Customer page (`/`) updates:
  - display burger place phone number in a clear, always-visible area
  - add click-to-call link (`tel:`)
- Checkout phone field updates:
  - add BR phone mask while typing (client-side UX)
  - preserve required-field behavior
- Submission path updates:
  - validate BR phone format server-side before order creation
  - return clear pt-BR validation message on invalid format

### Source of Truth (Locked)

- Displayed store phone uses env var `NEXT_PUBLIC_STORE_PHONE` (single source of truth for this feature).
- `tel:` href uses normalized digits from the same value.
- If `NEXT_PUBLIC_STORE_PHONE` is missing/invalid, the phone block is hidden (no broken/placeholder contact shown).

---

## Success Criteria

- [ ] Menu page visibly displays burger place phone number and exposes `tel:` link.
- [ ] Phone input applies BR mask while typing (e.g. `(11) 99999-9999`).
- [ ] Typing mask behavior is deterministic:
  - 10 digits -> `(11) 3456-7890`
  - 11 digits -> `(11) 98765-4321`
- [ ] Paste behavior is deterministic:
  - `+55 (11) 98765-4321` normalizes and masks to `(11) 98765-4321`
- [ ] Server rejects invalid phone formats with deterministic pt-BR validation response.
- [ ] Incomplete input is rejected (`Telefone inválido. Use um número brasileiro válido.`).
- [ ] Valid BR phone numbers continue to submit successfully.
- [ ] Existing order flow behavior (cart, payment method, submit success/error states) remains unchanged.

---

## Non-Goals (Out of Scope)

- International phone formats.
- WhatsApp deep-link flow.
- Changing `orders.customer_phone` column type/shape beyond normalization/validation behavior in current write path.
- Admin-side phone editing UX.

---

## Acceptance Scenarios

### Happy Paths

1. Customer opens `/` and sees the burger place phone number with a clickable call link.
2. Customer types phone in checkout and input is automatically masked to BR pattern.
3. Customer submits with valid BR number and order is created successfully.

### Unhappy Paths

1. Customer submits malformed/incomplete phone number and receives a clear validation message.
2. Customer pastes number with punctuation/spaces; system normalizes and accepts only if valid BR number.
3. Customer submits with missing phone number and current required-field validation still applies.

---

## Edge Cases

- 10-digit landline-like numbers vs 11-digit mobile numbers.
- Copy/paste values including country code prefix (`+55`) or mixed symbols.
- Short/partial masked input left incomplete.
- Legacy tests that assume free-form phone strings.

---

## Approach (High-Level Rationale)

1. Add configurable store phone display on customer page (pt-BR label + `tel:` anchor).
2. Implement BR mask behavior in checkout input for better typing guidance.
3. Keep server as source of truth: normalize input and validate BR phone before DB write.
4. Extend tests for UI mask behavior, displayed contact link, and server validation outcomes.

---

## Decisions (Locked)

- Phone number must be displayed on `/` page.
- Store phone source of truth is `NEXT_PUBLIC_STORE_PHONE`; missing/invalid value hides display block.
- Checkout phone input uses BR mask UX.
- Server-side BR validation is mandatory (mask alone is not sufficient).
- BR normalization/validation contract:
  - strip all non-digits before validation
  - accept optional Brazil country code `55` only as prefix (remove it before validation)
  - accept only final 10 or 11 digits (2-digit DDD + local number)
  - reject anything outside these rules
  - submit/store normalized digits-only value in existing order payload path
- Validation and feedback messages remain in Portuguese (pt-BR).
- Feature is backward-compatible for existing core order flow (no new checkout steps).

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
