# Hardening Notes (Stage 4)

Risks, assumptions, and deferred items from the hardening sweep. Updated per feature as needed.

---

## Customer E-mail Optional — Stage 4

### Security

- **Tampered payload-shape rejection:** Server submission now explicitly rejects non-string `customerEmail` payload values with validation error (`Informe um e-mail válido.`), preventing silent coercion of unexpected JSON shapes to “missing e-mail”. **Improved in Stage 4.**
- **Canonical missing-value storage:** Migration enforces `NULL`-based storage for absent e-mail in `orders.customer_email`, `customers.email`, and `customers.email_normalized` (no empty-string ambiguity). **Improved in Stage 4.**
- **Identity consistency constraints:** `customers` now enforces paired-null consistency (`email` and `email_normalized` both null or both non-null), reducing partial/invalid identity states from manual writes. **Improved in Stage 4.**

### Dependencies

- **No new dependencies:** Hardening relies on existing validation logic and SQL constraints/indexes only. **No change.**

### Performance

- **Dedupe paths remain indexed:** Partial unique indexes cover both dedupe modes (`email+phone` when e-mail exists, `phone` when e-mail is missing), keeping lookup/conflict paths efficient at current scale. **Improved in Stage 4.**

### Observability

- **Operational visibility unchanged:** Existing error logs cover customer lookup/insert/upgrade failures, but there are no dedicated counters for optional-email validation rejects or dedupe conflict retries. **Deferred.**

### Resilience

- **Concurrent phone-only submits:** Insert conflict (`23505`) retry path is covered for no-email flow, aligning with partial unique index behavior and preventing duplicate-customer divergence under race conditions. **Improved in Stage 4.**
- **Phone-only to e-mail upgrade safety:** Upgrade keeps deterministic single-customer identity by updating only rows that are still phone-only (`email_normalized is null`) and re-querying on race/conflict outcomes. **Improved in Stage 4.**
- **Deferred:** No explicit transactional wrapper around “lookup -> optional upgrade -> insert” flow; current behavior relies on unique constraints + retry, which is acceptable for current single-tenant small scale. **Deferred.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Added non-string e-mail rejection + NULL consistency constraints |
| Dependencies  | OK        | No dependency changes |
| Performance   | Improved  | Partial unique indexes for both dedupe modes |
| Observability | Gap       | Logs only; no dedicated optional-email metrics |
| Resilience    | Improved  | Conflict retry + deterministic phone-only upgrade behavior |

---

## Order Standard Ingredients Removal — Stage 4

### Security

- **Customization ID bounds:** Server normalization now rejects oversized `extraIds` / `removedIngredientIds` values (> `80` chars) in `submitCustomerOrderWithClient`, reducing risk of oversized attacker-controlled IDs in public submit payloads. **Improved in Stage 4.**
- **Server authority unchanged:** `removedIngredientIds` are still validated against `menuItem.removableIngredients[].id`; unknown/tampered values fail validation and do not create orders. **No change.**

### Dependencies

- **No new dependencies:** Hardening uses existing server logic only; no package/runtime changes. **No change.**

### Performance

- **No material runtime cost increase:** Added length checks are O(n) over existing ID normalization loops and negligible at current payload limits. **No change.**

### Observability

- **Validation-path behavior:** Oversized customization IDs return the existing validation response path (`validation` code + pt-BR message). No new logging added to avoid noisy PII-adjacent payload traces. **Accepted for current scope.**

### Resilience

- **Merge-key collision hardening:** Cart/server aggregation keys for customization combinations now use structured serialization (`JSON.stringify([menuItemId, extraIds, removedIngredientIds])`) instead of delimiter-joined strings, avoiding edge-case collisions when IDs contain delimiter-like characters. **Improved in Stage 4.**
- **Deferred:** No dedicated telemetry for “rejected by customization bounds” rates yet; if needed, add coarse counters in a future observability pass. **Deferred.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Added max-length bounds for customization IDs |
| Dependencies  | OK        | No dependency changes |
| Performance   | OK        | Constant-time/linear checks only |
| Observability | Gap       | Uses existing validation path; no new counters/log metrics |
| Resilience    | Improved  | Structured merge keys remove delimiter collision edge cases |

---

## API Orders Turnstile CAPTCHA — Stage 4

### Security

- **CAPTCHA config normalization:** `/api/orders` now trims Turnstile env keys before validation. Whitespace-only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` or `TURNSTILE_SECRET_KEY` is treated as missing config and returns deterministic `503` with no order write. **Improved in Stage 4.**
- **Fail-closed behavior retained:** Missing/invalid token and verification failures still block writes and keep user-facing messages in pt-BR. **No change.**

### Dependencies

- **No new packages:** Hardening uses native `AbortController` timeout and local validation helpers only. **No change.**

### Performance

- **Bounded verify latency:** Turnstile verify call now has a request timeout (`5s`) so `/api/orders` does not hang indefinitely on upstream stalls. Timeout path returns `503` and avoids backend resource saturation under upstream instability. **Improved in Stage 4.**

### Observability

- **Timeout/error log context:** Turnstile verify failure logs now include error type (`name`) and message for faster diagnosis of abort/network failures without exposing request payloads. **Improved in Stage 4.**

### Resilience

- **Upstream timeout fail-closed:** Abort/timeout behaves the same as other Turnstile upstream failures (`503` setup error, no order write), preserving deterministic behavior under degraded network conditions. **Improved in Stage 4.**
- **Deferred:** No circuit-breaker/backoff yet for repeated upstream failures; acceptable for current small scale and can be added if repeated incidents occur. **Deferred.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Trimmed key validation for required Turnstile env vars |
| Dependencies  | OK        | No new dependencies |
| Performance   | Improved  | Added 5s timeout for Turnstile verify call |
| Observability | Improved  | Error type added to Turnstile failure logs |
| Resilience    | Improved  | Deterministic fail-closed timeout behavior |

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

---

## Menu Import Server Worker (PGMQ) — Stage 4

### Security

- **Worker auth hardened:** Primary worker (`supabase/functions/menu-import-worker`) requires `x-worker-secret` and denies unauthorized calls; fallback Next API worker path validates bearer token and returns `401` for invalid bearer when secret auth is configured. **Improved in Stage 4.**
- **Owner-only fallback retained:** Manual fallback endpoint remains protected by existing owner allowlist/session checks when worker-secret auth is not used. **No change.**

### Dependencies

- **Supabase capability dependency:** Queue/scheduler flow depends on `pgmq`, `pg_cron`, and `pg_net` availability in Supabase project configuration. **Documented operational dependency.**
- **No new npm packages:** Queue and worker changes rely on existing stack plus Supabase SQL/Edge runtime. **No change.**

### Performance

- **Bounded processing per invocation:** Worker processes a bounded message batch per run to keep execution time predictable and align with cron cadence. **Improved in Stage 4.**
- **Browser polling decoupled from processing:** `ProcessingPoller` now refreshes UI only; it no longer triggers extraction work, preventing user-activity-driven throughput variance. **Improved in Stage 4.**

### Observability

- **Queue-processing logs expanded:** Processor and fallback route now log job IDs/status transitions and ack/delete outcomes, making stuck/failed messages diagnosable. **Improved in Stage 4.**
- **Deferred:** No centralized metrics/alerts yet for queue depth, retry counts, or worker SLA. **Deferred.**

### Resilience

- **Retry + terminal-failure handling:** Failed processing is retried up to configured max attempts; terminal failures preserve active menu and mark draft/job failure metadata. **Improved in Stage 4.**
- **Ack failure surfaced explicitly:** Fallback route returns `acked: false` when queue delete fails, preventing false “successfully consumed” assumptions in operations/debugging. **Improved in Stage 4.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Secret-based worker auth + stricter invalid bearer handling |
| Dependencies  | Deferred  | Supabase queue/cron/net capabilities required |
| Performance   | Improved  | Bounded worker batches + UI-only poller |
| Observability | Improved  | Better queue/ack logging; metrics still deferred |
| Resilience    | Improved  | Retry policy + explicit ack-failure surfacing |

---

## Admin Orders Dashboard UX (Mobile Accordion + Status-First Sorting) — Stage 4

### Security

- **No new privilege changes:** This feature is UI-only and reuses the existing protected `/admin` route plus the previously hardened status progression server action. No new Supabase permissions, RLS policies, or schema changes were introduced. **No change.**
- **Display sorting only:** Status-first ordering is a client-side display sort and does not alter persisted data or server authorization logic. **No change.**

### Dependencies

- **No new dependencies:** The mobile accordion and responsive behavior use existing React/Next.js APIs plus current UI components. **No change.**
- **`matchMedia` reliance:** The responsive interaction model depends on browser `window.matchMedia`; tests mock this API. This is standard for client UI but should be considered if the component is heavily refactored or extracted. **Documented.**

### Performance

- **Client-side sorting:** Orders are sorted in-memory in the dashboard component by status priority and timestamp. This is acceptable for the current small-scale order volume and avoids extra server query complexity. **Acceptable for current scope.**
- **Duplicate detail UI rendering on mobile:** The desktop detail panel remains mounted in the DOM and is hidden on mobile via CSS when `isMobileViewport` is true, while the mobile accordion details render inline. This is acceptable at current scale; if order detail content grows substantially, consider conditional rendering or layout-level branching for mobile/desktop to reduce duplicated render work. **Documented; deferred optimization.**

### Observability

- **No new UX interaction telemetry:** The feature adds no logs/metrics for accordion opens, mobile usage, or sorting behavior. This is acceptable for current scope; production issues will rely on manual QA/user reports. **Deferred.**

### Resilience

- **Mobile accordion semantics hardening:** Stage 4 adds explicit accordion accessibility linkage on mobile (`aria-controls` on trigger + labeled `role="region"` panel) and avoids exposing misleading `aria-expanded` semantics on desktop where the accordion interaction is not active. **Improved in Stage 4.**
- **Responsive breakpoint behavior:** Mobile accordion mode is controlled by client-side `matchMedia` (`< 768px`, Tailwind `md` breakpoint). There can be a brief initial desktop-style render before the client effect runs on mobile devices (standard client-rendered responsive behavior). This is acceptable for current scope. **Documented.**
- **Reordering after status progression:** When a mobile-expanded order progresses status, it may move to a different list position due to status-first sorting. Current behavior keeps state consistent and remains functional; UX is covered by tests but not further optimized (e.g., scroll anchoring/animation). **Acceptable; deferred polish.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | UI-only changes; existing auth/update hardening reused |
| Dependencies  | OK        | No new deps; `matchMedia` reliance documented |
| Performance   | OK/Deferred | In-memory sorting fine; duplicated mobile/desktop detail rendering documented |
| Observability | Gap       | No interaction telemetry |
| Resilience    | Improved  | Mobile accordion accessibility semantics hardened |

---

## Admin Orders Dashboard Polling (TanStack Query) — Stage 4

### Security

- **Authenticated polling read path:** Polling uses `GET /api/admin/orders`, which performs a server-side auth check (`supabase.auth.getUser()`) before querying `orders`. This preserves the brief’s no-public-read requirement and avoids exposing employee order data through a public endpoint. **Implemented in Stage 1; no change.**
- **Response cache/privacy headers:** Stage 4 strengthens route responses with `Cache-Control: private, no-store` plus `Vary: Cookie` on all success/error responses. This reduces the risk of intermediary/shared-cache misuse for authenticated polling responses and makes the user-specific nature of the route explicit. **Improved in Stage 4.**

### Dependencies

- **TanStack Query defaults constrained for determinism:** Polling already disabled focus refetch to honor the brief’s visibility-restore contract. Stage 4 also disables reconnect refetch (`refetchOnReconnect: false`) to avoid surprise extra requests outside the locked polling cadence in unstable network environments. **Improved in Stage 4.**
- **No new backend dependencies:** Polling remains route + browser fetch + TanStack Query only; no websocket/realtime service or cache layer added. **No change.**

### Performance

- **Polling load profile:** `10s` polling per open admin tab remains acceptable for the current small-scale scope, but multiple tabs still multiply requests linearly. This feature intentionally accepts that tradeoff. **Documented; deferred for future optimization (shared/store-backed state or realtime).**
- **Hidden-tab pause:** Polling stops when the tab is hidden and resumes with one immediate refetch on visibility restore, reducing unnecessary background requests. **Implemented and tested.**

### Observability

- **Route error logging:** `GET /api/admin/orders` logs query failures and unexpected errors server-side without customer PII. There is still no metric/telemetry for polling failure rates or refetch counts. **Acceptable for current scope; deferred.**
- **Client polling visibility:** UI shows a pt-BR non-destructive polling failure banner when background refreshes fail, but no structured client telemetry exists. **Improved UX, observability still limited.**

### Resilience

- **Background polling failures:** Dashboard keeps last successful data visible and shows a non-destructive pt-BR feedback banner rather than blanking the UI. **Improved and covered by tests.**
- **In-flight mutation conflict handling:** Polling merges preserve the local pending UI state for the order currently being progressed, preventing the poll response from clobbering that in-flight mutation state. **Implemented and covered by tests.**
- **Visibility restore behavior:** Polling triggers one immediate refetch on visibility restore, then resumes the `10s` cadence. Stage 4 keeps this deterministic by avoiding extra focus/reconnect-triggered refetches. **Improved.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Added `private, no-store` + `Vary: Cookie` on polling route responses |
| Dependencies  | Improved  | Disabled reconnect refetch for deterministic polling behavior |
| Performance   | OK/Deferred | Hidden-tab pause is good; multi-tab polling load still accepted |
| Observability | Gap       | Logs and UI feedback only; no polling metrics |
| Resilience    | Improved  | Background failure banner + mutation conflict preservation + deterministic restore behavior |

---

## Order Item Extras / Customization — Stage 4

### Security

- **Server-side validation authority remains intact:** `/api/orders` / shared submit logic validates `extraIds` against the current `data/menu.json` and derives persisted extras snapshots server-side. This still prevents tampered client payloads from injecting arbitrary extras names into newly created orders. **No change.**
- **Admin rendering safety for persisted JSON:** Historical/manual `orders.items` JSON can still contain malformed or oversized `extras` arrays/strings. Stage 4 hardens `lib/orders.ts` parsing by bounding parsed extras per item (`20`) and truncating oversized extras `name`/`id` values before rendering in `/admin`. This reduces UI/performance risk from untrusted persisted JSON while preserving backward compatibility. **Improved in Stage 4.**

### Dependencies

- **No new dependencies:** Extras hardening uses local parser bounds only; no schema changes or external libraries were added. **No change.**

### Performance

- **Defensive parse bounds:** Limiting parsed extras per item in `/admin` prevents pathological large JSON arrays from expanding into large DOM/text payloads. This is a lightweight resilience guard, not a replacement for database/data hygiene. **Improved.**

### Observability

- **No new extras-specific telemetry:** There are still no logs/metrics for malformed historical extras payloads encountered during admin rendering. Current behavior degrades silently by truncating/ignoring invalid entries. **Acceptable for current scope; deferred if data import tooling is added.**

### Resilience

- **Backward compatibility preserved:** Legacy orders without `extras` continue to parse normally; customized orders with valid extras still render the same `Extras:` line in `/admin`. New parser bounds are defensive and do not change happy-path behavior. **Improved with tests.**
- **Unknown historical shapes:** Parser continues to read extras defensively from multiple common keys (`name`, `nome`, `label`, `title`) while dropping invalid entries. Stage 4 adds limits, not stricter schema enforcement, to avoid breaking old data. **Acceptable.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Bounded/truncated extras parsing in `/admin` for persisted JSON safety |
| Dependencies  | OK        | No new deps |
| Performance   | Improved  | Prevents oversized extras arrays from bloating admin render payloads |
| Observability | Gap       | No malformed-extras telemetry |
| Resilience    | Improved  | Defensive parser bounds with backward compatibility preserved |

---

## Admin Order Total Amount Display — Stage 4

### Security

- **Server pricing authority preserved:** New order pricing snapshots continue to be derived server-side from `data/menu.json` in the customer submit path; `/admin` totals are computed from persisted snapshots, not client-provided values. This preserves the Stage 1 trust boundary and avoids client-side price tampering affecting admin totals. **No change in Stage 4.**
- **Malformed persisted pricing data safety:** `orders.items` is persisted JSON and may contain manual/legacy/malformed values. Stage 4 hardens `/admin` pricing parsing to reject invalid numeric snapshots (negative values, non-finite values, and implausibly large cents values) and fall back to `Total do pedido: Indisponível` instead of displaying misleading totals. **Improved in Stage 4.**

### Dependencies

- **No new dependencies:** Hardening uses local parser guards and tests only; no schema changes, DB migrations, or external libraries were added. **No change.**

### Performance

- **Bounded numeric parsing:** Added upper bounds for parsed unit price, extra price, line total, and aggregate order total in the admin parser. This prevents extreme values from propagating into formatting/rendering and keeps calculations cheap. **Improved.**
- **Fallback over recovery:** When pricing snapshots are malformed/out-of-range, the parser marks the total unavailable rather than attempting partial recovery. This is computationally simple and aligns with the brief’s conservative “no misleading partial totals” rule. **No change in user-facing contract; implementation hardened.**

### Observability

- **No malformed-pricing telemetry yet:** The parser degrades silently to `Indisponível` and does not emit logs/metrics when pricing snapshots are rejected. This avoids noisy logs during admin rendering but makes data-quality issues less visible operationally. **Deferred.**

### Resilience

- **Safe fallback for malformed/oversized snapshots:** Stage 4 ensures negative or implausibly large `unitPriceCents`, `extras[].priceCents`, or `lineTotalCents` do not produce absurd totals in `/admin`; the order details remain readable and total falls back to `Indisponível`. **Improved with tests.**
- **Aggregate total cap:** The parser now caps the computed aggregate order total and falls back safely if summed values exceed the configured threshold, guarding against pathological JSON data across many lines. **Improved.**
- **Backward compatibility preserved:** Valid legacy rows without pricing snapshots still render details and show `Indisponível`; valid new rows with snapshots still display pt-BR totals. **No regression expected; covered by tests.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Reject malformed persisted pricing snapshots and fail safe to `Indisponível` |
| Dependencies  | OK        | No new deps |
| Performance   | Improved  | Added numeric bounds to parser/total calculation |
| Observability | Gap       | No malformed-pricing telemetry |
| Resilience    | Improved  | Safe fallback for negative/oversized pricing snapshots and aggregate totals |

---

## Order Payment Method Selection (Customer + Admin) — Stage 4

### Security

- **Server validation authority preserved:** Even though the customer UI uses a constrained radio group, `/api/orders` (via shared submit logic) still validates `paymentMethod` against the locked canonical values (`dinheiro`, `pix`, `cartao`) before persisting. Tampered values are rejected with a Portuguese validation error. **No Stage 4 change required.**
- **DB integrity backstop remains in place:** `public.orders.payment_method` is protected by a DB `CHECK` constraint allowing only canonical non-null values while still permitting `NULL` for legacy rows. This provides a second line of defense beyond app validation. **Implemented in Stage 1; no change.**

### Dependencies

- **Shared source of truth:** Stage 3 centralized canonical values and labels in `lib/payment-methods.ts`, which reduces drift risk between customer radio options, server validation, and admin display labels without adding any dependency. **No change.**

### Performance

- **Minimal runtime cost:** Payment method handling is limited to simple string normalization and label lookup in submit/admin flows. No meaningful performance impact observed or expected. **No change.**

### Observability

- **No payment-method telemetry:** There are no metrics/logs for payment method distribution or invalid payment-method attempt counts beyond generic submit failure logs. This is acceptable for current scope and can be added later if reporting/abuse visibility requires it. **Deferred.**

### Resilience

- **Oversized malformed string hardening:** Stage 4 adds a maximum length guard (32 chars) in shared payment method normalization before trimming/lowercasing. Unexpectedly large strings (e.g., malformed payloads or manual DB edits) now fail safely to `null` instead of being processed as arbitrary-length inputs. **Improved in Stage 4.**
- **Deterministic admin fallback preserved:** `/admin` continues to render `Forma de pagamento: Não informado` for legacy `NULL` rows and unknown values, so malformed historical data does not break details rendering. **No change; covered by tests.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | App validation + DB `CHECK` already enforce canonical values |
| Dependencies  | OK        | Shared helper prevents label/key drift |
| Performance   | OK        | No meaningful impact |
| Observability | Gap       | No payment-method telemetry |
| Resilience    | Improved  | Length-capped normalization fails safely on oversized values |

---

## Customer Cart Visibility / Feedback (`Carrinho`) — Stage 4

### Security

- **UI-only feature:** This feature changes customer-side cart discoverability/feedback on `/` only. No API routes, DB schema, or order payload contracts were modified. **No security surface increase in Stage 4.**

### Dependencies

- **No new dependencies:** Sticky mobile navigation and cart feedback behavior continue using local React state/effects and Tailwind utility classes only. **No change.**

### Performance

- **Scroll listener guard:** The mobile sticky tab bar uses a `scroll` listener to add a subtle shadow when the page is scrolled. Stage 4 hardens this by avoiding redundant state updates when the scrolled/not-scrolled boolean has not changed. This keeps the listener lightweight on long menu pages. **Improved in Stage 4.**
- **Feedback timer scope:** The cart feedback timer remains a short local UI timer (~1.4s) and is cleared on unmount, so it does not accumulate background timers across page transitions. **No change from Stage 1 behavior; verified.**

### Observability

- **No interaction telemetry:** There are still no metrics/logs for how often customers use the `Carrinho` tab or how often add-feedback is triggered. This is acceptable for current scope and should be handled in a separate analytics/telemetry feature if needed. **Deferred.**

### Resilience / Accessibility

- **Screen-reader feedback parity:** Stage 4 adds a polite `aria-live` announcement when an item is added to the cart (`Item adicionado ao carrinho. Ver carrinho (...)`). This ensures non-visual users receive equivalent feedback, since the primary Stage 1 cue is visual highlighting on the `Carrinho` entry point. **Improved in Stage 4.**
- **Reduced-motion compatibility preserved:** The visual feedback still uses color/ring emphasis and only applies pulse animation behind `motion-safe`, so users with reduced-motion preferences retain a clear non-motion cue. **No change; behavior remains acceptable.**
- **Mobile sticky visibility:** The main `Cardápio` / `Carrinho` tab bar remains sticky on mobile, improving discoverability of the feedback while scrolling large menus. Stage 4 does not alter this behavior. **No regression expected.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | UI-only changes; no new API/DB surface |
| Dependencies  | OK        | No new deps |
| Performance   | Improved  | Scroll-state updates now avoid redundant setState calls |
| Observability | Gap       | No cart UX telemetry |
| Resilience    | Improved  | Added screen-reader live announcement for add-to-cart feedback |

---

## Admin Login Redirect Bugfix (`/admin/login` -> `/admin`) — Stage 4

### Security

- **Auth scope unchanged:** The bugfix does not change Supabase auth provider usage, credentials handling, or middleware route protection rules. `/admin` remains middleware-protected and `/admin/login` remains the public login entry point. **No security surface expansion.**
- **No redirect-on-failure regression:** Redirect still occurs only after a successful `signInWithPassword` result. Invalid credentials and unexpected auth failures remain on `/admin/login`. **Preserved; covered by tests.**

### Dependencies

- **No new dependencies:** The fix and hardening stay within Next.js App Router + Supabase client usage already present in the app. **No change.**

### Performance

- **Negligible impact:** Reordering login navigation (`replace` then `refresh`) and keeping the disabled submit state through redirect introduces no meaningful performance cost. **No change.**

### Observability

- **No login telemetry yet:** There is still no structured logging/metrics for login success timing, redirect convergence, or first-login failures. This would help diagnose future auth timing issues but remains out of scope here. **Deferred.**

### Resilience

- **Fresh-session redirect convergence:** The Stage 1 bugfix uses `router.replace("/admin")` followed by `router.refresh()` to better tolerate session cookie propagation timing on first login in a fresh browser session. This reduces cases where users appear stuck on `/admin/login` until manual refresh. **Improved in Stage 1; covered by tests.**
- **No stuck loading state on thrown auth exceptions:** Stage 4 adds a `try/catch` around `signInWithPassword(...)` so unexpected thrown errors (e.g., network/runtime exceptions) reset the submit state and show the existing generic auth error instead of leaving the button stuck in `Redirecionando...`. **Improved in Stage 4.**
- **Double-submit confusion reduced:** The login button remains disabled with `Redirecionando...` after successful auth while navigation completes, reducing repeated clicks during redirect timing gaps. **Improved (Stage 1 UX fix), retained in Stage 4.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | Auth protections unchanged; no redirect on failure |
| Dependencies  | OK        | No new deps |
| Performance   | OK        | No meaningful impact |
| Observability | Gap       | No login redirect/latency telemetry |
| Resilience    | Improved  | Fresh-session redirect convergence + thrown-error recovery |

---

## Customer Menu Mobile Overflow Bugfix (`/` Cardápio) — Stage 4

### Security

- **UI-only layout fix:** This bugfix changes responsive layout/wrapping behavior in the customer `Cardápio` view only. No API, auth, database, or order payload behavior was changed. **No new security surface.**

### Dependencies

- **No new dependencies:** The fix and hardening use existing Tailwind utility classes and current React component structure only. **No change.**

### Performance

- **No measurable runtime cost:** The fix relies on responsive layout classes (`flex-wrap`, mobile stacking, `min-w-0`, `break-words`) rather than new JS logic. **No change.**

### Observability

- **No UI layout telemetry:** There is no instrumentation for client-side overflow/layout regressions. Detection remains manual QA/visual checks. **Deferred.**

### Resilience / Accessibility

- **Long text defensive wrapping:** Stage 4 adds `break-words` on menu card titles and descriptions to reduce the chance that unusually long unbroken item names/descriptions force horizontal overflow on narrow mobile viewports. **Improved in Stage 4.**
- **No hidden-content workaround:** The fix continues to favor natural wrapping/stacking (`min-w-0`, `flex-wrap`, mobile column layout) instead of clipping content, preserving readability and tap targets. **Aligned with brief; no regression expected.**
- **Recent mobile cart UI compatibility preserved:** The overflow fix coexists with the sticky `Cardápio/Carrinho` mobile tabs and Carrinho feedback UI introduced in the prior feature. **No regression observed in customer-page tests/build.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | UI-only layout fix |
| Dependencies  | OK        | No new deps |
| Performance   | OK        | CSS-only responsive fixes |
| Observability | Gap       | No layout telemetry |
| Resilience    | Improved  | Added wrapping/stacking + long-text guards for mobile overflow prevention |

---

## Menu-Inspired Design Review and Implementation — Stage 4

### Security

- **No auth/permission boundary changes:** This feature is UI styling only for customer `/` and admin summary status cards; no API contracts, DB writes, or auth logic changed. **No change.**
- **No user-input rendering risk increase:** New visual classes/tokens are static and not derived from user-provided values. **No change.**

### Dependencies

- **No new packages:** Hardening did not introduce third-party libraries (fonts, animation frameworks, CSS tooling, or runtime deps). **No change.**
- **No runtime/provider coupling added:** Theme remains local CSS token + Tailwind classes; no external style service dependency. **No change.**

### Performance

- **UI-only class updates:** Rendering cost impact is negligible at current scale; no additional network calls or data fetch loops were introduced.
- **Animation scope bounded:** Existing cart-feedback pulse remains `motion-safe`, avoiding reduced-motion regressions. **No behavior change.**

### Observability

- **No new telemetry:** This visual feature does not add UX event logging (e.g., theme usage/interaction metrics). This is acceptable for current scope and single-tenant usage. **Deferred.**

### Resilience

- **Style centralization improved:** Themed button/price classes were centralized in shared constants (`customer-order-page`) and status color mapping centralized in one map (`admin-orders-dashboard`), reducing style drift risk in future edits. **Improved in Stage 4 sweep.**
- **Fallback behavior unchanged:** Existing flows remain functional if style classes fail to apply. **No change.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | UI-only scope; no trust-boundary changes |
| Dependencies  | OK        | No new packages/providers |
| Performance   | OK        | Minimal class-only overhead |
| Observability | Gap       | No UX metrics; accepted for scope |
| Resilience    | Improved  | Centralized style mappings reduce drift |

---

## Customer Menu Phone Display + BR Mask/Validation — Stage 4

### Security

- **Server validation is authoritative:** Client mask is UX-only; backend now validates BR phone format before order creation (`10/11` local digits after optional `55` prefix normalization). Invalid values are rejected with deterministic pt-BR validation message. **Improved in Stage 4 sweep.**
- **No secret exposure change:** Store contact display uses a public env var (`NEXT_PUBLIC_STORE_PHONE`) by design; no new server-only secret path introduced. **No change.**

### Dependencies

- **No new external package:** BR mask/normalization uses local helper module (`lib/phone.ts`) without third-party masking libs. **No change.**
- **Config dependency introduced:** Feature depends on `NEXT_PUBLIC_STORE_PHONE` for storefront phone display; missing/invalid value intentionally hides the phone block. **Documented operational dependency.**

### Performance

- **Low-cost string transforms:** Mask/normalization operations are linear over short phone strings and negligible at current load.
- **No additional network calls:** Store phone rendering is derived at page render from env/config and local helpers only. **No change in request profile.**

### Observability

- **No dedicated phone-validation telemetry:** Invalid phone rejections follow existing validation response path; no new counters/metrics were added. **Deferred.**

### Resilience

- **Consistent formatting logic:** Shared helpers centralize normalization, mask, display label, and `tel:` link generation to reduce drift between UI and server behavior. **Improved in Stage 4 sweep.**
- **Fail-safe storefront behavior:** Invalid/missing store phone config hides the contact block instead of rendering broken links/text. **Improved in Stage 4 sweep.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Server-authoritative BR validation with deterministic rejection |
| Dependencies  | OK        | Local helper only; documented env dependency |
| Performance   | OK        | Minimal string-processing overhead |
| Observability | Gap       | No phone-specific validation telemetry |
| Resilience    | Improved  | Shared helper contract + safe hidden fallback on invalid config |

---

## Customer Header Branding and Mobile Alignment — Stage 4

### Security

- **No new input or auth surface:** Change is presentational in `components/customer-order-page.tsx` and does not alter request handling, auth checks, or data flow. **No change.**
- **External link behavior unchanged:** Store phone link remains `tel:` from server-resolved trusted env normalization path (`app/page.tsx` + phone helper), so no new user-controlled URL injection path is introduced. **No change.**

### Dependencies

- **No dependency changes:** No new packages or runtime APIs introduced. **No change.**

### Performance

- **Render cost neutral/slightly lower:** Header now renders one less text node (`Cardápio` title removed) and removes decorative container classes around the phone block. No measurable runtime impact expected. **No change required.**

### Observability

- **No new telemetry needed for UI-only change:** Existing logs/telemetry remain sufficient; this feature does not add new failure domains. **No change.**

### Resilience

- **Phone-present/absent paths preserved:** Layout remains deterministic with and without phone block (`text-left` mobile, `sm:text-right` desktop for phone block) and existing tests cover both presence and fallback-absent behavior. **Improved confidence via tests.**
- **Known gap (deferred):** Overflow/no-overlap requirements at widths `320/360/390/430` are still validated by contract/class tests rather than real viewport visual assertions. Consider Playwright screenshot checks in a future hardening pass. **Deferred.**

### Summary

| Area          | Status        | Action |
|---------------|---------------|--------|
| Security      | OK            | No new attack surface |
| Dependencies  | OK            | No changes |
| Performance   | OK            | No action needed |
| Observability | OK            | No additional instrumentation required |
| Resilience    | OK/Deferred   | Behavior stable; viewport screenshot coverage deferred |

---

## Order Delivery Option — Stage 4

### Security

- **Server validation remains authoritative:** `fulfillmentType` is normalized server-side and rejected if tampered; client-provided totals are still ignored. **No change in trust boundary.**
- **DB-level consistency hardened:** The fulfillment migration now enforces valid `fulfillment_type` / `delivery_fee_cents` pairs, preventing invalid combinations such as pickup orders with non-zero delivery fees or delivery orders with missing/incorrect fees from manual writes or partial scripts. **Improved in Stage 4.**

### Dependencies

- **No new dependencies:** Hardening uses existing TypeScript helpers and SQL constraints only. **No change.**

### Performance

- **No material runtime cost:** Added consistency enforcement is at the database constraint layer and does not introduce additional application queries or loops. **No change.**

### Observability

- **Delivery-specific failures remain diagnosable only through existing logs:** Order submit/load failures are logged, but there are no dedicated counters for fulfillment validation rejects or malformed legacy fulfillment rows. **Deferred.**

### Resilience

- **Safer persistence invariants:** New orders cannot drift into inconsistent fulfillment/fee states if the migration is applied, improving reliability of admin totals and downstream operational handling. **Improved in Stage 4.**
- **Deferred rollout dependency:** If app code is deployed before the migration, submit/admin paths may fail because the new columns/constraints are not present yet. Rollout should apply the migration before or with the application deploy. **Documented operational dependency.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Added DB-level fulfillment/fee consistency constraint |
| Dependencies  | OK        | No dependency changes |
| Performance   | OK        | Constraint-only hardening |
| Observability | Gap       | Existing logs only; no delivery-specific counters |
| Resilience    | Improved  | Stronger persistence invariants; rollout dependency documented |

---

## Admin Delivery Status Step (Stage 4)

### Security

- **DB invariant enforcement extended:** The new migration constrains `saiu_para_entrega` to rows where `fulfillment_type = 'entrega'`, in addition to the forward-only transition trigger. This closes the manual-write/direct-client gap for pickup rows entering the delivery-only status. **Improved in Stage 4.**
- **Unknown fulfillment fallback preserved:** App-layer progression still treats missing or unknown `fulfillment_type` as non-delivery, so legacy rows are not forced into the delivery-only path. **No change.**

### Dependencies

- **No new dependencies:** Hardening uses existing Next.js, Supabase, and local helpers only. **No change.**
- **Typed Supabase workaround remains:** `app/admin/actions.ts` still relies on narrow cast helpers for query-chain typing. This is a compile-time maintainability gap, not a new runtime risk. **Deferred.**

### Performance

- **Update path remains bounded:** The status progression action performs one small pre-update lookup and only performs a second lookup on stale-update misses. This is acceptable for the project’s small-scale operational profile. **Acceptable for current scope.**
- **Shared admin query contract avoids drift:** Centralizing the admin order select columns removes duplication between `/admin` SSR and the polling route without adding runtime cost. **Improved in Stage 4.**

### Observability

- **Stale-miss diagnostics improved:** The admin action now logs a dedicated error when the follow-up status lookup fails after a conditional update miss, making “stale but unknown current status” incidents diagnosable without exposing customer PII. **Improved in Stage 4.**
- **Migration rollout visibility remains manual:** There is still no automated runtime check that confirms the delivery-status migration was applied in each environment. Deployment sequencing must cover this. **Deferred.**

### Resilience

- **Safe stale fallback retained:** If another employee wins the update race, the UI still receives a deterministic stale response and reloads the current persisted label. If the follow-up lookup also fails, the action now logs that failure and still returns a safe stale response rather than crashing. **Improved in Stage 4.**
- **Deployment ordering assumption remains:** If the application deploys before the new migration, app and database status contracts diverge. This remains an operational rollout requirement rather than an app-code fix. **Documented; not implemented.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | Improved  | Added DB applicability guard for delivery-only status |
| Dependencies  | Deferred  | Supabase typed-chain workaround still present |
| Performance   | OK        | Small bounded lookup cost only |
| Observability | Improved  | Added stale-follow-up lookup failure logging |
| Resilience    | Improved  | Safe stale fallback preserved even on follow-up lookup failure |

---

## Admin Ready-for-Pickup Status Step (Stage 4)

### Security

- **DB pickup-only applicability remains enforced:** The pickup-ready migration constrains `pronto_para_retirada` to rows whose `fulfillment_type` is not `entrega`, in addition to the forward-only transition trigger. This keeps delivery rows from entering the pickup-only branch through manual writes or direct clients. **No change from Stage 1 contract; reaffirmed in Stage 4.**
- **Legacy/unknown fulfillment fallback remains bounded:** App-layer progression and DB transition rules still treat missing or unsupported `fulfillment_type` as pickup flow only, so legacy rows may enter `pronto_para_retirada` but are still blocked from `saiu_para_entrega`. **No change.**

### Dependencies

- **No new dependencies:** Hardening stays within the existing Next.js server action, shared order helpers, and Supabase migration contract. **No change.**
- **Typed Supabase workaround remains:** `app/admin/actions.ts` still uses narrow cast helpers around query chains. This is a compile-time maintainability gap, not a new runtime risk introduced by this feature. **Deferred.**

### Performance

- **Update path remains small and bounded:** Pickup-ready progression still performs one pre-update lookup and only performs a follow-up lookup on stale conditional-update misses. That cost remains acceptable for the project’s small operational scale. **No change.**

### Observability

- **Missing-row stale diagnostics improved:** If a conditional update misses and the follow-up lookup returns no row at all, the action now emits a dedicated warning with `orderId` and expected status. This distinguishes “real stale status race” from “row disappeared after miss” without changing the user-facing response. **Improved in Stage 4.**
- **Migration rollout visibility remains manual:** There is still no runtime health check confirming that `20260309123000_add_ready_for_pickup_status.sql` was applied in each environment. Rollout sequencing still carries that responsibility. **Deferred.**

### Resilience

- **Safe stale fallback retained:** Even if the follow-up lookup after a stale conditional-update miss returns no row, the action still returns the same safe stale response instead of throwing, so the admin UI degrades predictably. **Improved observability; user behavior unchanged.**
- **Deployment ordering assumption remains:** If the application deploys before the pickup-ready migration, app and DB status contracts diverge and updates may fail. This remains an operational rollout dependency rather than an app-code fix. **Documented; not implemented.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | Pickup-only DB applicability and legacy fallback preserved |
| Dependencies  | Deferred  | Supabase typed-chain workaround still present |
| Performance   | OK        | No extra runtime cost beyond existing bounded lookups |
| Observability | Improved  | Added dedicated missing-row stale-miss warning |
| Resilience    | Improved  | Safe stale fallback preserved under missing follow-up row |

---

## Tech Review + First Data Access Abstraction (Stage 4)

### Security

- **Abstraction boundary preserved:** Admin auth/session validation remains in the page/route/action edge and was not pulled into the new admin/orders data-access layer during hardening. That keeps the new boundary limited to persistence operations, matching the brief. **No change.**
- **No new privilege expansion:** The new abstraction still uses the same Supabase client already available to the caller and does not introduce any broader data-access surface beyond admin order list/snapshot/progress operations. **No change.**

### Dependencies

- **No new packages:** Hardening stayed within existing Next.js, Vitest, and Supabase code. **No change.**
- **Provider typing fragility remains localized:** The Supabase adapter still relies on local cast helpers for query-chain typing. This is now better isolated inside the adapter, but it remains a compile-time maintainability risk rather than a runtime defect. **Deferred.**

### Performance

- **No additional query cost:** Hardening adds only result-shape validation on the existing conditional update path; it does not introduce new queries or loops. **No change.**
- **Scope remains intentionally small:** The abstraction still covers only the locked `admin/orders` slice, avoiding premature repo-wide indirection overhead. **No change.**

### Observability

- **Unexpected write-shape logging added:** `progressOrderStatus` now logs a dedicated error if the conditional update returns a row whose `id` or `status` does not match the expected persisted result. This makes adapter/DB anomalies diagnosable without changing the user-facing failure message. **Improved in Stage 4.**
- **No dedicated abstraction metrics:** There are still no counters or traces for adapter method failures by operation. Production diagnosis still depends on structured logs. **Deferred.**

### Resilience

- **Safer success-path validation:** The admin action now verifies that the conditional update result matches the requested order and computed next status before treating the write as successful. Unexpected provider or query anomalies now fail closed with the existing generic pt-BR error. **Improved in Stage 4.**
- **Remaining deployment assumption:** This feature still assumes the existing admin/orders schema and status migrations are already applied before deploy; Stage 4 does not add runtime migration-health checks. **Documented; not implemented.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | Boundary stayed limited to persistence only |
| Dependencies  | Deferred  | Supabase typed-chain workaround still isolated in adapter |
| Performance   | OK        | No extra queries introduced |
| Observability | Improved  | Added unexpected conditional-update result logging |
| Resilience    | Improved  | Success path now validates returned row before accepting write |

---

## Provider-Agnostic Client Naming Follow-Up (Stage 4)

### Security

- **No privilege-boundary regression:** The split request/privileged/browser entrypoints still delegate to the same underlying Supabase implementations, and no new browser path can reach the service-role client through the app-facing boundary. **No change.**

### Dependencies

- **No new packages required:** Hardening uses Next's existing `server-only` and `client-only` guards, which are already available in the project dependency tree. **No change.**

### Performance

- **No material runtime overhead:** The added guards are import-time environment assertions only; they do not add meaningful request or render cost. **No change.**

### Observability

- **Boundary violations still rely on framework failures:** The main safeguard here is earlier import/build failure rather than new logs or metrics. If this class of issue recurs, add lint or CI-specific checks in a later observability pass. **Deferred.**

### Resilience

- **Explicit environment fences added:** `lib/request-client.ts`, `lib/privileged-client.ts`, and `lib/request-and-privileged-clients.ts` now declare `server-only`, while `lib/browser-client.ts` declares `client-only`. This hardens the provider-agnostic boundary against accidental mixed-environment imports like the `next/headers` build regression. **Improved in Stage 4.**
- **Earlier and clearer failure mode:** Incorrect future imports should now fail closer to the offending module boundary instead of surfacing later as an indirect `next/headers` pipeline error. **Improved in Stage 4.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | No secret or privilege exposure change |
| Dependencies  | OK        | Reused built-in Next environment guards |
| Performance   | OK        | Import-time assertions only |
| Observability | Gap       | No dedicated boundary telemetry yet |
| Resilience    | Improved  | Added explicit `server-only` / `client-only` fences |

---

## Cash Change Placeholder (Stage 3 Hardening)

### Structure

- **No structural cleanup required:** The feature is a single placeholder-copy update in `components/customer-order-page.tsx`, and the current implementation is already the minimal, clearest form. Any further refactor here would add churn without readability or safety gain. **No change applied.**

### Security

- **No new input surface or trust boundary:** The change only updates placeholder text for an existing optional textarea. It does not add a new field, structured `troco` payload, or new server-side parsing path. **No change.**
- **No leak of sensitive details:** The placeholder remains ordinary pt-BR example copy and does not expose internal behavior or implementation details. **No change.**

### Dependencies

- **No dependency change:** No packages, framework features, or third-party integrations were added or altered. **No change.**

### Performance

- **No runtime cost:** The feature is static placeholder text in an already-rendered textarea and has no measurable impact on render, network, or persistence paths. **No change.**

### Observability

- **No new telemetry needed for this scope:** Because behavior is unchanged and the feature is presentational only, existing logs and submission-path diagnostics remain sufficient. A future real `troco` workflow would likely need stronger observability, but this placeholder-only change does not. **No change.**

### Resilience

- **Fail-safe scope preserved:** Even if customers ignore or misunderstand the placeholder, the system still falls back to the pre-existing free-text notes behavior. There is no new conditional logic or server dependency that could fail. **No change.**
- **Future-feature boundary remains important:** If the product later wants structured `troco para quanto` support, that must be a separate feature so this copy-only change does not silently evolve into implicit backend behavior. **Documented constraint.**

### Summary

| Area          | Status | Action |
|---------------|--------|--------|
| Structure     | OK     | No cleanup needed beyond current minimal implementation |
| Security      | OK     | Placeholder-only change; no new trust boundary |
| Dependencies  | OK     | No dependency changes |
| Performance   | OK     | Static copy only |
| Observability | OK     | Existing diagnostics sufficient for presentational scope |
| Resilience    | OK     | Existing free-text fallback behavior preserved |

---

## Recurring Deletion of Delivered Orders (delete-orders) — Stage 3

### Security

- **No user input:** The function is invoked by pg_cron only; no HTTP-exposed RPC. No anon/authenticated GRANT on the function.
- **SECURITY DEFINER with search_path:** Function runs with definer privileges for DELETE; `search_path = public` limits schema injection risk. **No change.**
- **Irreversible deletion:** Brief explicitly accepts this; no soft-delete. Operator can disable cron without redeploy. **Documented.**

### Dependencies

- **pg_cron required:** Cron schedule must be configured manually after migration. Depends on Supabase pg_cron extension (already in use for menu-import). **Documented in docs/delete-orders.md.**
- **No new npm packages:** Migration-only feature. **No change.**

### Performance

- **Single transactional DELETE:** Bounded to one day's worth of `entregue` orders. For small-scale single-tenant scope, volume is low. **Acceptable.**
- **Index usage:** `orders` has `orders_status_idx` and `orders_status_created_at_idx`; status + updated_at filter should use these. **No change needed.**

### Observability

- **RAISE NOTICE added:** Function now emits `delete_entregue_orders_from_previous_day: N rows deleted` so Supabase/postgres logs capture the count when pg_cron runs. **Improved in Stage 3.**
- **Return value:** Function returns count; manual invocation can inspect it. pg_cron does not log return values by default; RAISE NOTICE fills that gap. **Improved.**

### Resilience

- **Timezone robustness:** Cutoff logic now uses `(now() at time zone 'America/Sao_Paulo')::date` instead of `current_date`, making the previous-day computation independent of session/connection timezone. **Improved in Stage 3.**
- **Atomic delete:** Single DELETE in a CTE; no partial deletes on failure. **No change.**
- **Cron failure:** If pg_cron misses a run or the function throws, orders accumulate until the next successful run. No retry logic; acceptable for daily cadence. **Documented.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Security      | OK        | No HTTP exposure; SECURITY DEFINER with bounded search_path |
| Dependencies  | OK        | pg_cron dependency documented |
| Performance   | OK        | Single bounded DELETE; acceptable at scale |
| Observability | Improved  | Added RAISE NOTICE for deleted count |
| Resilience    | Improved  | Timezone robustness via now() at time zone |

---

## Soft Delete Delivered Orders for History (soft-delete-orders-history) — Stage 3

### Structure

- **Shared boundary remains the right filter point:** The active-order rule stays centralized in the existing `admin/orders` data-access boundary instead of being reimplemented separately in the page, route, and action layers. That keeps the new `is_deleted = false` operational contract consistent across the migrated admin slice. **No structural change needed.**
- **Explicit metadata is clearer than timestamp-only filtering:** The implementation now uses `is_deleted` as the primary active-row filter while keeping `soft_deleted_at` for history timing. This matches the revised brief and is easier to reason about during operational debugging. **No change.**

### Security

- **No new public write/read surface:** Soft deletion remains internal to the DB cron/function path and the protected admin order slice. No new RPC, HTTP endpoint, or public mutation path was introduced. **No change.**
- **Metadata consistency is DB-enforced:** The `orders_soft_delete_consistency_check` constraint prevents normal writes from producing ambiguous states where `is_deleted` and `soft_deleted_at` disagree. **Improved in Stage 3.**
- **Operational stale actions fail closed:** Admin status progression now treats missing/non-operational rows as invalid, preventing hidden historical rows from being updated through stale tabs or direct requests. **Implemented and revalidated.**

### Dependencies

- **No new package risk:** The feature remains migration + existing app boundary work only; no new runtime dependency or external service was introduced. **No change.**
- **Supabase migration dependency remains critical:** The app-side `is_deleted` filtering assumes the migration has already run. Deploying code before the migration would break operational order queries. **Documented deployment dependency.**

### Performance

- **Filter cost remains small at current scale:** `is_deleted = false` adds one simple predicate to the existing admin/orders query chain, which is acceptable for the repo’s small-scale single-tenant constraint. **No change needed.**
- **Potential future index gap accepted for now:** There is no dedicated index tuned for `is_deleted` + operational sorting/filtering yet. That is acceptable at current scale, but if history grows materially, a later performance pass should consider an index supporting the active-order slice. **Deferred.**

### Observability

- **Cron logs remain minimally diagnosable:** The updated function still emits a `RAISE NOTICE` count, now describing soft-deleted rows instead of deleted rows. That gives operators at least one visible signal in Supabase/Postgres logs. **Adequate for current scope.**
- **App-side rejection paths log enough context:** The admin action already logs missing/non-operational progression attempts and unexpected update failures with order/status context and no customer PII. **No change needed.**

### Resilience

- **Missed-run catch-up is now safer than the old behavior:** Because the cron function soft-deletes any still-active eligible delivered row older than the current Brazil day, a missed scheduler run no longer creates a permanent retention gap. **Improved in Stage 3.**
- **Real SQL behavior still needs environment verification:** Stage 2 locked the app-layer contract, but the actual migration/function behavior has not yet been exercised in a real Supabase/Postgres environment from this workflow run. That remains the main unresolved resilience gap. **Documented; not fixed here.**
- **Legacy operator naming remains a confusion risk:** Keeping the old function name preserves scheduler compatibility, but it also risks implying hard deletion to operators until Stage 4/5 docs replace the old guidance. **Documented.**

### Summary

| Area          | Status    | Action |
|---------------|-----------|--------|
| Structure     | OK        | Shared admin/orders boundary remains the single active-row filter point |
| Security      | Improved  | DB consistency constraint + non-operational mutation rejection |
| Dependencies  | OK        | No new packages; migration ordering still matters |
| Performance   | OK        | Predicate cost acceptable now; future index may help if history grows |
| Observability | OK        | Cron NOTICE + action logs provide minimal diagnostics |
| Resilience    | Improved  | Catch-up retention safer; real DB verification still deferred |
---
## Admin Order Editing — Stage 3 (hardener sweep)

### Structure / Alignment
- **Removed name-based menu resolution in `AdminOrderEditSheet`:** `initialLines` no longer tries to “re-resolve” legacy/unknown lines by matching item `name` to the current menu. Per brief Decisions, legacy-only lines (no `menuItemId`) are excluded from the editable list, and items whose `menuItemId` no longer exists must remain unknown and require explicit removal/replacement. This restores strict ID-based behavior and prevents the UI from accidentally turning unknown snapshot IDs into valid IDs by name.

### Security
- **Validation authority stays server-side:** Because the UI now preserves the snapshot `menuItemId` (or excludes legacy without it), server-side `validateAndBuildOrderPayload` remains the single source of truth for whether an item/extra/removal is valid in the active menu.

### Performance
- **No meaningful cost change:** The removed `nameMatchId` lookup eliminates an extra `.find()` across `menuItems` per line; `initialLines` is now a direct snapshot-id filter.

### Observability
- **No new logging added:** Existing action logs cover validation failures and unexpected DB write errors with contextual order ids.

### Resilience
- **Menu drift handling is now deterministic:** When menu changes since order creation:
  - Legacy lines: excluded from editable list.
  - Unknown `menuItemId`: displayed as “Item fora do cardápio atual” and must be removed before save.

### Summary
| Area          | Status    | Action |
|---------------|-----------|--------|
| Structure     | Improved  | Removed name-based fallback; strict id-based behavior |
| Security      | Improved  | Prevents UI from bypassing server validation authority |
| Performance   | Improved  | Avoid extra per-line menu lookup |
| Observability | OK        | No new logs required |
| Resilience    | Improved  | Deterministic handling for legacy/unknown items |
