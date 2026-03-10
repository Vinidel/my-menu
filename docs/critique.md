# Critique

Date: 2026-03-10
Reviewed by: Critic Agent
Scope: Stage 1 implementation for docs/briefs/provider-agnostic-data-access-and-client-naming-follow-up.md
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- In Stage 2 or Stage 3, consider adding a small direct test file for `lib/app-clients.ts` so the new app-facing boundary itself is covered explicitly instead of only through migrated call sites.

### Risks / Assumptions
- The implementation intentionally leaves provider naming inside `lib/**`, so this is app-layer decoupling rather than full provider-neutralization across the repo.
- The new app-facing client names are generic by design; future slices should keep their semantics clear so `request`, `browser`, and `privileged` access do not drift into ambiguous usage.

## Acceptance Criteria
- [ ] Stage 2 verifies the migrated app/component call sites continue using the provider-agnostic `lib/app-clients.ts` boundary.
- [ ] The full locked migration set remains free of direct `@/lib/supabase/server`, `@/lib/supabase/client`, and `@/lib/supabase/service-role` imports.
- [ ] Provider-specific implementation remains internal to `lib/**`.
- [ ] The full test suite remains green after later stages.
