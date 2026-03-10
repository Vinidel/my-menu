# Critique

Date: 2026-03-10
Reviewed by: Critic Agent
Scope: Implementer Stage 1 for `cash-change` (`.artifacts/cash-change/implementer/handoff.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- [components/customer-order-page.test.tsx / Stage 2 follow-up] Add the brief-requested regression assertion for the rendered `Observações (opcional)` placeholder so later copy edits cannot silently remove the `troco` guidance. | Evidence: `docs/briefs/cash-change.md` calls for regression coverage around the rendered placeholder text.

### Risks / Assumptions
- This review assumes the feature remains locked to the single placeholder change in `components/customer-order-page.tsx`; the current diff matches that assumption and does not alter payload, validation, API, or persistence behavior.
- The placeholder wording `Ex.: sem cebola, ponto da carne, troco para R$ 50, retirar molho...` reads naturally enough in pt-BR and does not imply a structured `troco` field, but future copy expansions should stay careful not to suggest cash-only branching or new form behavior.
- The cited evidence in the handoff is accurate as of this review: `npm exec vitest run components/customer-order-page.test.tsx` passes with 30 tests.

## Acceptance Criteria
- [x] The implementer handoff matches the actual code change in `components/customer-order-page.tsx`.
- [x] The implementation stays within the brief’s locked scope: placeholder-copy only, no behavior or data-contract changes.
- [x] User-facing copy remains Portuguese (pt-BR) and includes a `troco` example in the `Observações (opcional)` placeholder.
- [x] Existing customer-order component tests still pass after the change.
- [ ] Stage 2 adds regression coverage that asserts the rendered placeholder includes the `troco` guidance from the brief.
