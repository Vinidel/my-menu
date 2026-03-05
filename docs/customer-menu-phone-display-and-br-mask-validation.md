# Customer Menu Phone Display + BR Mask/Validation — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/customer-menu-phone-display-and-br-mask-validation.md](briefs/customer-menu-phone-display-and-br-mask-validation.md)

---

## What Was Delivered

- **Store phone display on `/`:** Customer menu page now supports a visible phone contact block (label + clickable `tel:` link).
- **Single source of truth:** Store phone comes from `NEXT_PUBLIC_STORE_PHONE`.
- **Safe fallback:** If `NEXT_PUBLIC_STORE_PHONE` is missing/invalid, the contact block is hidden.
- **BR phone mask in checkout:** Customer `Telefone` input now applies deterministic BR mask while typing/pasting.
- **Server-authoritative BR validation:** Order submission rejects malformed/incomplete numbers using locked BR normalization rules.
- **Canonical phone persistence:** Orders now persist normalized digits-only phone (`customer_phone`) from validated BR input.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Public menu page wiring | `app/page.tsx` |
| Customer checkout input/mask UI | `components/customer-order-page.tsx` |
| Server order validation/persistence | `app/actions.ts` |
| Shared phone helpers | `lib/phone.ts` |
| Env example | `.env.example` |
| Customer UI tests | `components/customer-order-page.test.tsx` |
| Page/env tests | `app/page.test.tsx` |
| Server-side order tests | `app/actions.test.ts` |
| Phone helper unit tests | `lib/phone.test.ts` |
| Hardening sweep | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- Store phone source of truth is `NEXT_PUBLIC_STORE_PHONE`.
- Store phone block is hidden when source value is missing/invalid.
- Client mask is UX-only; backend validation is authoritative.
- BR normalization contract:
  - strip non-digits
  - optional `55` prefix only at start
  - accept only final 10 or 11 digits
  - reject all other shapes
- User-facing validation remains in pt-BR.

---

## Operational Notes

- **Environment setup:** `NEXT_PUBLIC_STORE_PHONE` must be set for storefront contact display.
- **Display behavior:** valid value is rendered as formatted BR phone + `tel:+55...`; invalid value renders no contact block.
- **Phone submit behavior:** masked input is accepted, normalized server-side, and stored as digits-only.

### Manual Smoke Checklist

- Set valid `NEXT_PUBLIC_STORE_PHONE`, reload `/`, verify contact block and working `tel:` link.
- Set invalid/missing `NEXT_PUBLIC_STORE_PHONE`, reload `/`, verify block is hidden.
- In checkout, type/paste BR numbers and verify mask behavior.
- Submit valid BR number and confirm success.
- Submit incomplete/invalid BR number and confirm validation error.

---

## Known Gaps & Deferred

- **No phone-specific telemetry:** No dedicated counters for validation rejects.
- **No admin phone formatting pass:** Admin view currently displays stored `customer_phone` as persisted value.
- **No international support:** This feature intentionally supports BR rules only.

---

## Rollback (UI/validation)

- Revert `app/page.tsx` + `components/customer-order-page.tsx` + `lib/phone.ts` integration.
- Restore prior generic phone normalization path in `app/actions.ts` if needed.
- No DB migration rollback required for this feature.
