# Retrospective — cash-change

Date: 2026-03-10
Workflow: Full

---

## What We Learned

- The shipped change was correctly tiny: one placeholder-copy update plus regression coverage.
- The forced `Full` workflow still added value by making the non-goal explicit: no structured `troco` behavior was introduced by accident.

## Workflow Fit

- Under normal routing, this feature would fit `Light`.
- The explicit `Full` override was still useful as a workflow test because it showed a small copy change could stay disciplined through every stage without scope creep.

## What Helped

- The brief locked scope early and prevented drift into payment or admin behavior.
- Stage 2 coverage proved `troco` still travels only through the existing `notes` field.
- Stage 3 documentation made it explicit that no extra hardening code was warranted.

## What To Keep

- Continue documenting what placeholder-only features are not changing.
- Keep the “no structured field creep” check when copy references domain-specific concepts like payment change.
