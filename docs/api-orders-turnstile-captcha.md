# API Orders Turnstile CAPTCHA — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/api-orders-turnstile-captcha.md](briefs/api-orders-turnstile-captcha.md)

---

## What Was Delivered

- **Invisible Turnstile on customer submit flow:** `/` now integrates Cloudflare Turnstile invisible challenge in checkout submit flow.
- **Locked payload contract:** Customer submit payload includes `turnstileToken` when CAPTCHA is required.
- **Server-side verify gate on `/api/orders`:** Token verification runs before any customer/order write path.
- **Fail-closed verify behavior:** Invalid/missing token returns `400`; Turnstile upstream/config unavailability returns `503`; no order write in both paths.
- **Deterministic config failure:** When CAPTCHA is required and site/secret keys are missing, `/api/orders` returns deterministic `503`.
- **Environment-gated enforcement:** CAPTCHA can be disabled only in non-production via `ORDERS_CAPTCHA_ENABLED=false`; production always enforces (`NODE_ENV=production`).
- **Stage 4 hardening:** Added Turnstile verify timeout (`5s`) and trimmed env-key validation (whitespace-only keys treated as missing).
- **Customer feedback UX:** Pending verification uses info-style status message (`Verificando segurança...`) to avoid false error perception.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| CAPTCHA requirement toggle logic | `lib/anti-abuse/captcha-config.ts` |
| Public page wiring (`isCaptchaRequired`, `turnstileSiteKey`) | `app/page.tsx` |
| Customer Turnstile integration + submit flow | `components/customer-order-page.tsx` |
| `/api/orders` Turnstile verification + fail-closed handling | `app/api/orders/route.ts` |
| Route tests (CAPTCHA behavior + hardening paths) | `app/api/orders/route.test.ts` |
| CAPTCHA config unit tests | `lib/anti-abuse/captcha-config.test.ts` |
| Customer UI tests for CAPTCHA guardrails/feedback | `components/customer-order-page.test.tsx` |
| Stage 4 risk notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Provider:** Cloudflare Turnstile.
- **Challenge mode:** Invisible challenge.
- **Verify location:** Server-side in `POST /api/orders` before DB writes.
- **Failure policy:** Fail closed for verify/config outages (`503`), no order write.
- **Toggle policy:** `ORDERS_CAPTCHA_ENABLED=false` may disable only in non-production.
- **Production override:** `NODE_ENV === "production"` always enforces CAPTCHA.
- **Request contract:** `/api/orders` accepts `turnstileToken` in request body when CAPTCHA is required.
- **Language:** User-facing messages remain pt-BR.

---

## Environment Variables

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - required when CAPTCHA is enforced
  - used in client widget rendering
- `TURNSTILE_SECRET_KEY`
  - required when CAPTCHA is enforced
  - server-only verify secret
- `ORDERS_CAPTCHA_ENABLED`
  - non-production toggle
  - accepted disabled values: `0`, `false`, `off`, `no`
  - ignored in production (CAPTCHA still enforced)

---

## Known Gaps & Deferred Work

- **No provider fallback:** If Turnstile is unavailable, order submit intentionally fails closed (`503`); no secondary anti-bot provider is configured.
- **No circuit breaker/backoff:** Verify upstream failures are handled per-request; no progressive backoff mechanism yet.
- **No CAPTCHA telemetry dashboard:** There is no metric stream for token failure rates or verify latency; operational visibility relies on logs.
- **No e2e browser challenge test:** Current coverage is unit/component/route-level with mocks; live Turnstile flow should be validated in staging smoke tests.

---

## Operational Notes

- **Production behavior:** CAPTCHA is always enforced when `NODE_ENV=production`, regardless of `ORDERS_CAPTCHA_ENABLED`.
- **Non-production behavior:** Set `ORDERS_CAPTCHA_ENABLED=false` to bypass CAPTCHA locally/in test environments.
- **Failure responses:**
  - missing/invalid token: `400` (`validation`)
  - missing required Turnstile keys: `503` (`setup`)
  - verify upstream/network/timeout failure: `503` (`setup`)
- **Timeout behavior:** Turnstile verify request is bounded to `5s` and fails closed on timeout/abort.
- **Security boundary:** `TURNSTILE_SECRET_KEY` must remain server-only and never be exposed via `NEXT_PUBLIC_*`.

---

## For the Next Engineer

- **If adding telemetry:** Capture verify latency, failure classes, and per-route CAPTCHA reject rates.
- **If adding fallback strategy:** Introduce a brief for provider-fallback/circuit-breaker behavior since it changes availability tradeoffs.
- **If changing CAPTCHA payload contract:** Update `components/customer-order-page.tsx`, `app/api/orders/route.ts`, tests, and this doc together.
- **If moving to Edge runtime:** Revalidate timeout/crypto/runtime behavior in `/api/orders` before migrating.
