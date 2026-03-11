# Retrospective — delete-orders

Date: 2026-03-11
Workflow: Full

---

## What We Learned

- **Timezone robustness:** Critic flagged in Stage 1 that `current_date` depended on session/connection timezone. Hardener implemented `(now() at time zone 'America/Sao_Paulo')::date` in Stage 3 — a clear example of the workflow catching a subtle bug before production.
- **Observability:** The brief asked to "log or emit count of deleted rows when possible." RAISE NOTICE in the function satisfies this and surfaces in Supabase/postgres logs without extra infrastructure.

## Workflow Fit

- Full workflow was appropriate: irreversible deletion plus timezone/scheduler risk warranted Orchestrator → Implementer → Tester → Hardener → Documenter.
- Critic feedback in Stage 1 flowed into Stage 3 hardening; no rework in later stages.

## What Helped

- The brief locked `America/Sao_Paulo` and `updated_at` early.
- Tester covered cutoff semantics and inclusive-start edge cases.
- Hardening sweep consolidated security, dependencies, performance, observability, resilience in one place.

## What To Keep

- Explicit timezone in cutoff logic for any scheduled job; avoid `current_date` when the job's "day" must match a specific timezone.
- RAISE NOTICE for low-cadence jobs when structured metrics are not yet in place.
