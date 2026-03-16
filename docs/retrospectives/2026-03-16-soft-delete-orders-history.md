# Retrospective — soft-delete-orders-history

Date: 2026-03-16
Workflow: Full

---

## What We Learned

- **Superseding a prior feature needs explicit docs work:** The implementation changed retention policy safely, but the real operator risk sat in stale hard-delete documentation until Stage 5.
- **Schema semantics benefit from paired fields when the contract is operationally important:** `is_deleted` made active-row filtering and review easier to audit than timestamp-only soft-delete logic.
- **Critic caught policy ambiguity early:** The first Stage 0 pass exposed two real gaps — missed-run behavior and stale mutation behavior — before code locked the wrong semantics.

## Workflow Fit

- Full workflow was appropriate because this changed retention semantics, schema, scheduler behavior, and operational read contracts.
- The workflow prevented rework twice: first by clarifying catch-up behavior in Stage 0, then by formalizing `is_deleted` before Stage 1 was considered done.

## What Helped

- Keeping the cleanup entrypoint name stable reduced rollout risk.
- Centralizing the active-order filter in the admin/orders boundary limited the blast radius.
- Documenting the remaining real-DB verification gap kept the stage honest instead of overstating confidence.

## What To Keep

- When replacing a destructive data policy, update the old operator-facing doc instead of only adding a new feature doc.
- If soft-deleted rows must be treated as non-operational, document mutation rules as part of the feature contract, not as an implementation detail.
