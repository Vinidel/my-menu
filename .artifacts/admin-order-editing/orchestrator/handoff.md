# Stage Handoff

Feature: admin-order-editing
Stage: orchestrator
Workflow: full

---

## Files Changed

- `docs/briefs/admin-order-editing.md` (updated)
- `docs/critique.md` (source critic feedback; unchanged in this pass)

---

## What Changed

Updated Stage 0 brief to address Critic-required changes:
- Locked operational boundary: admin edit load/save must reject non-operational rows (`is_deleted = true`).
- Locked validation parity: admin edits must reuse existing server-authoritative normalization/validation for name, BR phone, and e-mail.
- Expanded unhappy paths with explicit invalid BR phone, invalid e-mail, and soft-deleted order edit rejection scenarios.

Also incorporated non-blocking Critic suggestions:
- Locked boundary consistency with existing `admin/orders` data-access boundary and provider-agnostic app-layer client entrypoints.
- Added a happy-path scenario confirming metadata edits do not break immediate status progression UX.

---

## Known Gaps

- No implementation decisions beyond Stage 0 scope are included.

---

## Evidence

- Brief includes explicit soft-delete non-editable policy in What/Success/Decisions/Security sections.
- Brief includes explicit server-authoritative validation parity policy and corresponding unhappy-path scenarios.
- Stage 0 exit gate checklist remains complete except final Critic approval checkbox.

---

## Next Review Focus

1. Implementer: preserve locked operational + validation policies in server action/data-access and tests.
2. Tester: derive tests from unhappy paths and edge cases locked in the brief.
