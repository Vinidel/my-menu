---
# Critique

Date: 2026-03-23
Reviewed by: Critic Agent
Scope: docs/briefs/admin-order-editing.md (Stage 0 — Admin Order Editing, re-review after Orchestrator fixes)
Verdict: APPROVE

## Findings

### Required Changes
None. Previous critique items have been addressed:

- **Fulfillment-type vs. status constraints:** Decisions section now locks server rejection of fulfillment changes that conflict with status (`saiu_para_entrega`↔retirada, `pronto_para_retirada`↔entrega). Success Criteria and Unhappy Path #6 cover this.
- **Legacy items without `menuItemId`:** Decisions section now locks handling: exclude from editable list when loading, omit from save payload, drop on save if not re-added; admin can re-add from menu.

---

### Suggested Improvements
- **Edge Cases — "Editing delivered orders":** The bullet still says "Product decision: allow or disallow... implementation can restrict if preferred," but Decisions locks "Allowed." Consider aligning the Edge Case text to match Decisions (e.g. "Allowed; implementation may restrict in a future change if needed").

---

### Risks / Assumptions
- **Concurrent edits:** Last write wins remains acceptable for small scale (PROJECT.md).
- **`customer_id` on edit:** Implementation choice; snapshot is display source of truth.
- **Legacy item UX:** Dropping legacy-only items on save may surprise admins editing old orders; consider a brief in-form notice when legacy items are excluded (non-blocking, implementation detail).
- **Admin update path:** Ensure `createRequestClient` (or equivalent) is used so RLS applies; do not use privileged/service-role client.

---

## Acceptance Criteria

Before advancing to Implementer:
- [x] Decisions lock fulfillment-type vs. status validation
- [x] Decisions lock legacy item handling
- [x] Success Criteria includes fulfillment-type rejection
- [x] Unhappy Paths include fulfillment+status conflict
- [x] Brief is sufficiently clear for Implementer to begin Stage 1
