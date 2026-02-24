# Feature Brief — Anti-Abuse Protection for `/api/orders`

Status: Stage 0 — Framing
Date: 2026-02-24
Author: Orchestrator Agent

---

## Alternative Name

Proteção anti-spam do endpoint de pedidos / Rate limit para envio de pedidos / Defesa do `/api/orders`

---

## Problem

The customer order submission endpoint (`POST /api/orders`) is public and now uses a server-only service-role write path to create customers/orders in Supabase. This protects database permissions, but it does **not** prevent abuse (spam submissions, bot traffic, repeated automated requests, or burst traffic). Without anti-abuse controls, attackers can flood fake orders, consume resources, and pollute operational workflows for the burger place.

---

## Goal

Add a first anti-abuse layer to `POST /api/orders` that:
- Reduces spam/bot order submissions
- Limits burst traffic from a single source
- Preserves a usable experience for real customers
- Fails safely with clear Portuguese messages
- Does not expose secrets or weaken the current service-role security model

Success = repeated abusive requests are throttled/blocked before order creation, while normal customers can still submit valid orders with minimal friction.

---

## Who

- **Customers (public users):** Need reliable order submission and understandable feedback if temporarily limited.
- **Employees (indirect):** Benefit from reduced fake/spam orders in `/admin`.
- **Developers/operators:** Must configure anti-abuse dependencies (if any), monitor failures, and tune thresholds safely.

---

## What We Capture / Change

- **Protect endpoint:** `POST /api/orders` only (not all routes in this feature).
- **Request-source identification (locked for Stage 1 implementation):**
  - Use best-effort client IP from request headers / runtime request metadata
  - If IP cannot be determined, use a deterministic fallback bucket (`unknown`)
- **Rate limiting (required):**
  - Apply a per-source limit over a short rolling/fixed window (exact values locked below)
  - Enforce before calling order creation logic (`submitCustomerOrderWithClient`)
- **Response behavior when limited:**
  - Return HTTP `429 Too Many Requests`
  - Return a Portuguese user-facing message
  - Include `Retry-After` header (seconds) when available
- **Observability (minimum):**
  - Log throttled attempts server-side without PII payload dumps
  - Log enough context for tuning (source bucket key/IP hash/raw IP if acceptable, route, reason, retry seconds)
- **No changes to order schema** in this feature.
- **No changes to employee dashboard behavior** in this feature.

---

## Success Criteria

- [ ] `POST /api/orders` enforces a per-source rate limit before performing customer/order DB writes.
- [ ] Throttled requests return HTTP `429` with a clear Portuguese message.
- [ ] `Retry-After` header is included on throttled responses (if the limiter can determine retry time).
- [ ] Normal valid submissions within limit continue to succeed (`201`) without behavior regression.
- [ ] Rate limiting does not require exposing `SUPABASE_SERVICE_ROLE_KEY` or moving writes back to public client table access.
- [ ] Throttled attempts are logged server-side without logging full request bodies or customer PII.
- [ ] Missing anti-abuse provider/config (if an external provider is chosen) fails safely and is documented (degrade-open vs degrade-closed decision locked below).
- [ ] All user-facing error messages remain in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- CAPTCHA / Turnstile / reCAPTCHA integration (can be a follow-up feature if rate limiting is insufficient).
- Full bot detection / fingerprinting / device reputation systems.
- Global WAF/CDN configuration (Cloudflare, Vercel WAF, etc.) unless explicitly required by implementation choice.
- Abuse protection for other routes (`/admin`, `/api/*` broadly) in this feature.
- Permanent banning, admin moderation tools, or abuse analytics dashboard.
- Perfect attacker-proof protection (goal is practical risk reduction).

---

## Acceptance Scenarios

### Happy Paths

1. **Normal customer submits within limit.** Customer sends a valid order request and receives the usual success response (`201`) with no anti-abuse friction.
2. **Short burst under threshold still works.** A customer retries once (e.g., due to confusion or slow UI) but remains under the configured threshold and is not blocked.
3. **Limiter headers/metadata are handled safely.** Requests with standard proxy headers (e.g. `x-forwarded-for`) are processed and bucketed consistently.

### Unhappy Paths

1. **Burst abuse from one source.** Many requests from the same source exceed the configured threshold; endpoint returns `429` with a Portuguese message and does not create orders/customers.
2. **Limiter backend/provider unavailable (if external store/provider is used).** Endpoint follows the locked degrade behavior (below), logs the issue, and returns safe responses.
3. **Missing source IP.** Endpoint still applies a deterministic fallback bucket and handles requests safely.

---

## Edge Cases

- **Shared IPs (carrier NAT / office / apartment Wi-Fi):** Thresholds should avoid blocking normal low-volume shared users too aggressively.
- **Double-click / duplicate submit UX:** Legitimate rapid retries from the same user should tolerate brief accidental duplicates up to the configured threshold.
- **IPv6 / forwarded header formats:** IP extraction should handle comma-separated forwarded chains and IPv6 values safely.
- **Serverless/runtime scaling:** If the limiter is in-memory, limits may be inconsistent across instances; if external, operational dependency must be configured. Implementation choice and tradeoff must be explicit.
- **Proxy spoofing risk:** Trusting forwarded headers blindly can be unsafe depending on deployment. Implementation must use the runtime/deployment-appropriate source extraction strategy (documented in code/docs).

---

## Approach (High-Level Rationale)

1. **Protect at the API route boundary.** Enforce anti-abuse checks at the start of `POST /api/orders`, before JSON body parsing becomes expensive (if feasible) or before DB writes at minimum.
2. **Use source-based rate limiting first.** Start with a practical per-IP/source limit because it is simple, fast, and aligned with current small scale.
3. **Keep user messaging simple (pt-BR).** Throttled customers should receive a clear retry-later message, not internal abuse diagnostics.
4. **Preserve existing validation and service-role path.** Anti-abuse layers add a guard in front of current route logic; they do not replace request validation or order insert logic.
5. **Document tuning and operational constraints.** Thresholds, storage backend choice (in-memory vs hosted), and failure behavior must be explicitly documented to avoid silent regressions.

---

## Decisions (Locked)

- **Protected route:** This feature protects `POST /api/orders` only.
- **Primary defense in this feature:** Rate limiting (not CAPTCHA).
- **User-facing limited response:** HTTP `429` with Portuguese message.
- **Limiter placement:** Anti-abuse check runs before calling `submitCustomerOrderWithClient(...)`.
- **Threshold (initial, locked for this feature):** `5` requests per source per `5` minutes on `POST /api/orders`.
- **Source bucket key (initial):** Best-effort client IP; fallback to `unknown` bucket when unavailable.
- **Failure mode if limiter backend/provider is unavailable:** **Degrade open** (continue processing requests) but log a server-side warning/error. Rationale: avoid blocking all real customer orders due to anti-abuse dependency outage at current small scale.
- **Language:** User-facing throttle messages are Portuguese (pt-BR).
- **No DB schema changes:** Anti-abuse feature does not add/alter Supabase tables in this brief unless a dedicated storage-backed limiter migration is explicitly chosen in implementation and remains within scope.

---

## Open Implementation Choice (Must Be Resolved in Stage 1, Not Here)

Choose one anti-abuse storage strategy during implementation and document the tradeoff:

- **Option A: In-memory limiter (fastest to ship, weakest in serverless/multi-instance consistency)**
- **Option B: External/store-backed limiter (better consistency, requires config/provider dependency)**

The chosen option must still honor the locked threshold/UX and the degrade-open decision.

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
