# Critique

Date: 2026-03-10
Reviewed by: Critic Agent
Scope: Stage 0 brief for docs/briefs/provider-agnostic-data-access-and-client-naming-follow-up.md
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- During implementation, keep an eye on whether app-facing factory names need distinct semantics for auth-scoped versus service-role access so the new provider-agnostic naming does not become overly vague.

### Risks / Assumptions
- The brief intentionally allows `lib/**` to keep importing `lib/supabase/*`, so this feature will improve app-layer decoupling without fully removing provider naming from internal library code.
- Because the locked migration set includes several different areas at once, implementation discipline still matters to avoid mixing inconsistent naming patterns across auth, service-role, and browser-client entrypoints.

## Acceptance Criteria
- [ ] The full locked app/component migration set is covered, not just a subset of obvious files.
- [ ] App-layer files stop importing `@/lib/supabase/server`, `@/lib/supabase/client`, and `@/lib/supabase/service-role` directly for the migrated slice.
- [ ] Provider-specific implementation remains allowed and contained inside `lib/**`.
- [ ] Behavior remains unchanged and the test suite stays green.
