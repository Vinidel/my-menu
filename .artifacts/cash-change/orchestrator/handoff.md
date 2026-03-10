# Stage Handoff

Feature: cash-change
Stage: orchestrator
Workflow: full

---

## Files Changed
- `docs/briefs/cash-change.md`
- `.artifacts/cash-change/workflow-state.json`
- `.artifacts/cash-change/orchestrator/handoff.md`

---

## What Changed
- Created the Stage 0 feature brief for `cash-change` using `docs/requests/cash-change.md` as the source request.
- Locked the feature scope to a placeholder-copy update on the customer checkout `Observações` textarea.
- Recorded the workflow routing decision as `Full`, while explicitly distinguishing that operator override from the narrower product request itself.
- Repaired the Stage 0 artifacts so the routing evidence cites the direct session instruction that forced `Full`, not just the derived workflow-state file.
- Defined success criteria, non-goals, acceptance scenarios, edge cases, and constraints to prevent scope drift into a structured `troco` feature.

---

## Known Gaps
- Critic review has not been run yet, so the Stage 0 exit gate is not fully complete.
- Final placeholder wording is intentionally not chosen in Stage 0; Implementer should stay within the brief and keep the copy in pt-BR.

---

## Evidence
- Source request: `docs/requests/cash-change.md`
- Operator instruction for this run: `Act as the orchestrator agent. Feature slug: cash-change. Workflow: full.`
- Workflow state artifact: `.artifacts/cash-change/workflow-state.json` records `"workflow": "full"` for feature `cash-change` at the orchestrator stage on 2026-03-10.
- Relevant UI surface identified at `components/customer-order-page.tsx`
- Workflow and role rules followed from `workflow/WORKFLOW.md` and `.cursor/rules/orchestrator.mdc`

---

## Next Review Focus
- Confirm the brief cleanly distinguishes the narrow product ask from the separate `Full` workflow override directed in this run and recorded in `.artifacts/cash-change/workflow-state.json`.
- Verify the brief keeps the change constrained to placeholder text only.
- Check that the mobile edge case is concrete enough for Tester to derive a focused regression assertion if needed.
