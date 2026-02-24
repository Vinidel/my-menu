# Admin Orders Dashboard Polling (TanStack Query) — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/admin-orders-dashboard-polling-tanstack-query.md](briefs/admin-orders-dashboard-polling-tanstack-query.md)

---

## What Was Delivered

- **Automatic `/admin` refresh with TanStack Query:** The employee dashboard now polls for updated orders without full page reloads.
- **Protected polling route (`Option A`):** Added `GET /api/admin/orders` for authenticated admin polling reads (server-side auth check + parsed dashboard payload response).
- **Initial data hydration:** Polling starts from the existing server-loaded `/admin` orders (`initialOrders`) to preserve initial load UX and avoid client-only loading regressions.
- **Locked polling cadence/visibility behavior:**
  - polls every `10s` while the tab is visible
  - pauses when the tab is hidden
  - triggers one immediate refetch on visibility restore, then resumes the `10s` cadence
- **Mutation conflict handling:** Poll responses do not overwrite the local pending UI state for the order currently being progressed until that mutation settles.
- **Background polling failure UX:** When a background refresh fails, the dashboard keeps the last successful data visible and shows a pt-BR non-destructive error banner.
- **No behavior regression to existing `/admin` UX:** Status-first sorting, mobile accordion behavior, summary counts, extras rendering, and status progression remain intact.
- **Stage 4 hardening:** Polling route responses now include stronger cache/privacy headers (`private, no-store`, `Vary: Cookie`) and client polling disables reconnect-triggered extra refetches for deterministic behavior.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Admin page (`/admin`) enables polling | `app/admin/page.tsx` |
| Admin dashboard UI + TanStack Query polling | `components/admin-orders-dashboard.tsx` |
| Protected polling route (`GET /api/admin/orders`) | `app/api/admin/orders/route.ts` |
| Shared admin order parsing | `lib/orders.ts` |
| Route tests | `app/api/admin/orders/route.test.ts` |
| Dashboard polling tests | `components/admin-orders-dashboard.test.tsx` |
| Stage 1 implementation notes | `docs/implementation-notes.md` |
| Stage 4 hardening notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Library:** TanStack Query is the polling/query-state layer for this feature.
- **Polling interval:** `10 seconds` while `/admin` is visible.
- **Hidden-tab behavior:** Polling pauses while hidden.
- **Visibility restore behavior:** One immediate refetch on visibility restore, then continue normal `10s` polling.
- **Initial data strategy:** Reuse existing server-loaded `/admin` orders as initial query data.
- **Authenticated read path:** `GET /api/admin/orders` (brief-preferred Option A), no public order reads.
- **Response shape (Option A):** Route returns parsed dashboard orders (same payload shape consumed by `AdminOrdersDashboard`) to avoid client-side parsing duplication.
- **Polling vs mutation conflict rule:** Polling must not replace the local pending UI state for the order currently being progressed until the mutation settles.
- **UI parity:** Status-first sorting, mobile accordion (`<768px`, single-expand), summary counts, and existing status progression/stale handling remain unchanged.
- **Language:** Employee-facing messages/feedback remain pt-BR.

---

## API Contract (`GET /api/admin/orders`)

Purpose: authenticated polling read endpoint for the `/admin` dashboard.

- **Auth:** server-side `supabase.auth.getUser()` check required
- **Success (`200`)**
  - body: `{ ok: true, orders: AdminOrder[] }`
- **Unauthenticated (`401`)**
  - body: `{ ok: false, message: "Acesso não autorizado." }`
- **Supabase setup unavailable (`503`)**
  - body: `{ ok: false, message: "Pedidos indisponíveis no momento..." }`
- **Read failure (`500`)**
  - body: `{ ok: false, message: "Não foi possível carregar os pedidos agora..." }`

Headers (Stage 4 hardening):
- `Cache-Control: private, no-store`
- `Vary: Cookie`

---

## Known Gaps & Deferred Work

- **No realtime subscriptions:** Polling only; Supabase Realtime/websockets remain a future feature.
- **No polling telemetry:** No metrics/alerts for polling failures, refetch volume, or latency.
- **Multi-tab request multiplication:** Each admin tab polls independently (accepted for current scale).
- **No advanced UX polish for reordering:** Orders may move after successful polls/mutations due to status-first sorting; scroll anchoring/animation is out of scope.
- **No dedicated “last updated” timestamp:** The dashboard does not show polling freshness metadata yet.

---

## Operational Notes

- **Polling route is authenticated:** Requests to `GET /api/admin/orders` must carry the employee session cookie; middleware protects `/admin` page access, and the route separately checks auth server-side.
- **Client polling behavior:** Query polling is enabled only when `AdminOrdersDashboard` receives `enablePolling` (the `/admin` page enables it; most direct component tests leave it off).
- **Deterministic refresh configuration:** `refetchOnWindowFocus` and `refetchOnReconnect` are disabled to preserve the brief-locked visibility-driven polling contract.
- **Background failure UX:** If a poll fails after data has loaded, the dashboard keeps the previous orders visible and shows a pt-BR feedback banner.
- **Regression checks after polling changes:**
  - hidden tab pauses polling
  - visible restore triggers one immediate refetch
  - status progression local pending state is preserved during overlapping polls
  - mobile accordion remains usable with polling enabled

---

## For the Next Engineer

- **If you move to Realtime:** Treat it as a new feature brief; decide whether polling remains as fallback and how to reconcile with current mutation conflict logic.
- **If you change query defaults:** Reconfirm the brief-locked visibility contract (one immediate restore refetch + `10s` cadence) and update tests/docs together.
- **If you optimize request load:** Consider tab coordination/shared worker or server push only after validating real traffic volume.
- **If you add polling observability:** Start with route-level counters/error rates and a lightweight client-side failure count surfaced in `docs/hardening-notes.md`.
