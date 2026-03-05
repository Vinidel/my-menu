# Feature Brief — Customer Header Branding and Mobile Alignment

Status: Stage 0 — Framing  
Date: 2026-03-05  
Author: Orchestrator Agent

---

## Alternative Name

Header copy cleanup / Mobile header alignment fix

---

## Problem

The customer page header currently uses mixed branding/copy that feels redundant (`Lanchonete Dioney` plus `Cardápio`) and has alignment issues on mobile.

This causes:
- unclear top-level brand hierarchy
- avoidable visual noise in the hero header
- inconsistent alignment on small screens

---

## Goal

Use only `Lanchonete Dioney` as the main header identity on `/` and fix mobile alignment so header content remains balanced and readable.

### Header Text Scope (Locked)

- Remove the `Cardápio` title text from the header.
- Keep `Lanchonete Dioney` branding text.
- Keep the supporting sentence (`Monte seu pedido e envie para a cozinha.`).
- Keep existing setup/captcha warning banner messages unchanged.

---

## Who

- **Customers:** need a clear, clean brand header and stable mobile layout.
- **Owner:** wants a consistent brand presentation.
- **Developers:** need a locked header layout contract to avoid recurring UI drift.

---

## What We Capture / Change

- Update customer page header (`/`) to remove `Cardápio` title.
- Keep only brand-focused header identity (`Lanchonete Dioney`).
- Adjust mobile layout/alignment for:
  - brand block
  - optional phone contact block
  - spacing and text alignment at small widths
- Preserve all existing ordering functionality and interactions.

---

## Success Criteria

- [ ] Header no longer shows `Cardápio` title text.
- [ ] Header shows `Lanchonete Dioney` branding and retains supporting sentence text.
- [ ] No horizontal overflow or overlap in header at widths `320`, `360`, `390`, `430`.
- [ ] Mobile layout contract is respected when phone block is present:
  - brand block appears above phone block
  - both blocks align left on mobile
- [ ] Mobile layout contract is respected when phone block is absent:
  - brand block remains left-aligned with unchanged vertical spacing rhythm.
- [ ] No functional regressions in tabs/cart/checkout flow.

---

## Non-Goals (Out of Scope)

- Full redesign of the menu page theme.
- Changes to checkout fields, order API, or database schema.
- Admin page header redesign.
- New animations or motion system changes.

---

## Acceptance Scenarios

### Happy Paths

1. Customer opens `/` and sees only `Lanchonete Dioney` as header identity.
2. On mobile viewport, header content is aligned, readable, and does not overlap.
3. If store phone is configured, phone block renders and aligns correctly with header content.

### Unhappy Paths

1. If store phone config is missing/invalid, phone block remains hidden and header alignment still looks correct.
2. Long brand/supporting copy still wraps safely on narrow devices without overflow.

---

## Edge Cases

- Very narrow devices (`320px`) with long text wrapping.
- Presence/absence of phone block causing alignment shifts.
- Interaction with existing header background gradients/shadows.

---

## Approach (High-Level Rationale)

1. Update header content hierarchy in `components/customer-order-page.tsx`.
2. Adjust responsive layout classes for mobile-first alignment.
3. Verify no overflow/overlap across representative widths.
4. Keep behavior-only areas untouched (cart, tabs, submission).

---

## Decisions (Locked)

- Remove `Cardápio` title from customer header.
- Keep `Lanchonete Dioney` as the sole header brand identity.
- Keep supporting sentence below brand title.
- Scope is UI-only and limited to customer header area.
- Existing phone display feature remains supported in header.
- Mobile header layout contract:
  - with phone block: stacked column, brand first then phone block, left-aligned
  - without phone block: single left-aligned brand/supporting-copy block with consistent spacing
- Preserve current desktop behavior except removing `Cardápio` text.
- Locale remains pt-BR.

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
