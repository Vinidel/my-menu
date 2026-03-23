# Stage Handoff

Feature: admin-order-editing
Stage: hardener
Workflow: Full

---

## Files Changed
- `components/admin-order-edit-sheet.tsx` (strict menuItemId handling; removed name-based fallback for initial lines)
- `docs/hardening-notes.md` (recorded Stage 3 hardening notes for admin order editing)
- `docs/critique.md` (updated Critic verdict scope for Stage 3)

---

## What Changed
- Updated `AdminOrderEditSheet` `initialLines` so legacy/unknown items are handled strictly by snapshot `menuItemId`:
  - Legacy lines without `menuItemId` are excluded from the editable list (per brief Decisions).
  - Unknown `menuItemId` values are preserved as-is so the server will reject them if they remain in the save payload (admin must remove/replace).

---

## Known Gaps
- No UI-level guarantee that an admin removed all unknown lines before submit; server validation still provides the final enforcement (intended per brief).

---

## Evidence
- `npm test` passes after the change (Vitest).
- `rg console.log` shows no debug logging remaining in `components/admin-order-edit-sheet.tsx`.

---

## Next Review Focus
- Gate Keeper packages Stage 3 by adding `stage-3-hardening` label (and keeping prior stage labels).
- Critic checks that this Stage 3 change restores strict compliance with the brief’s legacy/unknown-item Decisions.
