# Feature Brief — Employee Auth

Status: Stage 1 — Implementation complete (pending Critic)
Date: 2025-02-23
Author: Orchestrator Agent

---

## Alternative Name

Admin auth / Staff login / Employee login

---

## Problem

The `/admin` area is currently open to anyone. Only the burger place owner and staff (employees) should access it to view and manage orders. Without authentication, we cannot secure the employee flow. We need a way for employees to sign in with email and password and for the app to restrict `/admin` to authenticated users only.

---

## Goal

- Employees sign in with **email and password** using Supabase Auth.
- Unauthenticated users who try to access `/admin` (or any route under `/admin`) are **redirected to a login page**.
- Authenticated employees can access `/admin` and can **log out**; after logout, accessing `/admin` again requires logging in.
- All auth-related UI (login form, buttons, error messages) is in **Portuguese (pt-BR)**.
- Supabase client is configured via **environment variables** (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); the app runs only when these are set (or shows a clear setup message in development).

Success = an employee can log in, reach `/admin`, log out, and be redirected to login when not authenticated. No customer accounts or sign-up flow in this feature.

---

## Who

- **Employees (burger owner / staff):** Must log in to access `/admin`. They are the only users who have credentials; accounts are created outside the app (Supabase dashboard or a future “invite” feature), not via in-app sign-up.
- **Customers:** Unaffected. They never see the login page unless they navigate to it; the public menu at `/` remains accessible without auth.
- **Developers:** Must set Supabase env vars to run the app; optional: document in README or `.env.example`.

---

## What We Capture / Change

- **Supabase Auth:** Use Supabase as the identity provider. User accounts (email/password) live in Supabase; no separate users table in the app. Session is managed by Supabase client (e.g. cookie-based with `@supabase/ssr` or equivalent for Next.js).
- **Environment:** At least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No secrets in the brief beyond what Supabase needs for client-side auth.
- **Routes:** New login page (route TBD below). `/admin` and all routes under `/admin/`* require authentication; unauthenticated users are redirected to the login page.
- **No new database tables** for this feature; Supabase Auth stores users.

---

## Success Criteria

- Supabase client is initialized in the app (e.g. in `lib/`) and used for auth; env vars are read at runtime.
- A **login page** exists where the user can enter email and password and submit. All labels, placeholders, and buttons are in Portuguese.
- Submitting valid credentials signs the user in and redirects them to `/admin` (or intended destination).
- **Protected routes:** Accessing `/admin` (or any page under `app/admin/`) when not authenticated redirects to the login page. After login, the user can access `/admin` normally.
- A **logout** action is available (e.g. button or link) in the admin area; after logout, the session is cleared and the user is redirected to the login page or home.
- **Validation:** Empty email or password is validated (client-side is enough for this brief); invalid credentials show a clear error message in Portuguese.
- Auth state is consistent on refresh (session restored from Supabase); no flash of protected content before redirect.
- If env vars are missing, the app does not crash; either show a clear message (e.g. on login page) or fail gracefully. No hardcoded credentials.

---

## Non-Goals (Out of Scope)

- **No customer accounts or login.** Customers do not sign in; they only provide name/email/phone when placing an order (future feature).
- **No in-app sign-up.** Employees are not created via the app in this brief; they are created in the Supabase dashboard (or via a future invite flow). No “Register” or “Create account” UI.
- **No password reset flow.** Forgot-password / reset-via-email is out of scope; can be a later brief.
- **No role-based permissions.** We do not distinguish “owner” vs “staff” in this feature; any authenticated user can access the full `/admin` area.
- **No “remember me” or session duration configuration.** Use Supabase defaults; session persistence (e.g. cookie) is enough.
- **No OAuth / social login.** Email + password only.

---

## Acceptance Scenarios

### Happy Paths

1. **Employee logs in and reaches admin.** Employee opens the login page, enters valid email and password, submits. They are signed in and redirected to `/admin`. They see the admin placeholder content (or future orders UI). Refreshing the page keeps them logged in.
2. **Employee logs out.** From `/admin`, employee clicks logout. Session is cleared; they are redirected to the login page (or `/`). Visiting `/admin` again redirects to login.
3. **Already logged in, visits login page.** If the user is already authenticated and visits the login page, redirect them to `/admin` (avoid showing login form when already signed in).

### Unhappy Paths

1. **Invalid credentials.** User enters wrong email or password. Show a clear error message in Portuguese (e.g. “E-mail ou senha incorretos.”). Do not reveal whether the email exists or the password was wrong (security).
2. **Empty fields.** User submits without email or password. Show validation message(s) in Portuguese; do not call Supabase until at least both fields are non-empty.
3. **Unauthenticated access to /admin.** User navigates to `/admin` (or any `/admin/`*) while not logged in. Redirect to login page. After they log in, redirect back to `/admin` (or intended URL) if feasible.
4. **Session expired or invalid.** If the session is invalid or expired and the user is on `/admin`, redirect to login and optionally show a message in Portuguese that they need to sign in again.

### Edge Cases

- **Direct URL to /admin.** User types `/admin` in the address bar while logged out → redirect to login. Same for any deep link under `/admin`.
- **Login page as entry point.** User bookmarks or shares the login page URL; it should always show the login form when not authenticated and redirect to `/admin` when authenticated.
- **Env vars missing.** In development, if Supabase URL or publishable key is missing, the app should not throw an uncaught error; show a setup message or disable the login form with a clear message in Portuguese. Production deployment is expected to set env vars (e.g. on Vercel).

---

## Approach (High-Level Rationale)

1. **Supabase client.** Create a Supabase client suitable for Next.js (App Router). Use `@supabase/supabase-js` and, if needed, `@supabase/ssr` for cookie-based session handling so that auth state is available on the server (e.g. in Server Components and middleware). Initialize from env vars; no auth logic without a configured client.
2. **Login page.** Add a dedicated route for login. Recommended: `app/admin/login/page.tsx` so the login page lives under the admin segment and the path is `/admin/login`. Alternative: `app/login/page.tsx` → `/login`. Use a form (email + password); on success, redirect to `/admin`. Use shadcn components (Input, Button, Card if useful); all copy in Portuguese.
3. **Protecting /admin.** Use one of: (a) Next.js middleware that checks the session for paths under `/admin` (excluding `/admin/login`) and redirects to `/admin/login` if unauthenticated, or (b) a layout in `app/admin/layout.tsx` that runs a server-side session check and redirects to `/admin/login` if no session. Ensure `/admin/login` is not protected so users can always reach the login form. Chosen approach (middleware vs layout) is an implementation detail; the outcome is “unauthenticated → redirect to login.”
4. **Logout.** Provide a logout action that calls Supabase `signOut`, then redirects to `/admin/login` (or `/`). Can be a button in the admin layout or on the admin page. Clear any local/cookie session state via the Supabase client.
5. **Redirect after login.** After successful sign-in, redirect to `/admin`. Optionally store the “intended” URL (e.g. before redirect to login) and redirect back there after login; not required for this brief if always redirecting to `/admin` is acceptable.
6. **Error messages.** Map Supabase auth errors to user-facing Portuguese messages. Do not expose stack traces or internal error codes to the user.
7. **Env and docs.** Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Add `.env.example` with placeholder keys and document in README that these are required for auth (or mention in implementation notes). Do not commit real keys.

---

## Decisions (Locked)

- **Auth provider:** Supabase Auth only (email + password). No OAuth, no custom backend auth.
- **Login route:** Use `/admin/login` so the login page is under the admin segment. Unauthenticated users hitting `/admin` or `/admin/`* (except `/admin/login`) are redirected to `/admin/login`.
- **Employee accounts:** Created outside the app (Supabase dashboard or future feature). No sign-up UI in this brief.
- **Session:** Managed by Supabase; use cookie-based session where possible so server components and middleware can read auth state. No custom JWT handling in app code beyond what the Supabase client does.
- **Language:** All auth UI (labels, placeholders, buttons, errors) in Portuguese (pt-BR).
- **Scope of protection:** Everything under `/admin` is protected; `/` and any other public routes remain public.

---

## Stage 0 Exit Gate

- Problem is clearly defined
- Goals are concrete and testable
- Non-goals are explicitly listed
- Happy and unhappy paths are documented
- Edge cases are surfaced
- Key decisions are locked
- Approach is outlined at a high level (no code)
- Critic has approved this brief

