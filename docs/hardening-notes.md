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
