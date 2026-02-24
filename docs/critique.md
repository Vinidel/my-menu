---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 4 hardening review — API Orders Anti-Abuse (`app/api/orders/route.ts`, `app/api/orders/route.test.ts`, `docs/hardening-notes.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Add a focused test that asserts the limiter key uses the hashed `ip_hash:` prefix (not raw `ip:`) for a normal IP path, to lock the privacy hardening against regressions.
- Add a source-extraction parsing test matrix (e.g. `x-forwarded-for` comma list, IPv4 with port, `forwarded` header IPv6 form) in a future helper-level test if source parsing grows.
- Consider adding a small metric counter/log sampling strategy for throttle events and limiter degrade-open events when ops needs production abuse visibility.

### Risks / Assumptions
- In-memory limiter remains per-process/per-instance and can be bypassed across multiple instances/regions. This is documented and accepted for the current stage but is the main residual anti-abuse risk.
- IP/header trust still depends on deployment behind a trusted proxy/CDN. The code documents this and degrades safely to `unknown` for malformed/oversized source tokens.

## Acceptance Criteria (Stage 4 spot-check)
- [x] Hardening changes preserve the locked anti-abuse behavior (`5 req / 5 min`, `429`, `Retry-After`, degrade-open)
- [x] Source identifiers are no longer stored as raw IPs in limiter keys (hashed bucket key)
- [x] Oversized source header values are bounded and fall back safely (`unknown` bucket)
- [x] Stage 4 hardening notes document residual risks (header trust, in-memory consistency, observability gaps)
- [x] Tests/build pass after hardening changes
---
