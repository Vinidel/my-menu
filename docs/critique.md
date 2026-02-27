---
# Critique

Date: 2026-02-27
Reviewed by: Critic Agent
Scope: Stage 2 test coverage review — Invisible Turnstile CAPTCHA on `/api/orders` (`docs/briefs/api-orders-turnstile-captcha.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Add one UI-level assertion that a successful CAPTCHA callback path includes `turnstileToken` in the `/api/orders` payload body (current coverage validates API behavior when token is present, but not the final client request shape end-to-end).

### Risks / Assumptions
- Current Stage 2 coverage is strong for server-side enforcement and config gating.
- Turnstile widget lifecycle behavior is partially mocked in component tests; browser/runtime integration details still depend on manual or e2e validation.

## Acceptance Criteria (Stage 2 spot-check)
- [x] Non-production CAPTCHA toggle behavior is covered.
- [x] Production override (`NODE_ENV=production`) is covered.
- [x] Missing Turnstile keys when required returns deterministic `503`.
- [x] Missing token returns `400` and no order write.
- [x] Invalid verification result returns `400` and no order write.
- [x] Verify upstream failure returns `503` (fail closed).
- [x] Valid token verification path succeeds and strips `turnstileToken` before submit action call.
- [x] Customer UI blocks submit when CAPTCHA is required but site key is missing.
- [x] Customer UI shows info-state feedback for `Verificando segurança...`.

---
