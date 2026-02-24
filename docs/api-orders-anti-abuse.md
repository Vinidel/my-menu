# API Orders Anti-Abuse — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/api-orders-anti-abuse.md](briefs/api-orders-anti-abuse.md)

---

## What Was Delivered

- **Protected route:** Added anti-abuse protection to `POST /api/orders` only.
- **Rate limiting:** Fixed-window, per-source throttling with the locked threshold:
  - `5` requests per source per `5` minutes
- **Enforcement point:** Throttle check runs before JSON parsing and before customer/order DB writes.
- **Limited response:** Throttled requests return:
  - `429 Too Many Requests`
  - Portuguese message (pt-BR)
  - `Retry-After` header (seconds)
- **Best-effort source extraction:** Uses common proxy headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `forwarded`) with fallback to `unknown`.
- **Privacy hardening (Stage 4):** Limiter bucket keys use hashed source identifiers (`ip_hash:...`) instead of raw IPs.
- **Source parsing bounds (Stage 4):** Oversized source header values fall back safely to `unknown` instead of creating large attacker-controlled keys.
- **Degrade-open behavior:** If the limiter fails internally, the endpoint logs the issue and continues processing the order request.
- **Logging:** Throttled attempts and limiter failures are logged server-side without request bodies or customer PII.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Order submit API route | `app/api/orders/route.ts` |
| In-memory fixed-window limiter | `lib/anti-abuse/rate-limit.ts` |
| Route tests (anti-abuse + status mapping) | `app/api/orders/route.test.ts` |
| Stage 1 implementation notes | `docs/implementation-notes.md` |
| Stage 4 hardening notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Scope:** Protect `POST /api/orders` only (not all routes).
- **Primary defense:** Rate limiting (no CAPTCHA in this feature).
- **Threshold:** `5` requests per source per `5` minutes.
- **Source key:** Best-effort client IP; fallback bucket `unknown` when unavailable/unparseable.
- **User-facing throttle response:** HTTP `429` with Portuguese message.
- **Limiter placement:** Before `submitCustomerOrderWithClient(...)`.
- **Failure mode if limiter fails:** Degrade open (allow request, log server-side error).
- **No DB schema changes:** Anti-abuse is implemented at the API route layer in this feature.

---

## Known Gaps & Deferred Work

- **In-memory limiter is per-process only:** Limits are not shared across instances/regions, so effective throttling can be weaker in serverless multi-instance deployments.
- **No CAPTCHA / bot challenge:** This feature intentionally stops at source-based rate limiting.
- **No WAF/CDN integration:** Cloudflare/Vercel WAF rules are out of scope here.
- **No abuse telemetry dashboards:** Only server logs exist today; no metrics/alerts for throttle rates or limiter failures.
- **Header trust is deployment-dependent:** Source extraction trusts proxy headers and assumes deployment behind a trusted proxy/platform.

---

## Operational Notes

- **Behavior when throttled (`POST /api/orders`):**
  - returns `429`
  - includes `Retry-After`
  - response body uses pt-BR message (`validation` error code path)
- **Limiter backend:** In-memory `Map` stored on `globalThis` (`__my_menu_rate_limit_store__`)
  - test suites should reset it between tests (already done in `app/api/orders/route.test.ts`)
- **Store pruning:** Old buckets are pruned when the in-memory store grows past `500` keys (lightweight guardrail, not a strict memory cap)
- **Privacy posture:** Logs use hashed source keys (`ip_hash:...`); no raw IPs or request bodies should be logged in throttle/failure paths
- **No configuration required:** Current implementation uses no external anti-abuse provider and no new env vars

---

## For the Next Engineer

- **If abuse increases in production:** Replace the in-memory limiter with a shared/store-backed limiter (Redis/Upstash/etc.) while preserving the locked UX (`429`, pt-BR message, `Retry-After`, degrade-open/closed decision).
- **If you add CAPTCHA:** Layer it in front of or alongside the rate limiter in `POST /api/orders`, then document tuning and fallbacks.
- **If deployment changes (non-proxy/local edge cases):** Revisit header trust and source extraction logic in `app/api/orders/route.ts`.
- **If you refactor source parsing:** Add helper-level tests for `x-forwarded-for`, `forwarded`, IPv4+port, and IPv6 forms to avoid regressions.
