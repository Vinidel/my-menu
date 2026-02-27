# Hardening Notes (Stage 4)

Risks, assumptions, and deferred items from the hardening sweep. Updated per feature as needed.

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
