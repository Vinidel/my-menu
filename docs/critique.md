---
# Critique

Date: 2026-03-23
Reviewed by: Critic Agent
Scope: Admin Order Editing — Stage 3 hardening (edit-sheet strict ID handling)
Verdict: APPROVE

## Findings

### Required Changes
None.

### Suggested Improvements
- Optional UX: when save fails due to unknown menu items, surface a clearer pt-BR instruction in the edit sheet (currently depends on server validation message).

### Risks / Assumptions
- The large pre-existing `docs/hardening-notes.md` file may contain markdownlint warnings; this change should not be interpreted as introducing new lint failures.

## Acceptance Criteria
- [x] After Stage 3, `AdminOrderEditSheet` no longer uses name-based fallback for `initialLines`; legacy lines without `menuItemId` are excluded from the editable list (per brief Decisions).
- [x] Unknown `menuItemId` values remain deterministically unknown (preserved snapshot id) so server validation continues to be the final authority.
- [x] `npm test` passes after the change.
---
