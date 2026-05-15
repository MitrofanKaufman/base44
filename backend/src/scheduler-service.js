import os from 'node:os';
import { createWbJobRecord } from './wildberries-repository.js';
import {
  syncSharedWbDirectories,
  syncWbCommissionDirectory,
  syncWbLogisticsDirections,
  tokenMeta,
} from './wildberries-directory-service.js';

const WB_COLLECT_PRODUCT_JOB = 'wb:collect:product';

export const SCHEDULED_TASKS = [
  {
    id: 'wb-directory-sync',
    name: 'WB directory sync',
    description: 'Synchronize Wildberries logistics and commission directories',
    cadence: 'daily_02_00',
  },
  {
    id: 'wb-active-product-collection',
    name: 'WB active product collection',
    description: 'Enqueue collection jobs for active products with WB SKU',
    cadence: 'every_15_minutes',
  },
  {
    id: 'wb-sales-prices-sync',
    name: 'WB sales and prices sync',
    description: 'Server-owned replacement for browser Wildberries price sync',
    cadence: 'every_30_minutes',
  },
];

const TASK_BY_ID = new Map(SCHEDULED_TASKS.map((task) => [task.id, task]));
const DEFAULT_PRODUCT_LIMIT = 50;
const DEFAULT_WORKER_STALE_SECONDS = 120;
const DEFAULT_BACKLOG_ALERT_THRESHOLD = 50;
const DEFAULT_FAILED_ALERT_THRESHOLD = 1;

const json = (value) => JSON.stringify(value ?? {});

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toIso = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const parseJson = (value, fallback = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

export function nextRunForTask(taskId, fromDate = new Date()) {
  const from = new Date(fromDate);
  if (taskId === 'wb-directory-sync') {
    const next = new Date(from);
    next.setHours(2, 0, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  if (taskId === 'wb-active-product-collection') {
    return new Date(from.getTime() + 15 * 60 * 1000).toISOString();
  }
  if (taskId === 'wb-sales-prices-sync') {
    return new Date(from.getTime() + 30 * 60 * 1000).toISOString();
  }
  return null;
}

function normalizeTaskRow(row) {
  if (!row) return null;
  const definition = TASK_BY_ID.get(row.id);
  return {
    id: row.id,
    name: row.name || definition?.name || row.id,
    description: row.description || definition?.description || '',
    cadence: row.cadence || definition?.cadence || 'manual',
    status: row.status || 'active',
    next_run_at: toIso(row.next_run_at),
    last_run_at: toIso(row.last_run_at),
    last_status: row.last_status || null,
    last_error: row.last_error || null,
    last_error_at: toIso(row.last_error_at),
    locked_until: toIso(row.locked_until),
    created_date: toIso(row.created_date),
    updated_date: toIso(row.updated_date),
  };
}

function normalizeSyncLogRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    task_id: row.task_id,
    task_name: row.task_name,
    status: row.status,
    started_at: toIso(row.started_at),
    finished_at: toIso(row.finished_at),
    duration_ms: toNumber(row.duration_ms),
    result: parseJson(row.result, null),
    error: row.error || null,
    created_by: row.created_by || null,
    created_date: toIso(row.created_date),
  };
}

function normalizeWorkerRow(row, now = new Date()) {
  if (!row) return null;
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at) : null;
  const staleAfterSeconds = toNumber(process.env.WORKER_STALE_AFTER_SECONDS, DEFAULT_WORKER_STALE_SECONDS);
  const ageSeconds = lastSeen ? Math.max(0, Math.floor((now.getTime() - lastSeen.getTime()) / 1000)) : null;
  return {
    worker_id: row.worker_id,
    process_id: toNumber(row.process_id),
    queue_name: row.queue_name,
    host_name: row.host_name,
    status: row.status || 'unknown',
    last_seen_at: toIso(row.last_seen_at),
    age_seconds: ageSeconds,
    stale: ageSeconds === null || ageSeconds > staleAfterSeconds || row.status !== 'running',
    metadata: parseJson(row.metadata, {}),
  };
}

export async function ensureSchedulerTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cadence TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
      next_run_at TIMESTAMPTZ,
      last_run_at TIMESTAMPTZ,
      last_status TEXT,
      last_error TEXT,
      last_error_at TIMESTAMPTZ,
      locked_until TIMESTAMPTZ,
      created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due ON scheduled_tasks(status, next_run_at, locked_until)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      task_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      duration_ms NUMERIC,
      result JSONB,
      error TEXT,
      created_by TEXT,
      created_date TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sync_logs_task_started ON sync_logs(task_id, started_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      worker_id TEXT PRIMARY KEY,
      process_id NUMERIC,
      queue_name TEXT,
      host_name TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_seen ON worker_heartbeats(last_seen_at DESC)');

  for (const task of SCHEDULED_TASKS) {
    await pool.query(
      `INSERT INTO scheduled_tasks (id, name, description, cadence, status, next_run_at)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         cadence = EXCLUDED.cadence,
         updated_date = now()`,
      [task.id, task.name, task.description, task.cadence, nextRunForTask(task.id)],
    );
  }
}

export async function listScheduledTasks(pool) {
  const result = await pool.query('SELECT * FROM scheduled_tasks ORDER BY id');
  return result.rows.map(normalizeTaskRow).filter(Boolean);
}

export async function listSyncLogs(pool, filters = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(filters.limit || 100)));
  const values = [];
  let where = '';
  if (filters.task_id || filters.taskId) {
    values.push(String(filters.task_id || filters.taskId));
    where = 'WHERE task_id = $1';
  }
  const result = await pool.query(
    `SELECT * FROM sync_logs ${where} ORDER BY started_at DESC LIMIT $${values.length + 1}`,
    [...values, safeLimit],
  );
  return result.rows.map(normalizeSyncLogRow).filter(Boolean);
}

async function startSyncLog(pool, task, actorEmail) {
  const result = await pool.query(
    `INSERT INTO sync_logs (task_id, task_name, status, created_by)
     VALUES ($1, $2, 'running', $3)
     RETURNING *`,
    [task.id, task.name, actorEmail || null],
  );
  return normalizeSyncLogRow(result.rows[0]);
}

async function finishSyncLog(pool, logId, status, resultPayload, errorMessage) {
  const result = await pool.query(
    `UPDATE sync_logs
        SET status = $2,
            finished_at = now(),
            duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
            result = $3::jsonb,
            error = $4
      WHERE id = $1
      RETURNING *`,
    [logId, status, json(resultPayload), errorMessage || null],
  );
  return normalizeSyncLogRow(result.rows[0]);
}

async function updateTaskAfterRun(pool, taskId, status, nextRunAt, errorMessage) {
  const result = await pool.query(
    `UPDATE scheduled_tasks
        SET last_run_at = now(),
            last_status = $2,
            last_error = $3,
            last_error_at = CASE WHEN $3 IS NULL THEN NULL ELSE now() END,
            next_run_at = $4,
            locked_until = NULL,
            updated_date = now()
      WHERE id = $1
      RETURNING *`,
    [taskId, status, errorMessage || null, nextRunAt],
  );
  return normalizeTaskRow(result.rows[0]);
}

async function loadActiveProducts(pool, options = {}) {
  const limit = Math.max(1, Math.min(500, Number(options.limit || process.env.SCHEDULED_PRODUCT_SYNC_LIMIT || DEFAULT_PRODUCT_LIMIT)));
  const requireClientToken = Boolean(options.requireClientToken);
  const result = await pool.query(
    `SELECT
       p.id,
       p.wb_sku,
       p.project_id,
       p.client_id,
       p.created_by,
       c.wb_api_token,
       c.created_by AS client_owner
     FROM products p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.status = 'active'
       AND NULLIF(trim(COALESCE(p.wb_sku, '')), '') IS NOT NULL
       AND ($1::boolean = false OR NULLIF(trim(COALESCE(c.wb_api_token, '')), '') IS NOT NULL)
     ORDER BY COALESCE(p.last_synced_at, p.updated_date, p.created_date) ASC
     LIMIT $2`,
    [requireClientToken, limit],
  );
  return result.rows;
}

async function enqueueProductCollections(pool, jobQueue, products, taskId) {
  if (!jobQueue?.add) {
    return { skipped: true, reason: 'BullMQ queue is unavailable', enqueued: 0, products: products.length };
  }

  let enqueued = 0;
  const failed = [];
  for (const product of products) {
    try {
      const ownerEmail = product.created_by || product.client_owner || null;
      const payload = {
        article: product.wb_sku,
        product_id: product.id,
        project_id: product.project_id,
        client_id: product.client_id,
        user_email: ownerEmail,
        source_task_id: taskId,
      };
      const jobRecord = await createWbJobRecord(
        pool,
        payload,
        ownerEmail,
        undefined,
        { role: 'admin', email: ownerEmail || 'system' },
      );
      await jobQueue.add(
        WB_COLLECT_PRODUCT_JOB,
        {
          ...jobRecord.payload,
          jobRecordId: jobRecord.id,
          user_email: ownerEmail,
          source_task_id: taskId,
        },
        {
          jobId: jobRecord.id,
          attempts: Math.max(1, Number(process.env.WB_JOB_ATTEMPTS || 2)),
          removeOnComplete: { age: 24 * 60 * 60 },
          removeOnFail: false,
        },
      );
      enqueued += 1;
    } catch (error) {
      failed.push({
        product_id: product.id,
        wb_sku: product.wb_sku,
        error: error?.message || String(error),
      });
    }
  }

  return {
    ok: failed.length === 0,
    products: products.length,
    enqueued,
    failed,
  };
}

async function runDirectorySync(pool) {
  const publicResult = await syncSharedWbDirectories(pool);
  const clientsResult = await pool.query(
    `SELECT id, name, wb_api_token, created_by
     FROM clients
     WHERE status = 'active'
       AND NULLIF(trim(COALESCE(wb_api_token, '')), '') IS NOT NULL
     ORDER BY updated_date DESC
     LIMIT $1`,
    [Math.max(1, Math.min(250, Number(process.env.SCHEDULED_DIRECTORY_CLIENT_LIMIT || 100)))],
  );

  const clients = [];
  for (const client of clientsResult.rows) {
    try {
      const [logistics, commission] = await Promise.all([
        syncWbLogisticsDirections(pool, client.wb_api_token, client.created_by),
        syncWbCommissionDirectory(pool, client.wb_api_token, client.created_by, 'ru'),
      ]);
      clients.push({
        client_id: client.id,
        client_name: client.name,
        token: tokenMeta(client.wb_api_token),
        logistics: { count: logistics.count, inserted: logistics.inserted, updated: logistics.updated },
        commission: { count: commission.count },
      });
    } catch (error) {
      clients.push({
        client_id: client.id,
        client_name: client.name,
        token: tokenMeta(client.wb_api_token),
        error: error?.message || String(error),
      });
    }
  }

  return {
    ok: true,
    public: publicResult,
    clients,
    client_count: clients.length,
  };
}

async function executeScheduledTask(pool, jobQueue, taskId) {
  if (taskId === 'wb-directory-sync') {
    return runDirectorySync(pool);
  }
  if (taskId === 'wb-active-product-collection') {
    const products = await loadActiveProducts(pool);
    return enqueueProductCollections(pool, jobQueue, products, taskId);
  }
  if (taskId === 'wb-sales-prices-sync') {
    const products = await loadActiveProducts(pool, { requireClientToken: true });
    const result = await enqueueProductCollections(pool, jobQueue, products, taskId);
    return {
      ...result,
      sales_data_note: 'Server task currently refreshes product price data through WB collection jobs.',
    };
  }
  throw new Error(`Unknown scheduled task: ${taskId}`);
}

export async function runScheduledTask(pool, jobQueue, taskId, options = {}) {
  const task = TASK_BY_ID.get(taskId);
  if (!task) {
    const error = new Error('Scheduled task not found');
    error.status = 404;
    throw error;
  }

  const log = await startSyncLog(pool, task, options.actorEmail);
  try {
    const result = await executeScheduledTask(pool, jobQueue, taskId);
    const status = result?.skipped ? 'skipped' : 'success';
    const finishedLog = await finishSyncLog(pool, log.id, status, result, null);
    const updatedTask = await updateTaskAfterRun(pool, taskId, status, nextRunForTask(taskId), null);
    return {
      ok: status === 'success',
      task: updatedTask,
      log: finishedLog,
      result,
    };
  } catch (error) {
    const message = error?.message || String(error);
    const finishedLog = await finishSyncLog(pool, log.id, 'failed', null, message);
    const updatedTask = await updateTaskAfterRun(pool, taskId, 'failed', nextRunForTask(taskId), message);
    return {
      ok: false,
      task: updatedTask,
      log: finishedLog,
      error: message,
    };
  }
}

export async function processDueScheduledTasks(pool, jobQueue, now = new Date()) {
  const due = await pool.query(
    `WITH due AS (
       SELECT id
         FROM scheduled_tasks
        WHERE status = 'active'
          AND next_run_at IS NOT NULL
          AND next_run_at <= $1::timestamptz
          AND (locked_until IS NULL OR locked_until < $1::timestamptz)
        ORDER BY next_run_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
     )
     UPDATE scheduled_tasks task
        SET locked_until = $2::timestamptz,
            updated_date = now()
       FROM due
      WHERE task.id = due.id
      RETURNING task.id`,
    [
      now.toISOString(),
      new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      10,
    ],
  );

  const results = [];
  for (const row of due.rows) {
    results.push(await runScheduledTask(pool, jobQueue, row.id));
  }
  return results;
}

export function resolveWorkerId() {
  return process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
}

export async function recordWorkerHeartbeat(pool, payload = {}) {
  const workerId = payload.workerId || payload.worker_id || resolveWorkerId();
  const metadata = payload.metadata || {};
  const result = await pool.query(
    `INSERT INTO worker_heartbeats (
       worker_id, process_id, queue_name, host_name, status, last_seen_at, metadata
     ) VALUES ($1, $2, $3, $4, $5, now(), $6::jsonb)
     ON CONFLICT (worker_id) DO UPDATE SET
       process_id = EXCLUDED.process_id,
       queue_name = EXCLUDED.queue_name,
       host_name = EXCLUDED.host_name,
       status = EXCLUDED.status,
       last_seen_at = now(),
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING *`,
    [
      workerId,
      payload.processId || process.pid,
      payload.queueName || 'base44-jobs',
      payload.hostName || os.hostname(),
      payload.status || 'running',
      json(metadata),
    ],
  );
  return normalizeWorkerRow(result.rows[0]);
}

export async function markWorkerStopped(pool, payload = {}) {
  const workerId = payload.workerId || payload.worker_id || resolveWorkerId();
  const result = await pool.query(
    `UPDATE worker_heartbeats
        SET status = 'stopped',
            last_seen_at = now(),
            updated_at = now()
      WHERE worker_id = $1
      RETURNING *`,
    [workerId],
  );
  return normalizeWorkerRow(result.rows[0]);
}

export async function readWorkerHealth(pool, now = new Date()) {
  const result = await pool.query(
    `SELECT *
     FROM worker_heartbeats
     ORDER BY last_seen_at DESC
     LIMIT 25`,
  );
  const items = result.rows.map((row) => normalizeWorkerRow(row, now)).filter(Boolean);
  return {
    active: items.filter((item) => !item.stale).length,
    stale: items.filter((item) => item.stale).length,
    items,
  };
}

export function buildOperationalAlerts(metrics) {
  const alerts = [];
  const queue = metrics.collectionQueue || {};
  const bull = queue.bull || {};
  const pending = toNumber(queue.queued) + toNumber(bull.waiting) + toNumber(bull.delayed);
  const failed = toNumber(queue.failed) + toNumber(bull.failed);
  const backlogThreshold = toNumber(process.env.QUEUE_BACKLOG_ALERT_THRESHOLD, DEFAULT_BACKLOG_ALERT_THRESHOLD);
  const failedThreshold = toNumber(process.env.QUEUE_FAILED_ALERT_THRESHOLD, DEFAULT_FAILED_ALERT_THRESHOLD);

  if (bull.unavailable) {
    alerts.push({
      id: 'bullmq-unavailable',
      severity: 'critical',
      title: 'BullMQ unavailable',
      message: bull.error || 'Queue metrics could not be read.',
    });
  }
  if (failed >= failedThreshold) {
    alerts.push({
      id: 'queue-failed-jobs',
      severity: 'warning',
      title: 'Failed queue jobs',
      message: `${failed} failed queue job(s) require review.`,
    });
  }
  if (pending >= backlogThreshold) {
    alerts.push({
      id: 'queue-backlog',
      severity: 'warning',
      title: 'Queue backlog',
      message: `${pending} queued or delayed job(s) exceed threshold ${backlogThreshold}.`,
    });
  }
  if ((metrics.workers?.items || []).length === 0) {
    alerts.push({
      id: 'worker-heartbeat-missing',
      severity: 'warning',
      title: 'Worker heartbeat missing',
      message: 'No worker heartbeat has been recorded yet.',
    });
  } else if (toNumber(metrics.workers?.stale) > 0) {
    alerts.push({
      id: 'worker-heartbeat-stale',
      severity: 'critical',
      title: 'Stale worker heartbeat',
      message: `${metrics.workers.stale} worker heartbeat(s) are stale or stopped.`,
    });
  }

  return alerts;
}

export async function getSyncStatus(pool) {
  const [tasks, logs] = await Promise.all([
    listScheduledTasks(pool),
    listSyncLogs(pool, { limit: 25 }),
  ]);

  return {
    ok: true,
    tasks,
    logs,
    last_log: logs[0] || null,
    active: tasks.some((task) => task.status === 'active'),
  };
}
