---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 4 hardening review — Customer Order Submission (`/api/orders`, `app/actions.ts`, `app/page.tsx`, `docs/hardening-notes.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- `app/api/orders/route.ts:38` uses `rawBody.length` as a request-size proxy, which is character-count based (not exact bytes for multibyte UTF-8). This is acceptable as a lightweight guardrail, but if you want stricter enforcement later, measure bytes via `Buffer.byteLength(rawBody, "utf8")`.
- Add route tests for `413` (oversized body) and `Cache-Control: no-store` headers if you want tighter regression coverage for the new hardening behavior.
- Consider adding a minimal rate-limit / bot mitigation plan to the next hardening pass for `/api/orders` (public endpoint + service-role writes).

### Risks / Assumptions
- The hardening migration that locks down public table access (`supabase/migrations/20260224110000_lock_down_public_order_submission_tables.sql`) must be applied in Supabase for the intended security posture to be active.
- `SUPABASE_SERVICE_ROLE_KEY` is now part of the submission availability check (`app/page.tsx`) and backend write path; operational secrecy and environment configuration remain critical.
- The endpoint is still publicly reachable and can be spammed without rate limiting/CAPTCHA; this is documented as deferred in `docs/hardening-notes.md`.

## Acceptance Criteria (Stage 4 spot-check)
- [x] Security hardening implemented without weakening data protection (service-role path + public table lock-down migration retained)
- [x] Resilience improved (content-type validation, malformed JSON handling, no-store headers, setup readiness gating)
- [x] Input abuse guardrails improved (payload size cap + field/item bounds)
- [x] Hardening decisions/deferrals documented in `docs/hardening-notes.md`
- [x] Tests/build passing after hardening changes
---
