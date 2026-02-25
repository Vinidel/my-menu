# Feature Brief — Carrinho Mais Explícito (Feedback ao Adicionar)

Status: Stage 5 — Documentation Complete (pending Critic)
Date: 2026-02-25
Author: Orchestrator Agent

---

## Alternative Name

Melhorar visibilidade do carrinho no `/` / Feedback visual ao adicionar item / Cart discoverability UX

---

## Problem

Today, when a customer clicks `Adicionar` on the menu page (`/`), it is not explicit enough where the selected item went. The current checkout area/tab exists, but customers may miss it, especially on mobile and when browsing a large menu.

This creates confusion and can make users think the click failed or that the item was not added.

---

## Goal

Make it obvious where the order/cart can be checked after clicking `Adicionar`, and provide immediate visual feedback on the **Carrinho** entry point when an item is added.

Success = after adding an item, the customer clearly sees that the item was added and where to click/tap to review the order (`Carrinho`).

---

## Who

- **Customers (public users):** Need clear feedback after adding items and a discoverable place to review the order.
- **Employees:** Indirectly benefit from fewer mistaken/abandoned orders caused by UX confusion.
- **Developers/operators:** Must improve clarity without breaking current cart, extras, payment method, and submit flows.

---

## What We Capture / Change

- **Customer UI (`/`)**
  - Rename the customer order tab/entry label from **`Seu pedido`** to **`Carrinho`**
  - Make the cart tab/button entry point clearly show the current item count
  - Add a short visual reaction on the **Carrinho** tab/button when an item is added
- **Behavior**
  - Keep cart contents and checkout behavior unchanged
  - Do not auto-submit, do not auto-open the cart, and do not remove the existing ability to manually switch tabs

---

## Out of Scope

- Redesigning the full customer page layout
- Changing pricing/totals logic
- Changing checkout validation or submit API behavior
- Animations for removing items or editing extras (unless needed for shared implementation)
- Toast system/global notifications

---

## Success Criteria (Exit-Oriented)

- [ ] The customer-facing order tab/entry is labeled **`Carrinho`** (replacing `Seu pedido`) in the customer flow UI.
- [ ] The cart entry point displays a visible item count (e.g. `Carrinho (X itens)` or equivalent pt-BR wording).
- [ ] Clicking `Adicionar` on a menu item triggers a clear, temporary visual feedback state on the **Carrinho** entry point.
- [ ] The feedback is repeatable when multiple items are added in sequence.
- [ ] Cart/extras/payment-method/order-submit behaviors remain unchanged.
- [ ] Mobile and desktop both expose the same cart discoverability improvement (interaction pattern may differ only by layout).

---

## Happy Paths (Acceptance Scenarios)

1. **Customer adds first item and notices where it went.** On `/`, the customer clicks `Adicionar`; the **Carrinho** entry point updates the count and visually reacts so the customer knows where to check the order.
2. **Customer adds multiple items quickly.** Repeated `Adicionar` clicks keep the cart count accurate and the **Carrinho** feedback remains visible/retriggered.
3. **Customer opens cart after feedback.** Customer clicks/taps **Carrinho**, reviews items, and continues checkout normally.

---

## Unhappy Paths / Edge Cases

1. **Large menu / scrolled page.** Even after scrolling through many items, adding an item should still update the visible cart entry point in the current UI header/tab area.
2. **Item already in cart.** If `Adicionar` increases quantity for an existing line, the same feedback behavior still occurs and count reflects the updated total.
3. **Customized item add (extras).** Adding a customized item must also trigger the same cart feedback behavior.
4. **Reduced motion preference.** If the UI uses animation, it should remain understandable with reduced-motion settings (e.g. color/outline change without motion).

---

## Locked Decisions (Stage 0)

1. **Naming change is in scope.** Replace customer-facing `Seu pedido` label with `Carrinho` in the `/` ordering flow (tab label and related entry-point text in this flow).
2. **Feedback target (locked):** The visual reaction occurs on the **Carrinho tab/button entry point**, not on each menu card.
3. **Count visibility (locked):** The cart entry point must always show the current total selected items (`X itens`).
4. **Count semantics (locked):** `X itens` means the **sum of quantities across all cart lines** (including separate customized lines), not number of lines or unique products.
5. **pt-BR wording (locked):** Use singular/plural wording in the cart entry point (`1 item`, `2 itens`) or an equivalent deterministic pt-BR format documented in Stage 1; tests must follow the chosen format.
6. **No forced navigation (locked):** Adding an item does **not** auto-switch to the `Carrinho` tab. The user stays in the current menu context.
7. **Feedback duration (locked):** Temporary feedback state lasts about `1s–2s` and retriggers on each add.
8. **Implementation freedom (bounded):** Exact visual styling (pulse/highlight/badge emphasis) is a Stage 1 decision, but it must be clearly visible and testable via DOM state/class/attribute.
9. **Accessibility (locked):** The feature must remain keyboard-usable; no behavior may depend only on pointer hover.

---

## Data / API / Schema Impact

- **No DB changes**
- **No API contract changes**
- **No order payload changes**
- UI-only/customer-flow state behavior change on `/`

---

## Technical Notes for Implementer

- Existing cart functionality already tracks selected items and item counts on the customer page; reuse that source of truth for the **Carrinho** count.
- Prefer a lightweight local UI state for temporary add-feedback (`lastAddedAt`, `isCartHighlighted`, timer reset, etc.).
- Keep behavior compatible with existing features:
  - extras/customization
  - payment method selection
  - inline validation
  - anti-abuse and `/api/orders` submit flow
- Respect reduced-motion preferences if animation is used.

---

## Stage 1 Implementation Choice To Lock

Implementer must lock and document:

- **Feedback style contract**
  - Example acceptable options:
    - temporary highlight ring/background on `Carrinho`
    - badge pulse + color change
    - subtle scale animation (with reduced-motion fallback)
- **DOM testability hook**
  - How Stage 2 tests will deterministically assert the feedback state (e.g. `data-state="highlighted"` / class toggle / aria-live text)
