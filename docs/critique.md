# Critique

Date: 2026-03-10
Reviewed by: Critic Agent
Scope: Stage 3 refactor for docs/briefs/provider-agnostic-data-access-and-client-naming-follow-up.md
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- If more slices start using paired request+privileged access, consider documenting when `createRequestAndPrivilegedClients()` is preferred over the individual helpers so the boundary stays consistent instead of becoming a grab bag of convenience functions.

### Risks / Assumptions
- The new paired helper improves clarity for the menu-import slice, but future use should stay disciplined so it does not encourage unrelated callers to take privileged access when they only need request-scoped auth.
- The exported client type aliases are convenient, but they still derive from provider-specific return types under the hood, so this remains an app-layer naming refactor rather than a provider-neutral type boundary.

## Acceptance Criteria
- [ ] Stage 4 changes, if any, keep the app-client boundary focused and do not broaden privileged access usage unnecessarily.
- [ ] `lib/app-clients.test.ts` continues to cover the paired helper as well as the individual request/browser/privileged helpers.
- [ ] The locked app/component set remains free of direct provider-specific client imports.
- [ ] The full test suite remains green after later stages.
