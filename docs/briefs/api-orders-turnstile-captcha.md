# Feature Brief — CAPTCHA Invisible (Cloudflare Turnstile) on `/api/orders`

Status: Stage 5 — Documentation Complete (pending Critic)
Date: 2026-02-25
Author: Orchestrator Agent

---

## Alternative Name

Turnstile no envio de pedido / Invisible CAPTCHA for order submit / Bot protection on `/api/orders`

---

## Problem

`POST /api/orders` is a public endpoint. Existing rate limiting helps, but bot/spam traffic can still submit automated requests.

We need a stronger anti-abuse check at submit time, without adding friction-heavy visible CAPTCHA UI.

---

## Goal

Add **Cloudflare Turnstile (invisible challenge)** to the customer order submit flow so each order request is validated server-side before any DB write.

Success = valid human submissions continue to work, bot/invalid CAPTCHA submissions are rejected, and production always enforces CAPTCHA verification.

---

## Who

- **Customers (public users):** Submit real orders with minimal friction.
- **Employees:** Receive fewer spam/fake orders.
- **Operators/developers:** Keep abuse controls strong in production while allowing controlled non-prod bypass for development/testing.

---

## What We Capture / Change

- **Customer UI (`/`)**
  - Integrate invisible Turnstile challenge on order submit flow
  - Include challenge token in submit payload to `/api/orders`
- **Server/API (`POST /api/orders`)**
  - Verify Turnstile token with Cloudflare before customer/order writes
  - Reject invalid/missing token requests
- **Configuration**
  - Add env-driven CAPTCHA enable/disable behavior with production enforcement

---

## Out of Scope

- Replacing existing rate limiting (kept as-is)
- Changing order schema or DB tables
- Multi-provider CAPTCHA support
- Complex risk scoring/ML fraud system

---

## Success Criteria (Exit-Oriented)

- [ ] `/` submit flow obtains a Turnstile token using **invisible** challenge mode.
- [ ] `POST /api/orders` verifies Turnstile token server-side before DB writes.
- [ ] Invalid/missing token returns a Portuguese validation error and does not create order.
- [ ] Turnstile verification service failure returns `503` (fail closed).
- [ ] Existing rate limiter still runs (CAPTCHA is additive).
- [ ] CAPTCHA can be disabled via env in non-production environments.
- [ ] Production always enforces CAPTCHA verification regardless of toggle value.
- [ ] Client submit payload includes `turnstileToken: string` (locked field name/type).
- [ ] When CAPTCHA is required but Turnstile env keys are missing, `/api/orders` returns deterministic `503` (no order write).

---

## Happy Paths (Acceptance Scenarios)

1. **Valid human submit:** Customer fills order, invisible challenge resolves, token verifies, order is created.
2. **Normal production flow:** CAPTCHA verification is always active and valid orders continue successfully.

---

## Unhappy Paths / Edge Cases

1. **Missing token:** Client submits without token; server returns `400` with pt-BR message.
2. **Invalid/expired token:** Server verification fails; returns `400`, no order created.
3. **Cloudflare verify unavailable:** Server cannot verify token due upstream/network failure; returns `503` (no order created).
4. **Non-production bypass:** When explicitly disabled by env in non-production, submit works without Turnstile verification.

---

## Locked Decisions (Stage 0)

1. **CAPTCHA provider:** Cloudflare Turnstile.
2. **Challenge mode (locked):** **Invisible challenge** (no explicit visible checkbox requirement).
3. **Verification location:** Server-side in `/api/orders` before any write.
4. **Failure mode for verify outages:** Fail closed (`503`), no order write.
5. **Environment toggle (locked):**
   - Add env var: `ORDERS_CAPTCHA_ENABLED`
   - `ORDERS_CAPTCHA_ENABLED=false` may disable CAPTCHA only in non-production.
   - **Production enforcement condition (locked):** `process.env.NODE_ENV === "production"`.
   - In production (`NODE_ENV === "production"`), CAPTCHA is always enforced regardless of toggle value.
6. **Client payload contract (locked):** `/api/orders` request body includes `turnstileToken: string`.
7. **Missing Turnstile keys behavior (locked):** if CAPTCHA is required and either Turnstile site/secret key is missing, server returns `503` setup/config error and does not create order.
8. **Language:** User-facing error/setup messages remain pt-BR.
9. **Existing anti-abuse controls:** Rate limiter remains active and unchanged.

---

## Data / API / Schema Impact

- **No DB schema changes**
- **`/api/orders` payload extension (locked):** include `turnstileToken: string`
- **No changes to order storage model**

---

## Technical Notes for Implementer

- Client needs Turnstile site key (public env) and invisible widget integration.
- Server needs Turnstile secret key (server-only env) for verify endpoint call.
- Verify token before invoking shared order submit logic/write path.
- Keep current HTTP status contract style:
  - validation issues: `400`
  - setup/availability issues: `503`
- Ensure bypass logic is explicit and production-safe.

---

## Stage 1 Implementation Choice To Lock

Implementer must lock and document:

- **Client integration approach** for invisible challenge (library/component strategy)
- **Server verification module location** (route-local helper vs shared anti-abuse lib)
