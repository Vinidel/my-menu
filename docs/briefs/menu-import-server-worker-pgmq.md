# Feature Brief — Server-Side Menu Import Processing (PGMQ)

Status: Stage 0 — Framing  
Date: 2026-03-04  
Author: Orchestrator Agent

---

## Alternative Name

Background worker for menu imports / Remove browser dependency from `ProcessingPoller` / Queue-based extraction pipeline

---

## Problem

Today menu-import processing is advanced by a browser poller (`/admin/cardapio` open tab calls `POST /api/admin/menu-import/process-next` every 5s).

This creates an operational gap:
- if no authorized admin tab is open, jobs stay in `processing`
- processing throughput/latency depends on user activity
- retries/backoff/concurrency controls are limited

---

## Goal

Move menu-import processing to a server-side queue worker using **PGMQ** so jobs continue without an open admin tab.

Success = upload creates queued work, server-side worker processes it asynchronously, and UI reflects status changes independent of browser presence.

---

## Who

- **Owner/admin (Vinny):** expects reliable imports that finish even when admin page is closed.
- **Employees:** continue to review draft status in `/admin/cardapio`.
- **Developers/operators:** need predictable processing lifecycle, retries, and diagnosability.

---

## What Changes

- **Queue backend:** use `pgmq` in Supabase Postgres for menu-import jobs.
- **Producer path:** upload action enqueues job message after creating job/version records.
- **Worker path:** server-side processor consumes queue, runs extraction, updates `menu_import_jobs` + `menu_versions`.
- **Scheduler/trigger:** server-side recurring trigger (cron/worker entrypoint) runs independent of browser tabs.
- **UI behavior:** `/admin/cardapio` remains read-only status UI; no longer responsible for driving processing.

---

## Success Criteria

- [ ] Upload no longer depends on browser polling to progress jobs.
- [ ] A queued job is processed server-side and transitions status to `ready`, `ready_with_issues`, or `failed`.
- [ ] Existing owner-only access guard for menu import remains enforced.
- [ ] Processing remains idempotent (retries do not produce duplicate draft versions).
- [ ] Error cases are logged with job/version ids and actionable messages.
- [ ] `/admin/cardapio` status view stays accurate and near-real-time.
- [ ] Existing publish/discard behavior is unchanged.

---

## Non-Goals (Out of Scope)

- General-purpose queue framework for all app features.
- Rebuilding the menu-import extraction logic.
- Introducing a new external queue vendor.
- Full observability stack (metrics dashboard/alerts) in this feature.

---

## Acceptance Scenarios

### Happy Paths

1. **Upload -> queue -> ready:** Owner uploads images, job is queued, worker processes it, draft becomes `ready`.
2. **Upload with extraction issues:** Worker finishes with parsed items + issues, status `ready_with_issues`.
3. **Owner closes browser:** Processing still completes and status updates in DB.

### Unhappy Paths

1. **Extractor timeout/network error:** Worker marks job `failed`, stores failure note, active menu unchanged.
2. **Worker crash/restart mid-job:** message is retried and eventually completed or dead-lettered by policy.
3. **Queue backend unavailable:** upload fails fast with pt-BR error and no partial active-menu impact.
4. **Scheduler downtime and recovery:** scheduler is down temporarily, then resumes; queued jobs are drained and statuses progress without manual browser intervention.
5. **Unauthorized worker trigger attempt:** non-authorized caller cannot invoke processing; request is denied and no queue consumption happens.

---

## Edge Cases

- Same job processed twice due to retry race (must be idempotent via DB status guards).
- Long-running extraction overlapping next scheduler tick.
- Poison message that repeatedly fails extraction.
- Backlog spikes (multiple imports queued quickly).
- Scheduler down period; jobs should resume when scheduler returns.

---

## Approach (High-Level Rationale)

1. Enable/configure `pgmq` primitives in Supabase.
2. Define queue message payload with stable ids (`jobId`, `versionId`).
3. On upload, enqueue processing message once DB rows are created.
4. Implement worker consumer to read/lock one message, process extraction, update DB transactionally.
5. Add retry policy + max attempts; failed terminal state writes clear error metadata.
6. Keep `/admin/cardapio` for status rendering only (optional lightweight refresh remains for UX).

---

## Scheduler Model (Locked)

- **Primary execution path (locked):** Supabase-native scheduler:
  - `pg_cron` runs every 1 minute
  - cron triggers a Supabase Edge Function worker (via `pg_net` HTTP call)
- **Scheduler -> worker auth (locked):**
  - worker endpoint requires `Authorization: Bearer <MENU_IMPORT_WORKER_SECRET>`
  - cron call includes this bearer token
  - secret is stored in Supabase Edge Function secrets / project env, never in client code
- **Worker run contract:** each invocation processes up to a bounded batch (e.g., max 5 messages) to keep request time predictable.
- **Scheduler outage behavior:** messages remain queued; when cron resumes, backlog is drained in FIFO queue order (subject to retry visibility windows).
- **No browser dependency:** `ProcessingPoller` is UX refresh-only and is not required for job progression.
- **Legacy endpoint coexistence (locked):**
  - `POST /api/admin/menu-import/process-next` is deprecated and must not be used as primary processor
  - endpoint is retained only as manual admin fallback during rollout (owner-only)
  - once queue worker is stable in production, endpoint is removed in a follow-up cleanup change

---

## Decisions (Locked)

- **Primary design:** queue-backed server-side processing (no browser-driven processing dependency).
- **Queue technology:** **PGMQ preferred**.
- **Queue name (locked):** `menu-imports-queue` (already created in Supabase).
- **Fallback rule:** if `pgmq` is not available/enabled in this Supabase project, implement equivalent Postgres queue table + `FOR UPDATE SKIP LOCKED` consumer with same message contract.
- **Fallback selection timing (locked):** capability is decided at implementation/migration time for this environment (single queue backend active); no runtime dual-branch queue selection.
- **Message contract:** includes `jobId`, `versionId`, storage page references (or resolvable pointers).
- **Message payload minimization (locked):** queue payload carries stable IDs/pointers (`jobId`, `versionId`) only; large image/base64 data is never stored in queue messages.
- **Retry / dead-letter policy (locked):**
  - max attempts: `5`
  - retry delay: fixed `60s` between attempts (MVP)
  - terminal failure: mark `menu_import_jobs.status = 'failed'`, persist `error_message`, and update linked draft `notes`
- **Concurrency / claim strategy (locked):**
  - consumer must claim one message atomically via queue visibility/lock semantics (or `SKIP LOCKED` fallback)
  - processing mutation runs with DB status guard (`status='processing'` for target job)
  - duplicate delivery after successful completion is treated as no-op (idempotent)
- **Queue ordering semantics (locked):** FIFO is best-effort; retries/redelivery may reorder failed messages behind newer healthy jobs.
- **Access control unchanged:** menu import remains owner-only (`MENU_IMPORT_ALLOWED_EMAILS`).
- **No active-menu risk:** processing failures never modify active published menu.
- **Language:** pt-BR for user-visible messages.

---

## Dependencies / Prerequisites

- Supabase project must support required queue mechanism:
  - `pgmq` available and permitted, **or** fallback queue-table approach.
- Supabase scheduler extensions enabled for cron flow:
  - `pg_cron`
  - `pg_net`
- Edge Function deployed for queue processing and callable from cron schedule.
- Worker secret configured for scheduler auth:
  - `MENU_IMPORT_WORKER_SECRET`
- Existing OpenAI and storage env vars remain required.

---

## Stage 0 Exit Gate

- [x] Problem clearly defined
- [x] Goals concrete and testable
- [x] Non-goals explicit
- [x] Happy/unhappy paths documented
- [x] Edge cases surfaced
- [x] Key decisions locked
- [x] High-level approach outlined
- [ ] Critic approved
