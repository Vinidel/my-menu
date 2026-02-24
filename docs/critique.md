---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 0 brief review — Modo de Pagamento no Pedido (Customer + Admin) (`docs/briefs/order-payment-method-selection.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- If you want tighter UX testability in Stage 2, lock whether the “payment method required” validation appears inline under the radio group vs a global form message (current brief only requires a clear pt-BR validation message).
- Consider documenting a migration rollback note in Stage 5 docs because this feature introduces a new `CHECK` constraint and legacy-null compatibility assumptions.

### Risks / Assumptions
- The brief now correctly locks both the client payload contract (`paymentMethod` canonical values) and the DB integrity strategy (nullable column + `CHECK` constraint), which removes the main Stage 1 ambiguity.
- Legacy compatibility is handled cleanly with `NULL` allowed and `/admin` fallback `Não informado`.
- Unknown/manual DB values can still exist if constraints are bypassed or added later with dirty data; `/admin` fallback behavior is explicitly locked and should be covered in tests.

## Acceptance Criteria (Stage 0 spot-check)
- [x] Problem is clearly defined (customer payment intent missing in `/` and `/admin`)
- [x] Goals are concrete and testable (required selection, persistence, admin details display)
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced (legacy rows, unknown stored values, polling stability)
- [x] Key decisions are locked (payload contract, canonical values, DB constraint, admin mapping/fallback)
- [x] Approach is outlined at a high level (no code)
---
