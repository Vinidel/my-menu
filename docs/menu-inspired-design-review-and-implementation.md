# Menu-Inspired Design Review and Implementation — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/menu-inspired-design-review-and-implementation.md](briefs/menu-inspired-design-review-and-implementation.md)

---

## What Was Delivered

- **Customer visual refresh on `/`:** The customer menu/cart page now follows the printed menu inspiration (strong red brand surfaces, high-contrast text, emphasized pricing and CTAs).
- **Tokenized theme scope (`.menu-theme`):** Menu-inspired colors are defined as scoped CSS variables and applied only inside customer flow components.
- **Locked component scope implemented:** Header hero, category section, menu item cards, `Cardápio/Carrinho` tabs, cart summary, and checkout surface were restyled.
- **Admin summary-card alignment:** Top status summary boxes on `/admin` now use status-matching colors aligned with existing status chips:
  - `Esperando confirmação` (amber)
  - `Em preparo` (blue)
  - `Entregue` (green)
- **Behavior preserved:** No functional checkout/order logic changes; all prior interactions (add, customize, cart count, submit) remain unchanged.
- **UI consistency cleanup (Stage 3):** Repeated theme class strings were centralized in local constants (`customer-order-page`) and status visual mapping was centralized in one map (`admin-orders-dashboard`).

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer page route | `app/page.tsx` |
| Customer menu/cart UI | `components/customer-order-page.tsx` |
| Scoped design tokens (`.menu-theme`) | `app/globals.css` |
| Admin dashboard summary cards | `components/admin-orders-dashboard.tsx` |
| Customer UI tests | `components/customer-order-page.test.tsx` |
| Admin dashboard tests | `components/admin-orders-dashboard.test.tsx` |
| Hardening sweep notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Visual source of truth:** Provided printed menu photo.
- **Theme direction:** Warm red + neutral light surfaces + dark text contrast.
- **Feature type:** UI/UX-only refresh for current flows (no schema/API/business-rule changes).
- **Scope boundary:** Customer flow first (`/`), plus status-summary color alignment on `/admin`.
- **Typography resilience:** No hard dependency on custom font loading; layout remains stable with fallback fonts.
- **Locale consistency:** All user-facing content remains pt-BR.

---

## Scope Adjustment Note

- The original brief excluded broad admin redesign, but implementation included a narrow visual extension: top `/admin` status summary cards were aligned with existing status colors.
- This extension is presentation-only and does not alter admin workflows, API behavior, or database state.

---

## Operational Notes

- **No migrations/deploy infra changes:** This feature only changes component styling and token usage.
- **Regression smoke checklist after UI edits:**
  - Add item from `Cardápio` and confirm `Carrinho` feedback/count still updates.
  - Open `Carrinho`, confirm total and CTA visibility.
  - Submit valid order and confirm success flow unchanged.
  - Verify `/admin` top summary cards keep status color alignment.
  - Verify representative mobile widths (`320`, `360`, `390`, `430`) for no horizontal overflow.

### Rollback (UI-only)

- Customer theme rollback: revert `components/customer-order-page.tsx` + `.menu-theme` tokens in `app/globals.css`.
- Admin summary rollback: revert status summary card style mapping in `components/admin-orders-dashboard.tsx`.
- No database/data rollback is needed for this feature.

---

## Known Gaps & Deferred

- **No automated contrast gate in CI:** Contrast checks rely on manual review/device QA.
- **No visual snapshot/e2e suite:** Current coverage validates structure/class hooks, not pixel-level output.
- **No UX analytics:** No telemetry for visual feature impact (engagement/conversion/readability).

---

## For the Next Engineer

- If you add more themed customer surfaces, keep token usage under `.menu-theme` to avoid admin bleed-over.
- If you rename/rework utility classes, update class-based tests together (`customer-order-page.test.tsx`, `admin-orders-dashboard.test.tsx`).
- If admin theme work expands later, consider extracting shared status-color primitives to a dedicated style module.
