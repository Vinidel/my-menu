# Admin Login Redirect Bugfix (`/admin/login` -> `/admin`) — Feature Documentation

Summary for the next engineer: what was fixed, where it lives, and what behavior is now locked.

**Brief:** [docs/briefs/admin-login-redirect-bugfix.md](briefs/admin-login-redirect-bugfix.md)

---

## What Was Delivered

- **Fixed post-login redirect race (fresh session / first login path):**
  - successful login on `/admin/login` now converges reliably to `/admin`
  - no manual refresh required
- **Redirect strategy update:**
  - on successful `signInWithPassword(...)`, the login page now calls:
    - `router.replace("/admin")`
    - then `router.refresh()`
  - this improves compatibility with middleware auth checks when session cookie propagation lags on first login
- **Reduced duplicate-submit confusion during redirect:**
  - submit button stays disabled after successful login while redirect is in progress
  - button label changes to `Redirecionando...`
- **Stage 4 resilience hardening:**
  - unexpected thrown auth exceptions (not just `{ error }`) now recover safely
  - form exits loading state and shows the existing generic auth error instead of getting stuck

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Admin login page (bugfix + redirect UX) | `app/admin/login/page.tsx` |
| Login page tests (redirect ordering, loading UX, thrown-error recovery) | `app/admin/login/page.test.tsx` |
| Middleware auth protection regression coverage | `middleware.test.ts` |
| Stage 4 hardening notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Success destination:** `/admin`
- **Redirect trigger:** only after successful Supabase login result
- **No manual refresh:** users should not need to refresh to leave `/admin/login`
- **Redirect strategy (implemented):** `router.replace("/admin")` then `router.refresh()`
- **Failed login UX preserved:** invalid credentials remain on `/admin/login` with the existing generic pt-BR error
- **Loading UX on success:** keep button disabled and show `Redirecionando...` until navigation proceeds

---

## Known Gaps & Deferred Work

- **No auth timing telemetry:** There is no instrumentation for login-to-admin redirect latency or first-login timing failures.
- **Real browser E2E coverage not added:** Current coverage is unit/component + middleware tests. A future Playwright/Cypress pass could validate cookie propagation timing in a real browser runtime.
- **Generic error message on thrown exceptions:** Thrown auth/network failures intentionally reuse the same generic auth error (`E-mail ou senha incorretos.`) to avoid leaking details, but this can hide operational outages from employees.

---

## Operational Notes

- **Primary repro that motivated the fix:** first login in a fresh browser session (incognito / no existing auth cookie).
- **Manual smoke test:**
  - open `/admin/login` in incognito
  - login with valid employee credentials
  - confirm redirect to `/admin` without refresh
  - confirm button shows `Redirecionando...` and stays disabled while navigation is in progress
- **No DB/migration impact:** This is an auth UI/middleware timing integration bugfix only.

---

## For the Next Engineer

- **If redirect issues return:** Re-check the interplay among `signInWithPassword`, `router.replace`, `router.refresh`, and middleware `getUser()` timing before changing middleware rules.
- **If you add E2E tests later:** Prioritize the fresh-session first-login path (incognito/no auth cookie), which was the reported trigger.
- **If you change error UX:** Keep the “no false redirect on failure” contract intact and update tests in `app/admin/login/page.test.tsx`.
