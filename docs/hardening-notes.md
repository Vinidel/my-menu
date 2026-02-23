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
