# Stage Handoff

Feature: admin-order-editing
Stage: orchestrator
Workflow: full

---

## Files Changed
- `docs/briefs/admin-order-editing.md` (created)

---

## What Changed
- New feature brief for Admin Order Editing.
- Admin (logged-in employee) can edit all customer-editable fields: items (including extras/removals), contact (nome, telefone, e-mail), payment method, fulfillment type, notes.
- Reuses customer validation and snapshot logic; new admin update path (API/action + DB migration for expanded `authenticated` grant on `orders`).
- Edit flow in `/admin` order details; status updates remain on existing controls.

---

## Known Gaps
- Exact `customer_id` re-matching or clearing on contact edit left to implementation.
- No audit log or revision history for edits (non-goal).
- ~~Legacy item handling~~ — resolved in brief (Decisions: legacy items without menuItemId excluded from edit form, omitted on save).
- ~~Fulfillment+status constraint validation~~ — resolved in brief (Decisions: server rejects invalid fulfillment changes with pt-BR message).

---

## Evidence
- Brief at `docs/briefs/admin-order-editing.md`.
- Exit gate checklist completed; Critic approval pending.

---

## Next Review Focus
- Implementer: shared validation extraction, admin update path, DB migration, admin edit UI.
- Tester: acceptance scenarios from brief.
