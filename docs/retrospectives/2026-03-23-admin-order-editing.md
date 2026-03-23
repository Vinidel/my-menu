# Retrospective — admin-order-editing

Date: 2026-03-23
Workflow: Full

---

## What We Learned

- **Menu parity matters more than you think:** The most user-visible failure mode (edit sheet showing “Item fora do cardápio atual”) came from the admin loading menu data differently than the customer/order creation path. Keeping `/admin` menu loading aligned with `/` prevented `menuItemId` resolution drift.
- **Strict snapshot authority avoids UI bypasses:** During hardening, we removed “name-based fallback” for legacy/unknown items in `AdminOrderEditSheet`. This makes the UI respect the brief’s rule that the server is the final authority for whether a `menuItemId` is valid in the active menu.

## Workflow Fit

- **Full workflow was appropriate** for this change because it touched auth/RLS, DB grants/policy, shared validation/snapshot logic, and client UI state shape.
- **The workflow prevented silent drift:** Early Critic feedback and stage labels helped ensure we didn’t lock a mismatched legacy/unknown item behavior that would later break edits.

## What Helped

- Critic-driven re-alignment to the brief’s legacy/unknown item rules.
- Reusing shared validation (`lib/order-submit-validation.ts`) so server behavior stayed consistent across customer submit and admin edit.

## What to Keep

- Treat “menu source” as part of the feature contract (not an implementation detail).
- Keep strict, server-driven validation authoritative for edit payloads.
