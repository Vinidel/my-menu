# Customer Menu Mobile Overflow Bugfix (`/` Cardápio) — Feature Documentation

Summary for the next engineer: what was fixed, where it lives, and how the responsive overflow prevention works.

**Brief:** [docs/briefs/customer-menu-mobile-overflow-bugfix.md](briefs/customer-menu-mobile-overflow-bugfix.md)

---

## What Was Delivered

- **Fixed mobile horizontal overflow in `Cardápio` cards on `/`:**
  - menu cards now fit within the intended mobile container without the card action row pushing width beyond the container
- **Responsive action-row fix:**
  - menu card action area (`status text` + buttons) now stacks on small screens and returns to row layout on `sm+`
  - action buttons row wraps on narrow screens
- **Extras editor mobile overflow prevention:**
  - extras editor container/rows now use `min-w-0` + wrapping guards so expanded customization UI stays within the card width
- **Stage 4 long-text hardening:**
  - menu item title and description now use defensive word wrapping (`break-words`) to reduce overflow risk from unusually long strings

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer menu/cart page UI (`/`) | `components/customer-order-page.tsx` |
| Tests (customer page structure/regressions) | `components/customer-order-page.test.tsx` |
| Stage 4 hardening notes | `docs/hardening-notes.md` |

---

## Root Cause (Stage 1 Locked)

- **Primary overflow source:** The menu card action row used a horizontal non-wrapping layout (`justify-between`) combining status text and action buttons (`Personalizar`, `Adicionar`) on narrow mobile widths.
- **Effect:** On small screens, the combined width of row children could exceed the card/container width and introduce horizontal overflow.

---

## Fix Strategy (Stage 1 Locked)

- **Menu card layout**
  - add `min-w-0` guards to card containers/content blocks
  - stack the action row on mobile (`flex-col`) and restore row layout only on `sm+`
  - allow the action-buttons row to wrap (`flex-wrap`)
- **Extras editor layout**
  - add `min-w-0` and `flex-wrap` to extras rows
  - allow extra labels to wrap instead of forcing width growth
- **No clipping workaround**
  - the fix uses wrapping/stacking behavior, not hidden overflow clipping of meaningful content

---

## Decisions (Locked)

- **Scope:** UI-only responsive layout bugfix on `/` -> `Cardápio` mobile view
- **Desktop parity:** No intentional desktop layout redesign in this fix
- **Compatibility:** Recent `Carrinho` sticky tabs and cart feedback UI must remain intact
- **No API/DB changes:** Customer ordering behavior/data contracts unchanged

---

## Test / Verification Notes

- **Why structural tests (not pixel overflow tests):**
  - jsdom does not perform real layout measurement reliably
  - tests lock the responsive classes/DOM structure that implement the overflow prevention
- **Stage 2 regression coverage includes:**
  - card `min-w-0` guard
  - mobile action-row stacking + `sm:` row restoration
  - action-buttons `flex-wrap`
  - extras editor `min-w-0` + `flex-wrap`
  - Stage 4 `break-words` guards on title/description

---

## Known Gaps & Deferred Work

- **No visual regression snapshots:** Overflow prevention is covered structurally, not with screenshot-based tests.
- **No runtime overflow telemetry:** Mobile layout regressions are still detected through QA/manual testing.
- **Category tab overflow not part of this fix:** This brief targeted menu item cards and extras editor overflow only.

---

## Operational Notes

- **Manual smoke test (mobile viewport):**
  - open `/` and verify no horizontal overflow in `Cardápio`
  - test cards with/without extras
  - open `Personalizar` and confirm extras editor stays within card width
  - verify `Carrinho` sticky tabs still behave normally
- **If overflow returns:** Re-check card action rows and extras editor rows first (most likely regression points).

---

## For the Next Engineer

- **If you redesign menu cards:** Preserve `min-w-0` + wrapping behavior on narrow viewports unless you replace it with an equivalent responsive layout solution.
- **If you add longer dynamic content:** Keep `break-words` (or an equivalent wrapping rule) on card title/description/extras labels to avoid reintroducing overflow on small phones.
- **If you add visual regression tooling later:** This feature is a good candidate for mobile snapshot coverage.
