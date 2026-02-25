# Feature Brief — Fix Mobile Overflow of Menu Items on `/` (Cardápio)

Status: Stage 0 — Framing
Date: 2026-02-25
Author: Orchestrator Agent

---

## Alternative Name

Bugfix overflow do cardápio no mobile / Menu cards overflow on `/` mobile / Cardápio width overflow

---

## Problem

On the public customer page (`/`), in the `Cardápio` tab on mobile devices, menu item cards can overflow horizontally outside their container.

Reported symptom:
- menu item width appears larger than the available container width
- horizontal overflow likely caused by layout/padding interactions (container padding + child sizing)

This creates a broken mobile layout and can make the cardápio harder to read/use.

---

## Goal

Ensure menu items in the `Cardápio` tab fit within the mobile viewport/container without horizontal overflow.

Success = on mobile viewport widths, menu cards render fully inside the intended container and no horizontal overflow is introduced by the card grid/layout.

---

## Who

- **Customers (public users):** Need a usable, readable mobile menu without clipped or overflowing cards.
- **Developers/operators:** Need a layout fix that does not regress desktop layout or recent cart/tab UI improvements.

---

## What We Capture / Change

- **Customer UI (`/`)**
  - Fix mobile `Cardápio` layout so menu cards do not overflow horizontally
- **Layout/CSS only**
  - Expected to be a styling/layout bugfix (container/grid/card sizing)

---

## Out of Scope

- Redesigning the menu cards visually
- Changing card content (titles/prices/buttons/extras behavior)
- API/data/schema changes
- Cart/checkout logic changes
- Desktop layout redesign

---

## Success Criteria (Exit-Oriented)

- [ ] On mobile viewport(s), menu item cards in the `Cardápio` tab do not overflow horizontally.
- [ ] No horizontal scrolling is introduced by the menu cards/container layout on `/` in normal usage.
- [ ] Card content remains readable and interactive (buttons still accessible).
- [ ] Desktop layout behavior remains unchanged (or visually equivalent within current design intent).
- [ ] Existing customer page flows (add item, extras, Carrinho feedback/tab behavior) remain functional.

---

## Happy Paths (Acceptance Scenarios)

1. **Mobile customer opens `/` and sees cardápio.** Menu cards fit within the container width without clipping or horizontal overflow.
2. **Mobile customer scrolls cardápio and adds items.** Layout remains stable while interacting with `Adicionar` / `Personalizar`.
3. **Desktop customer opens `/`.** Card grid still renders as before (no unintended regression).

---

## Unhappy Paths / Edge Cases

1. **Long item names/descriptions.** Text wrapping should not force card width overflow.
2. **Sticky mobile `Cardápio/Carrinho` tab bar present.** The overflow fix must coexist with the recent sticky mobile tab UI.
3. **Cards with extras/customization controls open.** Expanded extras editor should remain within container width on mobile.
4. **Very narrow mobile viewport (small phones).** Cards should still fit or degrade gracefully without horizontal page overflow.

---

## Locked Decisions (Stage 0)

1. **Scope is UI-only bugfix.** No API, DB, or behavior changes beyond layout/responsive sizing.
2. **Primary affected view (locked):** `/` -> `Cardápio` tab on mobile viewport.
3. **Desktop parity (locked):** Do not intentionally change desktop card layout behavior in this bugfix.
4. **No hidden-content workaround (locked):** Do not “fix” by clipping meaningful card content; cards should fit naturally within layout width.
5. **Regression protection (locked):** The recent `Carrinho` mobile sticky tabs and add-feedback UI must remain intact.

---

## Data / API / Schema Impact

- **No DB changes**
- **No API changes**
- **No order payload changes**

---

## Technical Notes for Implementer

- Inspect `/` customer page layout layers in `components/customer-order-page.tsx`:
  - outer page/container padding
  - cardápio section padding
  - grid sizing (`grid`, `sm:grid-cols-2`)
  - card width/min-width rules
  - button rows / extras editor expansion width
- Check for common overflow causes:
  - `w-full` inside padded containers + extra margins
  - min-width from children (buttons/text)
  - long unbroken text
  - sticky container padding interacting with width calculations
- Prefer a minimal CSS/layout fix and add a UI test assertion if feasible in the current test stack (or at least regression assertions around rendered structure).

---

## Stage 1 Implementation Choice To Lock

Implementer must lock and document:

- **Root cause**
  - which element(s) caused the mobile overflow
- **Fix strategy**
  - e.g. container padding adjustment, min-width reset (`min-w-0`), grid/card width constraints, flex wrapping corrections
- **Test/verification strategy**
  - how the fix is validated given jsdom limits for real layout measurement

