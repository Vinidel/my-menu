# Critique

Date: 2026-03-05  
Reviewed by: Critic Agent  
Scope: Stage 0 brief review — `docs/briefs/customer-menu-phone-display-and-br-mask-validation.md`  
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- In Stage 1, add `NEXT_PUBLIC_STORE_PHONE` to `.env.example` with a BR-format example.
- In Stage 2, include one focused test that verifies the store-phone block is hidden when `NEXT_PUBLIC_STORE_PHONE` is invalid/missing.

### Risks / Assumptions
- Assumes the existing backend/order path can safely accept normalized digits-only phone values without downstream formatting dependencies.
- Assumes product accepts hiding the store phone block when env value is missing/invalid (rather than showing fallback copy).

## Acceptance Criteria
- [x] Store phone source of truth and fallback behavior are explicitly locked.
- [x] BR phone normalization + validation contract is explicit and testable.
- [x] Success criteria include deterministic mask/paste/incomplete-input checks suitable for Stage 2 tests.
