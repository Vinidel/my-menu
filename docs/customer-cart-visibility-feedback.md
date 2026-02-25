# Customer Cart Visibility / Feedback (`Carrinho`) — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/customer-cart-visibility-feedback.md](briefs/customer-cart-visibility-feedback.md)

---

## What Was Delivered

- **Customer cart naming update:** The customer-facing order tab/entry on `/` is now labeled **`Carrinho`** (replacing the previous `Seu pedido` wording in the tabbed ordering flow).
- **Explicit cart destination labels:** The menu-side quick access now uses `Ver carrinho (...)` so customers can more easily understand where items go after clicking `Adicionar`.
- **Deterministic item count display:** The `Carrinho` tab and quick-access entry show the current count with pt-BR singular/plural formatting (`1 item`, `N itens`).
- **Locked count semantics implemented:** Count represents the **sum of quantities across all cart lines** (including separate customized lines), not line count/unique products.
- **Add-to-cart visual feedback:** Clicking `Adicionar` (including customized add via `Adicionar com extras`) triggers a temporary visual highlight on the `Carrinho` entry points.
- **No forced navigation:** Customers remain on `Cardápio` after adding items; the feature only improves discoverability and feedback.
- **Mobile discoverability improvement:** The main `Cardápio / Carrinho` tab bar is sticky on mobile so the `Carrinho` feedback remains visible while scrolling long menus.
- **Stage 4 accessibility hardening:** Added a polite `aria-live` announcement when an item is added, so non-visual users receive equivalent feedback.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer ordering UI (`/`) | `components/customer-order-page.tsx` |
| Public route page | `app/page.tsx` |
| Tests (customer UI / cart feedback) | `components/customer-order-page.test.tsx` |
| Stage 4 hardening notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Naming change:** Customer-facing tab/entry uses `Carrinho`.
- **Feedback target:** Feedback reacts on the **Carrinho entry point** (tab/button), not on each menu card.
- **Count semantics:** `X itens` = sum of quantities across all cart lines (including customized lines).
- **Count wording:** Deterministic pt-BR singular/plural formatting (`1 item`, `N itens`).
- **No forced navigation:** `Adicionar` does not auto-switch to the `Carrinho` tab.
- **Feedback duration:** Temporary feedback lasts about `1s–2s` (implemented at ~`1.4s`) and retriggers on each add.
- **UI scope only:** No DB/API/order payload changes.

---

## UX / Interaction Notes

- **Visual feedback implementation (Stage 1 choice):**
  - temporary highlighted state on cart entry points
  - DOM hook for tests: `data-cart-feedback-state="idle|recent-add"`
- **Mobile sticky behavior:**
  - main `Cardápio / Carrinho` navigation is sticky on mobile
  - mobile-only subtle shadow/ring appears while scrolling for separation from menu cards
  - desktop keeps normal left-aligned non-sticky tabs
- **No cart logic changes:**
  - extras customization, payment method selection, quantity editing, and submit flow all remain unchanged

---

## Known Gaps & Deferred Work

- **No analytics/telemetry:** No metrics on cart-feedback interactions, click-through to `Carrinho`, or conversion improvements.
- **No animation customization setting:** Reduced-motion compatibility is respected through `motion-safe`, but there is no user-facing toggle.
- **No scroll-position auto-assist:** Feature does not auto-scroll to the tab bar or cart area after add (intentionally out of scope).
- **No toast/notification system:** Feedback remains local to the cart entry points + `aria-live` announcement.

---

## Operational Notes

- **Regression checks after customer-page UI changes:**
  - add item from `Cardápio` and confirm `Carrinho` count updates
  - confirm `Carrinho` feedback state appears and resets
  - confirm user remains on `Cardápio` after add
  - add customized item and confirm same feedback behavior
  - confirm mobile sticky tab bar remains visible while scrolling
- **A11y behavior:** Screen readers should announce add-to-cart confirmation and the `Ver carrinho (...)` destination text.

---

## For the Next Engineer

- **If you add cart toasts later:** Keep the current cart-entry feedback and `aria-live` behavior unless the new pattern clearly replaces both visual and non-visual cues.
- **If you redesign the customer page layout:** Preserve the locked count semantics and no-auto-navigation rule unless a new brief changes them.
- **If you move the cart entry point:** Update the feedback target, test hook (`data-cart-feedback-state`), and customer tests together.
