# Customer Header Branding and Mobile Alignment — Feature Documentation

Summary for the next engineer: what changed, where it lives, what was validated, and what remains deferred.

**Brief:** [docs/briefs/customer-header-branding-and-mobile-alignment.md](briefs/customer-header-branding-and-mobile-alignment.md)

---

## What Was Delivered

- **Header identity cleanup on `/`:** removed `Cardápio` from the hero header title.
- **Brand title lock:** `Lanchonete Dioney` is now the sole `h1` in the customer header.
- **Supporting copy preserved:** `Monte seu pedido e envie para a cozinha.` remains unchanged.
- **Phone block visual simplification:** removed boxed container styling so phone contact no longer looks like a separate card.
- **Responsive alignment contract preserved:** phone block stays left-aligned on mobile and right-aligned from `sm` upward.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer header UI | `components/customer-order-page.tsx` |
| Feature tests (header + phone block behavior) | `components/customer-order-page.test.tsx` |
| Stage 1 out-of-scope notes | `docs/implementation-notes.md` |
| Stage 4 hardening sweep | `docs/hardening-notes.md` |
| Stage critiques | `docs/critique.md` |

---

## Locked Decisions Applied

- Remove `Cardápio` title from customer header.
- Keep `Lanchonete Dioney` as the only header brand identity (`h1`).
- Keep supporting sentence in pt-BR unchanged.
- Keep setup/captcha warning banners unchanged.
- Mobile layout contract:
  - with phone block: stacked flow with brand first, left-aligned on mobile
  - without phone block: left-aligned brand/support copy with stable spacing
- Preserve desktop behavior except removing `Cardápio` title text.

---

## Validation Performed

- Targeted suite run:
  - `npm run test -- components/customer-order-page.test.tsx`
  - Result: passing (`28/28`)
- Stage 2 coverage includes:
  - header `h1` identity assertion (`Lanchonete Dioney`)
  - negative assertion for removed `Cardápio` `h1`
  - supporting sentence retention assertion
  - phone block present/absent assertions
  - responsive class-contract assertion (`text-left`, `sm:text-right`)

---

## Hardening Outcome (Stage 4)

- **Security:** no new attack surface (UI-only change).
- **Dependencies:** no new packages or runtime coupling.
- **Performance:** neutral/slightly lower render complexity after removing extra header elements/styles.
- **Observability:** no additional instrumentation required for this scope.
- **Resilience:** behavior stable for phone-present and phone-absent paths.

---

## Known Gap / Deferred

- Overflow/no-overlap at viewport widths `320/360/390/430` is currently validated via contract/class tests, not browser screenshot assertions.
- Suggested follow-up: add Playwright visual checks for these widths.

---

## Rollback

If needed, rollback is a simple UI revert in:

- `components/customer-order-page.tsx`
- `components/customer-order-page.test.tsx`

No DB migration or API contract rollback is required for this feature.
