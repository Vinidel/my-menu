# Feature Brief — Fix Admin Login Redirect Stuck on `/admin/login`

Status: Stage 0 — Framing
Date: 2026-02-25
Author: Orchestrator Agent

---

## Alternative Name

Bugfix login redirect `/admin/login` -> `/admin` / Pós-login não redireciona / Admin auth redirect reliability

---

## Problem

There is a reported bug where employee login succeeds, but the user is not redirected from `/admin/login` to `/admin`.

Observed report (from `todos.md`):
- After successful login, the page stays on `/admin/login`
- Reproduced in incognito mode
- Also reproduced in another browser
- Repro appears more likely/consistent on the **first login in a fresh session** (no existing auth cookie/session state)

This creates a broken first-run employee experience and makes authentication appear unreliable even when credentials are valid.

---

## Goal

Make post-login navigation deterministic so a successful employee login always lands the user on `/admin` (or a locked equivalent admin destination if already defined by the auth flow).

Success = after valid credentials are accepted and session is established, the user is redirected away from `/admin/login` to the authenticated admin area.

---

## Who

- **Employees (burger owner / staff):** Need reliable access to `/admin` after logging in.
- **Developers/operators:** Need a deterministic, testable redirect flow across browsers/incognito sessions.

---

## What We Capture / Change

- **Auth UI/Login flow**
  - Fix post-login redirect behavior on `/admin/login`
- **Auth/session timing integration**
  - Ensure redirect logic works with Supabase session establishment and middleware-protected `/admin`
- **Tests**
  - Add regression coverage for successful login redirect behavior

---

## Out of Scope

- Changing auth provider (still Supabase email/password)
- New login UI redesign
- Password reset flow
- Role-based redirects / multiple admin destinations
- Customer auth/accounts

---

## Success Criteria (Exit-Oriented)

- [ ] Successful login from `/admin/login` redirects to `/admin`.
- [ ] Redirect works in a fresh session context / first login (incognito or no existing auth cookie/session state).
- [ ] Invalid credentials still remain on `/admin/login` with existing error behavior (no false redirect).
- [ ] Middleware protection for `/admin` remains intact (unauthenticated users still cannot access `/admin`).
- [ ] Behavior is covered by tests (component and/or route/middleware integration level appropriate to current repo test setup).

---

## Happy Paths (Acceptance Scenarios)

1. **Valid login, fresh browser session.** Employee opens `/admin/login`, submits valid credentials, and is redirected to `/admin`.
2. **Valid login, standard browser session.** Employee logs in from `/admin/login` and reaches `/admin` consistently.
3. **Authenticated revisit.** Already-authenticated employee navigating to `/admin/login` follows the existing expected behavior (redirect or protected flow) without regression.

---

## Unhappy Paths / Edge Cases

1. **Invalid credentials.** Login fails and user remains on `/admin/login` with the existing generic pt-BR error.
2. **Supabase/network delay after sign-in.** Redirect should not race incorrectly with session establishment; user should not appear “stuck” on `/admin/login`.
3. **Middleware/session propagation timing (first login).** If middleware checks auth before the new session cookie is available on a fresh login, the flow must still converge to `/admin` without manual refresh.

---

## Locked Decisions (Stage 0)

1. **Target route (locked):** Post-login success destination is `/admin`.
2. **Redirect trigger (locked):** Redirect occurs only after successful login result from Supabase auth flow (no optimistic redirect before success).
3. **No manual refresh requirement (locked):** Users should not need to refresh the page after login to reach `/admin`.
4. **Keep existing invalid-login UX (locked):** Error messages/behavior for failed login remain unchanged unless required for bugfix correctness.
5. **pt-BR user-facing text (locked):** Any new messages or states must remain in Portuguese.

---

## Data / API / Schema Impact

- **No DB changes**
- **No Supabase schema/RLS changes expected**
- **Likely UI/client auth flow bugfix (plus possible middleware/session timing handling)**

---

## Technical Notes for Implementer

- Start by reproducing the login success path in `/admin/login` and verify:
  - when `supabase.auth.signInWithPassword(...)` resolves
  - when navigation is attempted
  - whether middleware sees the new session on the next request
- Check for race conditions between:
  - client-side redirect (`router.push` / `router.replace`)
  - `router.refresh()`
  - middleware auth check
  - cookie/session propagation in `@supabase/ssr`
- Prioritize reproducing the **first-login/fresh-session** path while implementing and testing; this is the reported trigger pattern.
- If a timing workaround is needed, prefer deterministic approaches already compatible with Next.js App Router and current middleware patterns.

---

## Stage 1 Implementation Choice To Lock

Implementer must lock and document:

- **Redirect strategy**
  - e.g. client push/replace after sign-in, server action redirect, auth-state listener-based redirect, or explicit refresh-then-push sequence
- **Test strategy**
  - how the bug is reproduced/guarded in repo tests given current test stack limits
