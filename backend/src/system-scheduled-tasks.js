import { createHash, randomUUID } from 'node:crypto';
import { createWbJobRecord } from './wildberries-repository.js';
import {
  listActiveClientsWithWbToken,
  syncClientWbDirectories,
  syncPublicWbDirectories,
} from './wildberries-directory-service.js';

const WB_COLLECT_PRODUCT_JOB = 'wb:collect:product';
const LOCK_MS = 15 * 60 * 1000;
const DEFAULT_PRODUCT_STALE_HOURS = 1;

export const SYSTEM_SCHEDULED_TASKS = [
  {
    id: 'wb-directories-sync',
    name: 'WB directories sync',
    description: 'Sync public and client Wildberries logistics and commission directories',
    cadence: 'daily_02_00_utc',
  },
  {
    id: 'wb-active-products-sync',
    name: 'WB active products sync',
    description: 'Enqueue stale active Wildberries products into the collection queue',
    cadence: 'hourly',
  },
];

const TASKS = new Map(SYSTEM_SCHEDULED_TASKS.map((task) => [task.id, task]));
const asJson = (value) => JSON.stringify(value === undefined ? null : value);
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const toIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const parseJson = (value) => {
  if (value === null || value === undefined || typeof value === 'object') return value ?? null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

export function nextRunForCadence(cadence, fromDate = new Date()) {
  const from = new Date(fromDate);
  if (!Number.isFinite(from.getTime())) return null;
  if (cadence === 'daily_02_00_utc') {
    const next = new Date(from);
    next.setUTCHours(2, 0, 0, 0);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }
  if (cadence === 'hourly') return new Date(from.getTime() + 60 * 60 * 1000).toISOString();
  return null;
}

function normalizeTask(row) {
  if (!row) return null;
  const definition = TASKS.get(row.id);
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
    last_result: parseJson(row.last_result),
    failure_count: toNumber(row.failure_count),
    locked_until: toIso(row.locked_until),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function normalizeRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    task_id: row.task_id,
    trigger: row.trigger,
    status: row.status,
    started_at: toIso(row.started_at),
    finished_at: toIso(row.finished_at),
    duration_ms: toNumber(row.duration_ms),
    result: parseJson(row.result),
    error: row.error || null,
    created_by: row.created_by || null,
    created_at: toIso(row.created_at),
  };
}

export async function ensureSystemScheduledTaskTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cadence TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
      next_run_at TIMESTAMPTZ,
      last_run_at TIMESTAMPTZ,
      last_status TEXT,
      last_error TEXT,
      last_result JSONB,
      failure_count INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('ALTER TABLE system_scheduled_tasks ADD COLUMN IF NOT EXISTS last_result JSONB');
  await pool.query('ALTER TABLE system_scheduled_tasks ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE system_scheduled_tasks ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_scheduled_tasks_due ON system_scheduled_tasks(status, next_run_at, locked_until)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_task_runs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      task_id TEXT NOT NULL REFERENCES system_scheduled_tasks(id) ON DELETE CASCADE,
      trigger TEXT NOT NULL DEFAULT 'scheduled' CHECK (trigger IN ('scheduled', 'manual')),
      status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      duration_ms NUMERIC,
      result JSONB,
      error TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_task_runs_task_started ON system_task_runs(task_id, started_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_system_task_runs_started ON system_task_runs(started_at DESC)');

  for (const task of SYSTEM_SCHEDULED_TASKS) {
    await pool.query(
      `INSERT INTO system_scheduled_tasks (id, name, description, cadence, status, next_run_at)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         cadence = EXCLUDED.cadence,
         next_run_at = COALESCE(system_scheduled_tasks.next_run_at, EXCLUDED.next_run_at),
         updated_at = now()`,
      [task.id, task.name, task.description, task.cadence, nextRunForCadence(task.cadence)],
    );
  }
}

export async function listScheduledTasks(pool) {
  const result = await pool.query('SELECT * FROM system_scheduled_tasks ORDER BY id');
  return result.rows.map(normalizeTask).filter(Boolean);
}

async function claimTask(pool, taskId, now, lockMs = LOCK_MS) {
  const result = await pool.query(
    `UPDATE system_scheduled_tasks
        SET locked_until = $2::timestamptz,
            last_status = 'running',
            updated_at = now()
      WHERE id = $1
        AND status = 'active'
        AND (locked_until IS NULL OR locked_until < $3::timestamptz)
      RETURNING *`,
    [taskId, new Date(now.getTime() + lockMs).toISOString(), now.toISOString()],
  );
  if (result.rows[0]) return normalizeTask(result.rows[0]);

  const existing = await pool.query('SELECT * FROM system_scheduled_tasks WHERE id = $1', [taskId]);
  const error = new Error(existing.rows[0] ? 'Scheduled task is not active or is already running' : 'Scheduled task not found');
  error.status = existing.rows[0] ? 409 : 404;
  throw error;
}

async function startRun(pool, taskId, trigger, actorEmail) {
  const result = await pool.query(
    `INSERT INTO system_task_runs (id, task_id, trigger, status, created_by)
     VALUES ($1, $2, $3, 'running', $4)
     RETURNING *`,
    [randomUUID(), taskId, trigger, actorEmail || null],
  );
  return normalizeRun(result.rows[0]);
}

async function finishRun(pool, runId, status, resultPayload, errorMessage) {
  const result = await pool.query(
    `UPDATE system_task_runs
        SET status = $2,
            finished_at = now(),
            duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
            result = $3::jsonb,
            error = $4
      WHERE id = $1
      RETURNING *`,
    [runId, status, asJson(resultPayload), errorMessage || null],
  );
  return normalizeRun(result.rows[0]);
}

async function updateTaskAfterRun(pool, task, status, resultPayload, errorMessage, now) {
  const result = await pool.query(
    `UPDATE system_scheduled_tasks
        SET last_run_at = now(),
            last_status = $2,
            last_error = $3,
            last_result = $4::jsonb,
            failure_count = CASE WHEN $2 = 'failed' THEN failure_count + 1 ELSE 0 END,
            next_run_at = $5::timestamptz,
            locked_until = NULL,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [task.id, status, errorMessage || null, asJson(resultPayload), nextRunForCadence(task.cadence, now)],
  );
  return normalizeTask(result.rows[0]);
}

async function runDirectoriesSync(pool, options = {}) {
  const locale = options.locale || 'ru';
  const publicResult = await syncPublicWbDirectories(pool, locale);
  const clients = await listActiveClientsWithWbToken(pool);
  const clientResults = [];
  for (const client of clients) {
    try {
      clientResults.push(await syncClientWbDirectories(pool, client, locale));
    } catch (error) {
      clientResults.push({ client_id: client.id, client_name: client.name, error: error?.message || String(error) });
    }
  }
  const failures = clientResults.filter((item) => item.error);
  const skipped = publicResult?.skipped && clientResults.length === 0;
  return {
    skipped,
    ok: failures.length === 0 && !skipped,
    public: publicResult,
    clients: clientResults,
    client_count: clientResults.length,
    failed_client_count: failures.length,
    reason: skipped ? publicResult.reason : undefined,
  };
}

async function loadStaleActiveProducts(pool, options = {}) {
  const limit = Math.max(1, Math.min(500, Number(options.limit || process.env.SCHEDULED_PRODUCT_SYNC_LIMIT || 100)));
  const staleHours = Math.max(1, Number(options.staleHours || process.env.SCHEDULED_PRODUCT_STALE_HOURS || DEFAULT_PRODUCT_STALE_HOURS));
  const result = await pool.query(
    `SELECT p.id, p.wb_sku, p.project_id, p.client_id, p.created_by, p.last_synced_at, c.created_by AS client_owner
       FROM products p
       LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.status = 'active'
        AND NULLIF(trim(COALESCE(p.wb_sku, '')), '') IS NOT NULL
        AND (p.last_synced_at IS NULL OR p.last_synced_at <= now() - ($1::int * interval '1 hour'))
        AND NOT EXISTS (
          SELECT 1 FROM wb_jobs j
           WHERE j.product_id = p.id
             AND j.status IN ('queued', 'running')
        )
      ORDER BY COALESCE(p.last_synced_at, p.updated_date, p.created_date) ASC
      LIMIT $2`,
    [staleHours, limit],
  );
  return result.rows;
}

function systemJobId(product) {
  return `system-wb-product-${createHash('sha1').update([product.id, product.wb_sku, product.last_synced_at || ''].join(':')).digest('hex')}`;
}

async function enqueueProductSyncJobs(pool, jobQueue, products, taskId) {
  if (!jobQueue?.add) {
    return { skipped: true, reason: 'BullMQ queue is unavailable', products: products.length, enqueued: 0, failed: [] };
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
        systemJobId(product),
        { email: ownerEmail || 'system', role: 'admin' },
      );
      await jobQueue.add(WB_COLLECT_PRODUCT_JOB, {
        ...jobRecord.payload,
        jobRecordId: jobRecord.id,
        user_email: ownerEmail,
        source_task_id: taskId,
      }, {
        jobId: jobRecord.id,
        attempts: Math.max(1, Number(process.env.WB_JOB_ATTEMPTS || 2)),
        removeOnComplete: { age: 24 * 60 * 60 },
        removeOnFail: false,
      });
      enqueued += 1;
    } catch (error) {
      failed.push({ product_id: product.id, wb_sku: product.wb_sku, error: error?.message || String(error) });
    }
  }
  return { ok: failed.length === 0, products: products.length, enqueued, failed };
}

async function executeTask(pool, taskId, options = {}) {
  if (taskId === 'wb-directories-sync') return runDirectoriesSync(pool, options);
  if (taskId === 'wb-active-products-sync') {
    const products = await loadStaleActiveProducts(pool, options);
    return enqueueProductSyncJobs(pool, options.jobQueue, products, taskId);
  }
  throw new Error(`Unknown scheduled task: ${taskId}`);
}

export async function runScheduledTask(pool, taskId, options = {}) {
  const now = options.now || new Date();
  const task = options.claimed ? TASKS.get(taskId) : await claimTask(pool, taskId, now, options.lockMs);
  if (!task) {
    const error = new Error('Scheduled task not found');
    error.status = 404;
    throw error;
  }

  const run = await startRun(pool, taskId, options.trigger || 'manual', options.actorEmail);
  try {
    const result = await executeTask(pool, taskId, options);
    const status = result?.skipped ? 'skipped' : 'success';
    const finishedRun = await finishRun(pool, run.id, status, result, null);
    const updatedTask = await updateTaskAfterRun(pool, task, status, result, null, now);
    return { ok: true, task: updatedTask, run: finishedRun, result };
  } catch (error) {
    const message = error?.message || String(error);
    const finishedRun = await finishRun(pool, run.id, 'failed', null, message);
    const updatedTask = await updateTaskAfterRun(pool, task, 'failed', null, message, now);
    return { ok: false, task: updatedTask, run: finishedRun, error: message };
  }
}

export async function processDueSystemTasks(pool, options = {}) {
  const now = options.now || new Date();
  const lockMs = Math.max(1, Number(options.lockMs || LOCK_MS));
  const due = await pool.query(
    `WITH due AS (
       SELECT id
         FROM system_scheduled_tasks
        WHERE status = 'active'
          AND next_run_at IS NOT NULL
          AND next_run_at <= $1::timestamptz
          AND (locked_until IS NULL OR locked_until < $1::timestamptz)
        ORDER BY next_run_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
     )
     UPDATE system_scheduled_tasks task
        SET locked_until = $2::timestamptz,
            last_status = 'running',
            updated_at = now()
       FROM due
      WHERE task.id = due.id
      RETURNING task.id`,
    [now.toISOString(), new Date(now.getTime() + lockMs).toISOString(), Math.max(1, Math.min(25, Number(options.limit || 10)))],
  );

  const results = [];
  for (const row of due.rows) {
    results.push(await runScheduledTask(pool, row.id, { ...options, trigger: 'scheduled', claimed: true, now }));
  }
  return results;
}
