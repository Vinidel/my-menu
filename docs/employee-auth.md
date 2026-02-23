# Employee Auth — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/employee-auth.md](briefs/employee-auth.md)

---

## What Was Delivered

- **Login:** `/admin/login` — email + password form (Portuguese). Valid credentials redirect to `/admin`; invalid or empty show validation/error messages.
- **Protected routes:** All paths under `/admin` except `/admin/login` require an authenticated session. Unauthenticated users are redirected to `/admin/login`. Authenticated users visiting `/admin/login` are redirected to `/admin`.
- **Logout:** "Sair" button in the admin layout; visible only when logged in. Clears session and redirects to `/admin/login`.
- **Supabase:** Browser client (`lib/supabase/client.ts`), server client (`lib/supabase/server.ts`), shared cookie type (`lib/supabase/types.ts`). Middleware uses Supabase SSR for session refresh and redirect logic.
- **Env:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` required for auth. If missing, login page shows a setup message; middleware does not protect `/admin` (see Risks below).

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Login page | `app/admin/login/page.tsx` |
| Admin layout (header, logout) | `app/admin/layout.tsx` |
| Logout button (client) | `components/admin-logout-button.tsx` |
| Route protection | `middleware.ts` |
| Supabase browser client | `lib/supabase/client.ts` |
| Supabase server client | `lib/supabase/server.ts` |
| Cookie type (SSR adapter) | `lib/supabase/types.ts` |
| Env template | `.env.example` |

---

## Decisions (Locked)

- **Auth provider:** Supabase Auth only (email + password). No OAuth, no custom backend.
- **Login URL:** `/admin/login` (under admin segment).
- **Employee accounts:** Created outside the app (Supabase dashboard or future invite flow). No sign-up UI.
- **Session:** Cookie-based via `@supabase/ssr`; server and middleware can read auth state.
- **Language:** All auth UI in Portuguese (pt-BR).
- **Publishable key:** Env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not anon key).

---

## Known Gaps & Deferred Work

- **Missing env in production:** If Supabase URL or publishable key are unset in production, middleware does *not* redirect; a user can open `/admin` and see the layout (no data, no Sair). Fix: ensure env is set in Vercel (or add optional middleware redirect to `/admin/login` when env is missing). See `docs/hardening-notes.md` and `docs/critique.md`.
- **No auth event logging:** No server-side or structured logs for login success/failure or redirects. Debugging relies on Supabase dashboard and client behaviour. Optional: add structured logging in a future brief.
- **npm audit:** 23 vulnerabilities (4 moderate, 19 high) — deferred; consider a dedicated dependency pass. See `docs/implementation-notes.md`.
- **Password reset / sign-up:** Out of scope; employees are created in Supabase dashboard. No "Forgot password" or "Register" in this feature.

---

## Operational Notes

- **Deployment (Vercel):** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in project environment variables. Without them, `/admin` is not properly protected in production.
- **Creating employees:** Use Supabase Dashboard → Authentication → Users to create email/password users. No in-app sign-up.
- **Session refresh:** Middleware calls `getUser()` on each matched request; session is refreshed via Supabase cookies. If Supabase is down, middleware treats the user as unauthenticated and redirects `/admin` to login (fail closed).
- **Rollback:** Revert the PR; no DB migrations. Supabase Auth and env vars are unchanged; only app code and middleware change.

---

## For the Next Engineer

- **Testing auth:** Unit tests mock `@supabase/ssr` and `@/lib/supabase/client`; middleware tests use `@vitest-environment node` and explicit `Headers` for `NextRequest`. Login page tests use the last matching form/inputs when React Strict Mode double-mounts.
- **Adding new admin routes:** Any route under `app/admin/` (except `app/admin/login/`) is automatically protected by middleware. No extra checks needed in the page.
- **Cookie type:** If you extend Supabase SSR cookie handling, use `CookieToSet` from `lib/supabase/types.ts` to keep server and middleware in sync.
