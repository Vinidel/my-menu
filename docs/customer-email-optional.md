# Customer E-mail Optional — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/customer-email-optional.md](briefs/customer-email-optional.md)

---

## What Was Delivered

- **Checkout e-mail became optional (`/`):** Customer can submit without filling `E-mail`; required validation now enforces `Nome`, `Telefone`, `Modo de pagamento`, and at least one item.
- **Optional format validation retained:** If e-mail is provided, invalid format still blocks submit with pt-BR validation message (`Informe um e-mail válido.`).
- **Server authority updated:** `submitCustomerOrderWithClient` accepts empty e-mail, rejects tampered non-string e-mail payload shapes, and preserves existing phone/payment/item validation.
- **Canonical storage contract:** Missing e-mail is persisted as `NULL` (never empty string) for:
  - `public.orders.customer_email`
  - `public.customers.email`
  - `public.customers.email_normalized`
- **Customer dedupe branching:**
  - with e-mail: dedupe by `(email_normalized, phone_normalized)`
  - without e-mail: dedupe by `phone_normalized` where `email_normalized is null`
- **Phone-only customer upgrade path:** If a phone-only customer later submits with e-mail, the existing row is upgraded instead of creating a duplicate customer.
- **Admin fallback rendering compatibility:** Missing e-mail rows are rendered as `Não informado` in admin order parsing/display.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer checkout UI (`E-mail (opcional)` + validation copy) | `components/customer-order-page.tsx` |
| Shared submit validation + dedupe/upgrade logic | `app/actions.ts` |
| Public API route pass-through contract (`POST /api/orders`) | `app/api/orders/route.ts` |
| Admin parser fallback for missing e-mail | `lib/orders.ts` |
| Supabase migration for nullable e-mail + indexes/constraints | `supabase/migrations/20260302143000_make_customer_email_optional.sql` |
| Supabase generated DB types updates | `lib/supabase/database.types.ts` |
| Submit logic tests | `app/actions.test.ts` |
| Customer UI tests | `components/customer-order-page.test.tsx` |
| Route tests | `app/api/orders/route.test.ts` |
| Admin parser test fallback | `lib/orders.test.ts` |
| Stage 4 hardening record | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **E-mail requirement:** Optional for customer order submission.
- **Still required:** `nome`, `telefone`, `forma de pagamento`, and at least one valid item.
- **Validation contract:**
  - empty e-mail is allowed
  - non-empty e-mail must pass basic e-mail format validation
  - non-string tampered e-mail payload is rejected server-side
- **Canonical missing-e-mail persistence:** `NULL` only (no empty-string storage).
- **Dedupe contract:**
  - with e-mail: `(email_normalized, phone_normalized)`
  - without e-mail: `phone_normalized` with `email_normalized is null`
- **Upgrade contract:** phone-only customer row is upgraded when later submit provides e-mail on same normalized phone.
- **Admin fallback label:** `Não informado`.
- **Language:** pt-BR user-facing messages/labels.

---

## Data Model / Migration Notes

- **`orders` changes:**
  - `customer_email` changed to nullable
  - optional check constraint for non-null values (`btrim(...) <> ''`)
- **`customers` changes:**
  - `email` and `email_normalized` changed to nullable
  - optional non-empty checks for non-null values
  - pair-consistency check:
    - both null OR both non-null
- **Uniqueness/index strategy:**
  - partial unique index: `(email_normalized, phone_normalized)` where `email_normalized is not null`
  - partial unique index: `(phone_normalized)` where `email_normalized is null`

Migration file:
- `supabase/migrations/20260302143000_make_customer_email_optional.sql`

---

## Known Gaps & Deferred Work

- **No dedicated metrics:** Validation rejects and dedupe retry/conflict counts are not emitted as dedicated counters.
- **No explicit transaction wrapper:** Customer lookup/upgrade/insert flow relies on DB unique constraints + retry behavior.
- **No identity merge policy beyond locked flow:** Advanced identity resolution (across mismatched phones/e-mails) remains out of scope.

---

## Operational Notes

- **Apply migration before deploy:** `20260302143000_make_customer_email_optional.sql` must be applied before shipping app changes.
- **Regression checks:**
  - submit order with empty e-mail
  - submit order with valid e-mail
  - submit invalid non-empty e-mail
  - verify phone-only customer dedupe reuse
  - verify phone-only customer upgrade when later e-mail is provided
  - confirm `/admin` shows `Não informado` for missing e-mail
- **Backward compatibility:** Existing non-null e-mail rows remain valid and continue rendering/processing normally.

---

## For the Next Engineer

- If you add customer profile/history features later, keep `NULL` semantics for missing e-mail consistent across API/UI/migrations.
- If you need stronger concurrency guarantees, consider moving customer resolve/upgrade logic into a DB function with explicit transactional semantics.
- If you add observability tooling, start by instrumenting:
  - optional e-mail validation rejects
  - `23505` retry occurrences for customer dedupe.

