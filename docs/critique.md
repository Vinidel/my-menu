# Critique

Date: 2026-03-10
Reviewed by: Critic Agent
Scope: Stage 2 tests for docs/briefs/provider-agnostic-data-access-and-client-naming-follow-up.md
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- In a later pass, consider a couple of small semantic tests that assert the most sensitive callers use the expected app-client mode (`request` vs `privileged`) if that distinction becomes easier to encode without over-coupling tests to implementation details.

### Risks / Assumptions
- The new `lib/app-clients.ts` tests validate delegation and null passthrough, but they still mock the provider-specific modules rather than exercising a live integration.
- The suite proves the locked app/component call sites import the new boundary in tests, but future files added outside the locked set could still reintroduce direct provider imports unless guarded by review discipline or linting.

## Acceptance Criteria
- [ ] The direct `lib/app-clients.ts` test file remains green and covers request, browser, privileged, and null-setup behavior.
- [ ] The migrated app/component tests continue to mock `@/lib/app-clients` rather than the provider-specific client modules.
- [ ] The full locked migration set remains free of direct `@/lib/supabase/server`, `@/lib/supabase/client`, and `@/lib/supabase/service-role` imports.
- [ ] The full test suite remains green after later stages.
