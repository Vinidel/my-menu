# Implementation Notes

Issues or observations spotted during implementation that are **out of scope** for the current feature. Do not fix in Stage 1; log for later or for a dedicated brief.

---

## App Skeleton (Stage 1)

- **npm audit:** 23 vulnerabilities (4 moderate, 19 high) reported after `npm install`. Not addressed in this brief; consider a dedicated dependency/hardening pass.
- **Deprecated packages:** Several transitive deps show deprecation warnings (e.g. `inflight`, `rimraf`, `glob`, `eslint@8`). No change in this stage.
- **Vitest / Next.js:** `vitest.config.ts` is excluded from `tsconfig.json` so Next.js type-check does not run over Vite/Vitest types (avoids plugin type conflicts). Vitest runs independently; no impact on app runtime.
- **Vite CJS deprecation:** Vitest run shows a warning about the CJS build of Vite's Node API. Cosmetic; tests pass. Can be revisited when updating Vitest/Vite.

---

## Employee Auth (Stage 1)

- **Admin layout on login page:** `/admin/login` uses the same `app/admin/layout.tsx` as other admin routes, so the login page shows the header with "Cardápio" and "Sair". For unauthenticated users "Sair" is a no-op. No change in this stage; a minimal login-only layout could be a later refinement.
- **Session refresh:** Middleware calls `getUser()` to refresh the session and enforce redirects; server components use `createClient()` from `lib/supabase/server.ts` which reads cookies. Cookie writes in server components are best-effort (try/catch) because `cookies()` in Next.js App Router can be read-only in some contexts.
