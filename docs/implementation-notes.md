# Implementation Notes

Issues or observations spotted during implementation that are **out of scope** for the current feature. Do not fix in Stage 1; log for later or for a dedicated brief.

---

## App Skeleton (Stage 1)

- **npm audit:** 23 vulnerabilities (4 moderate, 19 high) reported after `npm install`. Not addressed in this brief; consider a dedicated dependency/hardening pass.
- **Deprecated packages:** Several transitive deps show deprecation warnings (e.g. `inflight`, `rimraf`, `glob`, `eslint@8`). No change in this stage.
- **Vitest / Next.js:** `vitest.config.ts` is excluded from `tsconfig.json` so Next.js type-check does not run over Vite/Vitest types (avoids plugin type conflicts). Vitest runs independently; no impact on app runtime.
- **Vite CJS deprecation:** Vitest run shows a warning about the CJS build of Vite's Node API. Cosmetic; tests pass. Can be revisited when updating Vitest/Vite.
