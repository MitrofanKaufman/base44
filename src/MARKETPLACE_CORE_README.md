# Marketplace Core Runtime

## Overview

The marketplace core runs on the local Express backend under `/api`. Admin documentation and Swagger load the backend OpenAPI document from `/api/openapi.json`; Swagger UI is available at `/api/docs`.

Unsupported legacy function/webhook contracts are intentionally not exposed. There is no `/functions/*` ingestion alias and no browser-owned marketplace scheduler.

## Runtime Flow

```
Admin UI
  -> /api/admin/scheduled-tasks
  -> backend worker
  -> Wildberries public and seller APIs
  -> PostgreSQL directories, product snapshots, price history, and task run logs
```

## Supported Backend Routes

### Admin

- `GET /api/admin/metrics`
- `GET /api/admin/scheduled-tasks`
- `POST /api/admin/scheduled-tasks/:id/run`
- `GET /api/admin/broadcasts`
- `POST /api/admin/broadcasts`
- `POST /api/admin/broadcasts/:id/send`
- `GET /api/admin/broadcast-schedules`
- `POST /api/admin/broadcast-schedules`
- `POST /api/admin/broadcast-schedules/:id/run`

### Activity

- `POST /api/activity/sessions` creates an opaque server-issued session id.
- `POST /api/activity/heartbeat` requires that session id for the authenticated user.

### Wildberries Sync

- `POST /api/wildberries/products/:productId/sync`
- `POST /api/wildberries/products/:productId/collect`
- `GET /api/wildberries/jobs`
- `GET /api/wildberries/jobs/:id`
- `POST /api/wildberries/jobs/:id/cancel`
- `POST /api/wildberries/clients/:clientId/logistics-directions/sync`
- `POST /api/wildberries/clients/:clientId/commission-directory/sync`
- `POST /api/wildberries/directories/commission/sync`

## Scheduled Tasks

The backend worker owns scheduled marketplace work through `system_scheduled_tasks` and records every attempt in `system_task_runs`.

- `wb-directories-sync`: daily at `02:00 UTC`; syncs public WB logistics/commission directories when a shared token exists, then all active client tokens.
- `wb-active-products-sync`: hourly; enqueues stale active WB products into BullMQ while skipping products that already have queued or running jobs.

Manual runs use the same backend handlers as automatic worker runs.

## Collection Runs

Interactive admin collection runs still write `IngestionRun` entities for operator-driven ETL and analysis workflows. UI counters should read `run.counters.*`; legacy root counter fields are only fallback compatibility.

## Security

- Admin routes require authenticated admin users.
- Activity heartbeat accepts only server-issued session ids.
- WB tokens stay server-side and are read from the database or shared backend environment variables.
- Browser login no longer starts marketplace sync timers.

## OpenAPI

Use `/api/openapi.json` as the source of truth. The Admin Swagger tab loads that document directly instead of shipping a hardcoded spec.
