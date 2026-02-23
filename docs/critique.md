---
# Critique

Date: 2025-02-23
Reviewed by: Critic Agent
Scope: **Employee Auth** — feature brief + Stage 1 implementation (login, protected routes, logout, env), including post-implementation fix (Sair button only when authenticated) and switch to publishable key
Verdict: **APPROVE**

## Findings

### Required Changes

None. The implementation satisfies the brief and aligns with PROJECT.md (Next.js, Tailwind, shadcn, Supabase, Portuguese).

- **Brief:** Goals, success criteria, happy/unhappy paths, and decisions are reflected in the code. Publishable key is used as agreed (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- **Supabase client:** Browser and server clients in `lib/supabase/`; both return `null` when env vars are missing; no hardcoded credentials.
- **Login page (`/admin/login`):** Email + password form, labels and messages in Portuguese; client-side validation for empty fields; invalid credentials show "E-mail ou senha incorretos."; setup message when client is null; redirect to `/admin` on success.
- **Protected routes:** Middleware redirects unauthenticated users from `/admin` and `/admin/*` (except `/admin/login`) to `/admin/login`; redirects authenticated users from `/admin/login` to `/admin`. Session refreshed via `getUser()`.
- **Logout:** "Sair" is only rendered when the user is authenticated (`AdminLogoutButton` uses `getUser()` and `onAuthStateChange`); after logout, redirect to `/admin/login`. No "Sair" on the login page.
- **Env:** `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Login page shows a clear Portuguese message when vars are missing.

### Suggested Improvements

- **Middleware when env is missing:** If Supabase URL or publishable key is unset, middleware currently does not redirect; a user could open `/admin` directly and see the admin layout (with no Sair button and no data from Supabase). Optional hardening: when env is missing and path is under `/admin` (except `/admin/login`), redirect to `/admin/login` so the setup message is shown there. Not required by the brief.
- **Session-expired message:** Brief allows optionally showing a message when session is expired; current behaviour is redirect to login with no message. Fine as-is; can be added later if desired.

### Risks / Assumptions

- **Env in production:** Security of `/admin` when env vars are set relies on middleware and Supabase session; production is expected to set env (e.g. on Vercel). If env is missing in production, `/admin` may remain reachable until middleware or layout enforces redirect.
- **Publishable key:** Use of the publishable key (instead of anon key) is consistent across client, server, and middleware; ensure Supabase project is configured for the key type in use.

## Acceptance Criteria

Before advancing to Stage 2 (Tester) or later stages:

- [x] Brief success criteria met: login, protection, logout, Portuguese UI, validation, env handling.
- [x] "Sair" only visible when the user is authenticated (no button on login page).
- [x] Publishable key used everywhere; `.env.example` and login setup message updated.
- [x] No scope creep: no sign-up, no customer auth, no password reset, no OAuth.
- [x] Build passes; no hardcoded secrets.

**Next step:** Proceed to Stage 2 (Tester) to add tests from the brief’s acceptance scenarios, or open/update the Draft PR with label `stage-1-impl` as needed.

---
