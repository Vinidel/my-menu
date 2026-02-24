# Hardening Notes (Stage 4)

Risks, assumptions, and deferred items from the hardening sweep. Updated per feature as needed.

---

## Employee Auth — Stage 4

### Security

- **Input validation:** Login form validates non-empty email (trimmed) and password client-side before calling Supabase. Invalid credentials get a generic message ("E-mail ou senha incorretos."); no disclosure of whether the email exists. No raw user input rendered in HTML; error text is from constants. **No change.**
- **Secrets:** Only `NEXT_PUBLIC_*` env vars are used (URL and publishable key); no server-only secrets in client code. Production must set these in Vercel (or equivalent). **Documented.**
- **Auth enforcement:** Middleware protects `/admin` (except `/admin/login`); unauthenticated users are redirected to login. **No change.**

### Dependencies

- **npm audit:** 23 vulnerabilities (4 moderate, 19 high) reported after `npm install` (see `docs/implementation-notes.md`). Not addressed in this feature; consider a dedicated dependency/hardening pass or `npm audit fix` with review. **Deferred.**

### Performance

- **Middleware:** One `getUser()` call per matched request; no N+1. Supabase client timeouts are library defaults; no explicit timeout added in app code. **Acceptable for current scale.**
- **Login / logout:** Single auth calls; no heavy loops. **No change.**

### Observability

- **Auth events:** No server-side or structured logging of login success/failure or redirects. Debugging production auth issues would rely on client-side behaviour and Supabase dashboard. Consider adding structured logging (e.g. failed login attempt, redirect to login) in a future brief if ops need it. **Documented; not implemented.**

### Resilience

- **Middleware — Supabase down:** If `getUser()` throws (e.g. network or Supabase unavailable), middleware now catches the error and treats the user as unauthenticated, redirecting `/admin` requests to `/admin/login` (fail closed). **Fixed in Stage 4.**
- **Login page:** If Supabase is unavailable, `signInWithPassword` fails and the user sees the generic error message; no crash. **Acceptable.**
- **Missing env in production:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are unset, middleware does not redirect; a user could open `/admin` and see the admin layout (with no data and no Sair until they’d never have been “logged in”). This is a deployment/configuration issue. Optional hardening: when env is missing and path is under `/admin` (except `/admin/login`), redirect to `/admin/login` so the setup message is shown. See also `docs/critique.md`. **Documented; not implemented (product/deployment decision).**

### Summary

| Area          | Status   | Action |
|---------------|----------|--------|
| Security      | OK       | None   |
| Dependencies  | Deferred | npm audit pass later |
| Performance   | OK       | None   |
| Observability | Gap      | Documented; optional logging in future |
| Resilience    | Improved | Middleware try/catch (fail closed) applied |

---

## Employee Orders Dashboard — Stage 4

### Security

- **Auth and authorization:** `/admin` remains protected by middleware from the auth feature; server-side status progression also validates an authenticated session via `supabase.auth.getUser()` before updating orders. **No change.**
- **Status integrity (direct API bypass):** UI already enforced forward-only transitions, but the database previously allowed any authenticated user to set any allowed status value directly (including reverse/jump transitions) if they called Supabase outside the UI. This violated the locked brief workflow. **Fixed in Stage 4** with a DB trigger migration enforcing only `aguardando_confirmacao -> em_preparo -> entregue` (`supabase/migrations/20260223_000002_enforce_order_status_transitions.sql`).
- **Input handling:** Order IDs and statuses used in the server action are not rendered back into HTML unsafely. User-facing error messages are constant strings in Portuguese. **No change.**

### Dependencies

- **Typed Supabase workaround:** `app/admin/actions.ts` uses narrow cast helpers around Supabase query chains due `@supabase/ssr` / generic inference returning `never` for `.update()` in this project setup. This is a type-safety gap (compile-time only), not a runtime vulnerability. Consider replacing with generated client wrappers or revisiting library versions in a dedicated upgrade task. **Documented; not fixed in Stage 4.**
- **npm audit backlog:** Existing dependency vulnerability backlog from prior stages remains (see App Skeleton / Employee Auth notes). **Deferred.**

### Performance

- **Orders dashboard query:** Reads a single ordered list from `orders` with indexed `created_at` and no pagination. Acceptable for current small-scale, single-tenant scope. **No change.**
- **UI summary counts:** Counts are computed in-memory from fetched rows. Fine at current scale; can move server-side or paginate in a future brief if volume grows. **No change.**

### Observability

- **Order load/update logging:** Server-side logging exists for order load failures, auth validation failures during updates, status update failures, and stale update rejections (`app/admin/page.tsx`, `app/admin/actions.ts`). Logs include IDs/statuses and error codes/messages, but no customer PII. **Acceptable for current scope.**
- **Structured monitoring:** No tracing/metrics around order update throughput or failure rates. **Documented; deferred.**

### Resilience

- **Stale/concurrent updates:** Server action uses conditional update (`id` + current `status`) and returns a deterministic stale result that the UI handles by refreshing the selected order status label. **Implemented and covered by tests.**
- **Supabase unavailable:** Order load/update failures return generic Portuguese messages and log details server-side. UI does not crash. **Acceptable.**
- **Missing env vars:** `/admin` page shows a setup message when Supabase env vars are missing. This is a deployment/config issue; no further change in this stage. **Documented.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | DB trigger enforces forward-only status transitions |
| Dependencies  | Deferred  | Supabase typing workaround + audit backlog documented |
| Performance   | OK        | No changes needed for current scale |
| Observability | OK/Gap    | Basic logs present; metrics/tracing deferred |
| Resilience    | OK        | Stale update handling and graceful errors already in place |

---

## Customer Order Submission — Stage 4

### Security

- **Server-only privileged writes:** `POST /api/orders` uses `SUPABASE_SERVICE_ROLE_KEY` server-side to create/reuse customers and insert orders while returning the generated reference. Public table access previously added for prototyping has been locked down by migration `supabase/migrations/20260224110000_lock_down_public_order_submission_tables.sql`. **Improved.**
- **Input validation and bounds:** The submission logic validates required fields, basic email format, menu item ids, and positive quantities. Stage 4 adds upper bounds for customer field lengths, optional notes length, and maximum line items per request to reduce abuse via oversized payloads (`app/actions.ts`). **Improved.**
- **Public endpoint abuse risk:** `/api/orders` is a public endpoint and still has no rate limiting, CAPTCHA, or bot detection. Service-role reduces DB permission exposure but does not prevent spam. **Deferred hardening item.**

### Dependencies

- **Service-role secret management:** `SUPABASE_SERVICE_ROLE_KEY` is now required for order submission. This must remain server-only and never appear in `NEXT_PUBLIC_*`. No code change needed beyond current separation, but deployment config must enforce this. **Documented.**
- **Supabase typing workaround:** The customer submission path still uses local typed-cast helpers for Supabase query chains (`app/actions.ts`) due inference friction in this project setup. Compile-time safety gap only. **Deferred.**

### Performance

- **Payload handling:** `/api/orders` now rejects oversized request bodies (>32KB) before JSON parsing. This is a simple guardrail, not a full DoS defense. **Improved.**
- **Menu lookup:** Menu item validation uses an in-memory map from local JSON (`getMenuItemMap()`), which is acceptable for the current small static menu. **No change.**

### Observability

- **Submission error logs:** Server-side logs already capture customer dedupe/order insert failures without rendering internal details to users. Stage 4 keeps this and adds no PII to new route-level errors. **Acceptable for current scope.**
- **Metrics/rate tracking:** No metrics on submit volume/error rates, no request correlation IDs, no abuse dashboards. **Deferred.**

### Resilience

- **Request format validation:** `/api/orders` now rejects non-JSON requests (`415`) and malformed JSON (`400`) with Portuguese messages. **Improved.**
- **Caching behavior:** `/api/orders` responses now send `Cache-Control: no-store` to avoid unintended caching of success/error payloads. **Improved.**
- **Setup readiness UX:** The public `/` page now treats order submission as “configured” only when `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are present, reducing submit-time `503` surprises. **Improved.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Locked down public table access; added input bounds |
| Dependencies  | Deferred  | Secret hygiene + typing workaround documented |
| Performance   | Improved  | Request size guard added |
| Observability | Gap       | Logs only; metrics/rate telemetry deferred |
| Resilience    | Improved  | Content-type/JSON checks + no-store + setup readiness |

---

## API Orders Anti-Abuse — Stage 4

### Security

- **Rate limiting active on public endpoint:** `POST /api/orders` is now throttled at `5` requests per source per `5` minutes before JSON parsing and before any Supabase work. Throttled requests return `429` with a Portuguese message and `Retry-After`. **Implemented in Stage 1; validated in Stage 2.**
- **Source privacy in limiter keys:** Stage 4 changes the limiter bucket key from raw IP (`ip:...`) to a SHA-256 hash (`ip_hash:...`) so the in-memory limiter store no longer retains plaintext client IP addresses. Logs already used hashed values. **Improved in Stage 4.**
- **Source parsing bounds:** Stage 4 adds a maximum source token length (256 chars) when parsing IP headers. Oversized/malformed values now fall back to the shared `unknown` bucket instead of becoming large attacker-controlled limiter keys. **Improved in Stage 4.**
- **Header trust boundary:** IP source extraction still relies on proxy headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `forwarded`). This is acceptable only when deployed behind a trusted proxy/platform (e.g. Vercel/Cloudflare). If deployed elsewhere, header trust rules may need to be tightened or replaced with platform-native request IP APIs. **Documented; deployment-dependent.**

### Dependencies

- **No new external dependencies:** The limiter remains in-process (`Map`), avoiding third-party rate-limit services or Redis clients in this feature. This keeps complexity low but also limits global consistency. **No change.**
- **Node runtime hashing:** The route uses `node:crypto` for hashing source keys/log values. This is stable in the current Next.js Node runtime target but would need review if the route is moved to an Edge runtime. **Documented.**

### Performance

- **Short-circuit before heavy work:** Throttling still runs before request parsing and DB access, reducing wasted work under burst abuse. **No change.**
- **Store growth control:** The in-memory store prunes old buckets when size exceeds `500`, which is acceptable as a lightweight guardrail for current scale. It is not a strict memory cap and could still drift under distributed/serverless traffic patterns. **Acceptable for now; deferred for stronger limiter backend.**

### Observability

- **Throttle logging:** Throttled events log route, hashed source key (or `unknown`), and retry time. No request bodies or customer PII are logged. **Acceptable for current scope.**
- **No abuse telemetry/alerts:** There is still no metrics pipeline for throttle counts, limiter failures, or per-source trends. Production abuse monitoring will rely on raw logs until a future observability pass. **Deferred.**

### Resilience

- **Limiter failure mode:** The endpoint intentionally degrades open if the limiter helper throws, and logs the failure. This avoids blocking legitimate orders during internal limiter issues but weakens abuse protection during outages. **Explicitly accepted by brief; no change.**
- **In-memory consistency limits:** The limiter is per-process and not shared across instances/regions. Bursts can bypass the effective threshold in serverless multi-instance deployments. This remains the main known limitation and should be addressed by a store-backed limiter (Redis/Upstash/etc.) in a future feature if abuse becomes a problem. **Deferred by design.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Hashed limiter keys + source token length bounds |
| Dependencies  | OK/Deferred | No new deps; edge-runtime compatibility noted |
| Performance   | OK        | Early throttle and lightweight pruning retained |
| Observability | Gap       | Logs only; no abuse metrics/alerts |
| Resilience    | Deferred  | Degrade-open + in-memory multi-instance inconsistency accepted |
