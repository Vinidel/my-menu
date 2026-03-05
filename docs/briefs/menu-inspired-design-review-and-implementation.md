# Feature Brief — Menu-Inspired Design Review and Implementation

Status: Stage 0 — Framing  
Date: 2026-03-05  
Author: Orchestrator Agent

---

## Alternative Name

Cardápio visual refresh / Menu-brand alignment

---

## Problem

The current customer UI works functionally, but visual communication is generic and does not clearly reflect the burger place identity shown in the printed menu.

This creates a product gap:
- brand recognition is weak
- hierarchy is not as clear as the physical menu
- users do not get a strong visual cue that they are ordering from this specific place

---

## Goal

Refresh the customer-facing cardápio/cart experience to match the visual language of the provided menu photo (red/white/black, bold headline style, strong category and price emphasis) while preserving current functionality and accessibility.

---

## Who

- **Customers (primary):** browse menu, add items, review cart, submit order.
- **Owner (secondary):** wants the app to look like the real menu brand.
- **Developers (secondary):** need clear design tokens/components for future UI consistency.

---

## What We Capture / Change

- Introduce a menu-inspired visual system for customer pages:
  - color tokens derived from the menu photo
  - typography pairing and sizing scale
  - spacing, borders, and emphasis patterns for categories/items/prices
- Apply the visual system to these locked UI areas only:
  - `/` page hero/header area (title + contextual copy)
  - category section containers and headings
  - menu item cards (name, ingredients text, price, add CTA)
  - tab bar (`Cardápio` / `Carrinho`) and cart feedback highlight state
  - cart summary card and checkout form surface
- Keep these areas visually unchanged in this feature:
  - admin routes (`/admin/**`)
  - API/server error message content and status handling
  - data model-driven content structure (no schema/content behavior changes)
- Keep existing behavior unchanged:
  - item selection, extras/removals, cart tab behavior, checkout validation/submission

---

## Success Criteria

- [ ] `/` customer UI uses shared design tokens for core surfaces and text emphasis (no isolated one-off palette overrides for primary layout surfaces).
- [ ] Visual hierarchy is explicit in menu item cards: item name > ingredients text > price > action button.
- [ ] Mobile layout has no horizontal overflow at representative widths (`320px`, `360px`, `390px`, `430px`).
- [ ] Cart visibility and “added to cart” feedback remain clear and functional.
- [ ] Accessibility baseline is preserved: visible keyboard focus states, reduced-motion behavior respected, and AA contrast for primary text/actions.
- [ ] No functional regression in order submit flow.

---

## Non-Goals (Out of Scope)

- Full rebranding of admin pages (`/admin`) in this feature.
- Changing business rules, order schema, or API contracts.
- Adding new checkout fields or payment changes.
- Replacing current menu data model/import behavior.
- Introducing new icon/illustration asset pipeline.

### Scope Adjustment (Recorded)

- During implementation, a small admin UI extension was accepted: top `/admin` summary status cards were color-aligned to existing status chips (`Esperando confirmação`, `Em preparo`, `Entregue`).
- This does not change admin flows, data, or behavior; it is presentation-only and narrower than a full admin redesign.

---

## Acceptance Scenarios

### Happy Paths

1. Customer opens `/` and sees menu-branded visual identity aligned to the printed menu inspiration.
2. Customer browses categories/items and can quickly distinguish item name, composition, and price.
3. Customer adds items, opens cart, and submits order with same functional flow as before.
4. Customer uses mobile viewport and sees a stable, readable layout with no overflow.

### Unhappy Paths

1. If custom font/token fails to load, UI falls back gracefully without breaking layout/functionality.
2. If user has reduced-motion preference, any animations are minimized/disabled without harming clarity.
3. If high-density item names/descriptions exist, text wraps safely and does not overlap price/actions.

---

## Edge Cases

- Very long item names and ingredient lines on small mobile widths.
- Mixed content density (items with/without extras/removals UI indicators).
- Cart tab/button state while user scrolls deep in long category lists.
- Bright ambient lighting on mobile screens (requires strong contrast for readability).

---

## Approach (High-Level Rationale)

1. Run a visual audit on the current `/` page and map to a token-based design layer.
2. Define explicit design tokens (brand red shades, neutral surfaces, text contrast, borders/radii/shadows).
3. Update customer UI components to consume tokens rather than one-off utility choices.
4. Rework card/category/cart visual hierarchy with mobile-first constraints.
5. Validate responsive behavior and regressions with existing tests + targeted UI checks.

---

## Visual Tokens (Locked)

- `--brand-primary`: menu-inspired red for emphasis surfaces/CTAs.
- `--surface-base`: light base for content readability.
- `--surface-accent`: subtle tinted surface for grouped sections.
- `--border-strong`: stronger border used on cards/tabs needing separation.
- `--text-primary`: high-contrast main text.
- `--text-muted`: secondary ingredient/supporting text.

---

## Decisions (Locked)

- Inspiration source is the provided menu image from Lanchonete Dioney.
- Primary theme direction: **warm red + white + black** with high-contrast emphasis.
- Scope is customer-facing pages first (`/` flow), not admin redesign.
- Functionality remains unchanged; this is a UI/UX design implementation feature.
- All user-facing copy remains in Portuguese (pt-BR).
- Typography strategy is resilient-first: custom display font is optional and must have deterministic fallback stack (no layout break if custom font fails to load).

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
