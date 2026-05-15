# Marketplace Runtime Integration Checklist

## Backend API

- [ ] Local API is reachable through `/api`.
- [ ] `/api/openapi.json` returns the backend OpenAPI document for an admin user.
- [ ] `/api/docs` renders Swagger UI for an admin user.
- [ ] Admin UI Swagger loads `/api/openapi.json`.

## Scheduled Work

- [ ] `system_scheduled_tasks` and `system_task_runs` exist after backend startup.
- [ ] `wb-directories-sync` is seeded and scheduled for `02:00 UTC`.
- [ ] `wb-active-products-sync` is seeded and scheduled hourly.
- [ ] Manual task runs work from Admin Dashboard -> Scheduled Tasks.
- [ ] Worker processes due scheduled tasks on `SYSTEM_TASK_INTERVAL_MS` default `60000`.
- [ ] Active WB products already queued or running are not enqueued again.
- [ ] Missing shared WB token records a skipped directory run when no client tokens exist.

## Wildberries Routes

- [ ] `POST /api/wildberries/products/:productId/sync` updates one product through backend auth.
- [ ] `POST /api/wildberries/clients/:clientId/logistics-directions/sync` syncs client logistics directories.
- [ ] `POST /api/wildberries/clients/:clientId/commission-directory/sync` syncs client commission directories.
- [ ] `POST /api/wildberries/directories/commission/sync` is admin-only.

## Activity Heartbeat

- [ ] Client creates a session through `POST /api/activity/sessions` after auth.
- [ ] Client stores only the opaque session id in `sessionStorage`.
- [ ] `POST /api/activity/heartbeat` rejects unknown session ids for the authenticated user.

## Broadcasts

- [ ] Failed scheduled broadcast attempts increment `failure_count`.
- [ ] Failure state stores `last_error` and `last_attempt_at`.
- [ ] Retries back off through `next_run_at`.
- [ ] Five consecutive failures pause the schedule.
- [ ] Successful runs clear failure state.

## Verification

- [ ] `npm run test:backend-access`
- [ ] `npm run test:wb-logistics`
- [ ] `npm run test:unit-economics`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run typecheck`
- [ ] Legacy ingestion route reference search has no active contract matches.
- [ ] Admin scheduling and sync code has no LLM-invocation usage.
- [ ] Browser-owned WB scheduler names no longer appear under `src`.
