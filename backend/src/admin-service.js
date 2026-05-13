import os from 'node:os';
import { randomUUID } from 'node:crypto';

const ONLINE_WINDOW_MINUTES = 5;
const DEFAULT_ACTIVITY_SESSION_ID = 'default-session';
const BROADCAST_AUDIENCES = new Set(['all', 'active_subscribers', 'paid_accounts', 'admins']);
const BROADCAST_CADENCES = new Set(['once', 'daily', 'weekly', 'subscription_expiring']);
const BROADCAST_CATEGORIES = new Set(['notification', 'reminder', 'system', 'billing']);
const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807;

let previousCpuSample;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toPositiveInt = (value, fallback) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const normalizeAudience = (audience) => (
  BROADCAST_AUDIENCES.has(audience) ? audience : 'all'
);

const normalizeCategory = (category) => (
  BROADCAST_CATEGORIES.has(category) ? category : 'notification'
);

const normalizeCadence = (cadence) => (
  BROADCAST_CADENCES.has(cadence) ? cadence : 'once'
);

const normalizeFilters = (filters) => (
  filters && typeof filters === 'object' && !Array.isArray(filters) ? filters : {}
);

function constrainedMemoryBytes() {
  try {
    if (typeof process.constrainedMemory === 'function') {
      const bytes = Number(process.constrainedMemory());
      if (Number.isFinite(bytes) && bytes > 0 && bytes < POSTGRES_BIGINT_MAX) return bytes;
    }
  } catch {
    // Ignore unsupported runtime probes.
  }
  return os.totalmem();
}

export function collectProcessLoad() {
  const now = Date.now();
  const usage = process.cpuUsage();
  const totalMicros = usage.user + usage.system;
  const parallelism = Math.max(1, os.availableParallelism?.() || os.cpus()?.length || 1);

  let cpuLoadPct;
  if (previousCpuSample) {
    const elapsedMicros = Math.max(1, (now - previousCpuSample.now) * 1000);
    const deltaMicros = Math.max(0, totalMicros - previousCpuSample.totalMicros);
    cpuLoadPct = (deltaMicros / (elapsedMicros * parallelism)) * 100;
  } else {
    const uptimeMicros = Math.max(1, process.uptime() * 1_000_000);
    cpuLoadPct = (totalMicros / (uptimeMicros * parallelism)) * 100;
  }

  previousCpuSample = { now, totalMicros };

  const memory = process.memoryUsage();
  const memoryLimitBytes = constrainedMemoryBytes();
  const memoryUsedBytes = memory.rss;

  return {
    sampledAt: new Date(now).toISOString(),
    cpuLoadPct: Math.max(0, Math.min(100, Number(cpuLoadPct.toFixed(2)))),
    memoryUsedBytes,
    memoryLimitBytes,
    memoryLoadPct: memoryLimitBytes > 0
      ? Number(((memoryUsedBytes / memoryLimitBytes) * 100).toFixed(2))
      : 0,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    uptimeSeconds: Math.floor(process.uptime()),
    onlineWindowMinutes: ONLINE_WINDOW_MINUTES,
  };
}

export async function ensureAdminTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_metric_snapshots (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      cpu_load_pct NUMERIC NOT NULL DEFAULT 0,
      memory_used_bytes BIGINT NOT NULL DEFAULT 0,
      memory_limit_bytes BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_metric_snapshots_created ON admin_metric_snapshots(created_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_activity (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT,
      user_email TEXT NOT NULL,
      session_id TEXT NOT NULL,
      path TEXT,
      user_agent TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_email, session_id)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_activity_last_seen ON user_activity(last_seen_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_activity_email_last_seen ON user_activity(user_email, last_seen_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_broadcasts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'all',
      category TEXT NOT NULL DEFAULT 'notification',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled', 'canceled')),
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_status_created ON admin_broadcasts(status, created_date DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_messages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      broadcast_id TEXT REFERENCES admin_broadcasts(id) ON DELETE SET NULL,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'notification',
      read_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_date TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_messages_user_created ON user_messages(user_email, created_date DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_messages_user_unread ON user_messages(user_email, read_at) WHERE read_at IS NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS broadcast_schedules (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'all',
      category TEXT NOT NULL DEFAULT 'notification',
      cadence TEXT NOT NULL DEFAULT 'once' CHECK (cadence IN ('once', 'daily', 'weekly', 'subscription_expiring')),
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled')),
      next_run_at TIMESTAMPTZ,
      last_run_at TIMESTAMPTZ,
      created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_broadcast_schedules_due ON broadcast_schedules(status, next_run_at)');
}

async function readScalarMetrics(pool) {
  const result = await pool.query(`
    WITH paid_accounts AS (
      SELECT DISTINCT us.user_email, us.status, us.start_date, us.end_date
      FROM user_subscriptions us
      JOIN subscriptions s ON s.id = us.subscription_id
      WHERE COALESCE(s.price_monthly, 0) > 0 OR COALESCE(s.price_annual, 0) > 0
    )
    SELECT
      pg_database_size(current_database())::bigint AS database_bytes,
      (SELECT count(*)::int FROM app_users) AS registered_users,
      (SELECT count(DISTINCT user_email)::int
         FROM user_activity
        WHERE last_seen_at >= now() - ($1::int * interval '1 minute')) AS online_users,
      (SELECT count(DISTINCT user_email)::int
         FROM user_activity
        WHERE last_seen_at >= date_trunc('day', now())) AS visits_today,
      (SELECT count(DISTINCT user_email)::int
         FROM user_activity
        WHERE last_seen_at >= now() - interval '7 days') AS visits_week,
      (SELECT count(DISTINCT user_email)::int
         FROM user_activity
        WHERE last_seen_at >= now() - interval '30 days') AS visits_month,
      (SELECT count(*)::int FROM user_subscriptions) AS paid_accounts_total_records,
      (SELECT count(DISTINCT user_email)::int FROM paid_accounts) AS paid_accounts_total,
      (SELECT count(DISTINCT user_email)::int
         FROM paid_accounts
        WHERE status = 'active'
          AND (start_date IS NULL OR start_date <= current_date)
          AND (end_date IS NULL OR end_date >= current_date)) AS paid_accounts_active,
      (SELECT count(*)::int FROM products) AS products_total,
      (SELECT count(*)::int
         FROM clients
        WHERE NULLIF(trim(COALESCE(wb_api_token, '')), '') IS NOT NULL
           OR NULLIF(trim(COALESCE(wb_api_token_ads, '')), '') IS NOT NULL) AS accounts_with_tokens,
      (SELECT count(*)::int FROM wb_jobs WHERE status = 'queued') AS wb_jobs_queued,
      (SELECT count(*)::int FROM wb_jobs WHERE status = 'running') AS wb_jobs_running,
      (SELECT count(*)::int FROM wb_jobs WHERE status = 'failed') AS wb_jobs_failed,
      (SELECT count(*)::int FROM wb_jobs WHERE status = 'done') AS wb_jobs_done
  `, [ONLINE_WINDOW_MINUTES]);

  return result.rows[0] || {};
}

async function readMaxLoad(pool) {
  const result = await pool.query(`
    SELECT
      cpu_load_pct,
      memory_used_bytes,
      memory_limit_bytes,
      created_at
    FROM admin_metric_snapshots
    ORDER BY cpu_load_pct DESC, created_at DESC
    LIMIT 1
  `);
  const row = result.rows[0];
  if (!row) {
    return {
      cpuLoadPct: 0,
      memoryLoadPct: 0,
      memoryUsedBytes: 0,
      recordedAt: null,
    };
  }

  const memoryUsedBytes = toNumber(row.memory_used_bytes);
  const memoryLimitBytes = toNumber(row.memory_limit_bytes);
  return {
    cpuLoadPct: toNumber(row.cpu_load_pct),
    memoryLoadPct: memoryLimitBytes > 0
      ? Number(((memoryUsedBytes / memoryLimitBytes) * 100).toFixed(2))
      : 0,
    memoryUsedBytes,
    recordedAt: row.created_at,
  };
}

async function readBullQueueCounts(jobQueue) {
  if (!jobQueue?.getJobCounts) {
    return {
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: 0,
      unavailable: true,
    };
  }

  try {
    const counts = await jobQueue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused');
    return {
      waiting: toNumber(counts.waiting),
      active: toNumber(counts.active),
      delayed: toNumber(counts.delayed),
      failed: toNumber(counts.failed),
      completed: toNumber(counts.completed),
      paused: toNumber(counts.paused),
      unavailable: false,
    };
  } catch (error) {
    return {
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: 0,
      unavailable: true,
      error: error?.message || 'Queue metrics unavailable',
    };
  }
}

export async function getAdminMetrics(pool, jobQueue) {
  const system = collectProcessLoad();
  await pool.query(
    `INSERT INTO admin_metric_snapshots (cpu_load_pct, memory_used_bytes, memory_limit_bytes)
     VALUES ($1, $2, $3)`,
    [system.cpuLoadPct, system.memoryUsedBytes, system.memoryLimitBytes],
  );
  await pool.query("DELETE FROM admin_metric_snapshots WHERE created_at < now() - interval '90 days'");

  const [db, maxLoad, bullQueue] = await Promise.all([
    readScalarMetrics(pool),
    readMaxLoad(pool),
    readBullQueueCounts(jobQueue),
  ]);

  return {
    sampledAt: system.sampledAt,
    system,
    database: {
      sizeBytes: toNumber(db.database_bytes),
    },
    users: {
      registered: toNumber(db.registered_users),
      online: toNumber(db.online_users),
    },
    subscriptions: {
      paidTotal: toNumber(db.paid_accounts_total),
      paidActive: toNumber(db.paid_accounts_active),
      paidRecordsTotal: toNumber(db.paid_accounts_total_records),
    },
    products: {
      total: toNumber(db.products_total),
      accountsWithTokens: toNumber(db.accounts_with_tokens),
    },
    collectionQueue: {
      queued: toNumber(db.wb_jobs_queued),
      running: toNumber(db.wb_jobs_running),
      failed: toNumber(db.wb_jobs_failed),
      done: toNumber(db.wb_jobs_done),
      bull: bullQueue,
    },
    traffic: {
      today: toNumber(db.visits_today),
      week: toNumber(db.visits_week),
      month: toNumber(db.visits_month),
      onlineWindowMinutes: ONLINE_WINDOW_MINUTES,
    },
    maxLoad,
  };
}

export async function recordUserActivity(pool, auth, payload = {}, headers = {}) {
  const userEmail = auth?.email;
  if (!userEmail) {
    const error = new Error('Authenticated user email is required');
    error.status = 400;
    throw error;
  }

  const sessionId = String(payload.session_id || payload.sessionId || DEFAULT_ACTIVITY_SESSION_ID).slice(0, 120);
  const path = String(payload.path || '/').slice(0, 500);
  const userAgent = String(headers['user-agent'] || '').slice(0, 500);

  const result = await pool.query(
    `INSERT INTO user_activity (user_id, user_email, session_id, path, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_email, session_id) DO UPDATE SET
       path = EXCLUDED.path,
       user_agent = EXCLUDED.user_agent,
       last_seen_at = now(),
       updated_date = now()
     RETURNING user_email, session_id, path, last_seen_at`,
    [auth.sub || null, userEmail, sessionId, path, userAgent],
  );

  return result.rows[0];
}

function customEmailList(filters) {
  const emails = Array.isArray(filters.emails) ? filters.emails : [];
  return emails
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean);
}

export async function getBroadcastRecipients(pool, audience, filters = {}) {
  const normalizedAudience = normalizeAudience(audience);
  const emails = customEmailList(filters);
  if (emails.length > 0) {
    const result = await pool.query(
      `SELECT DISTINCT email FROM app_users WHERE lower(email) = ANY($1::text[]) ORDER BY email`,
      [emails],
    );
    return result.rows.map((row) => row.email);
  }

  if (normalizedAudience === 'admins') {
    const result = await pool.query("SELECT email FROM app_users WHERE role = 'admin' ORDER BY email");
    return result.rows.map((row) => row.email);
  }

  if (normalizedAudience === 'active_subscribers') {
    const result = await pool.query(`
      SELECT DISTINCT user_email AS email
      FROM user_subscriptions
      WHERE status = 'active'
        AND (start_date IS NULL OR start_date <= current_date)
        AND (end_date IS NULL OR end_date >= current_date)
      ORDER BY user_email
    `);
    return result.rows.map((row) => row.email);
  }

  if (normalizedAudience === 'paid_accounts') {
    const result = await pool.query(`
      SELECT DISTINCT us.user_email AS email
      FROM user_subscriptions us
      JOIN subscriptions s ON s.id = us.subscription_id
      WHERE (COALESCE(s.price_monthly, 0) > 0 OR COALESCE(s.price_annual, 0) > 0)
        AND us.status = 'active'
        AND (us.start_date IS NULL OR us.start_date <= current_date)
        AND (us.end_date IS NULL OR us.end_date >= current_date)
      ORDER BY us.user_email
    `);
    return result.rows.map((row) => row.email);
  }

  const result = await pool.query('SELECT email FROM app_users ORDER BY email');
  return result.rows.map((row) => row.email);
}

export async function getSubscriptionExpiringRecipients(pool, filters = {}) {
  const days = Math.max(1, Math.min(60, toPositiveInt(filters.expiring_in_days ?? filters.expiringInDays, 3)));
  const result = await pool.query(
    `SELECT DISTINCT user_email AS email
     FROM user_subscriptions
     WHERE status = 'active'
       AND end_date IS NOT NULL
       AND end_date BETWEEN current_date AND current_date + ($1::int * interval '1 day')
     ORDER BY user_email`,
    [days],
  );
  return result.rows.map((row) => row.email);
}

async function insertMessages(pool, recipients, message) {
  if (!recipients.length) return 0;
  const params = [];
  const values = recipients.map((email, index) => {
    const base = index * 5;
    params.push(message.broadcastId || null, email, message.title, message.body, message.category);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });

  const result = await pool.query(
    `INSERT INTO user_messages (broadcast_id, user_email, title, body, category)
     VALUES ${values.join(', ')}`,
    params,
  );
  return result.rowCount || recipients.length;
}

export async function createBroadcast(pool, payload = {}, auth = {}) {
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!title || !body) {
    const error = new Error('Broadcast title and body are required');
    error.status = 400;
    throw error;
  }

  const audience = normalizeAudience(payload.audience);
  const category = normalizeCategory(payload.category);
  const filters = normalizeFilters(payload.filters);
  const status = payload.scheduled_at || payload.scheduledAt ? 'scheduled' : 'draft';

  const result = await pool.query(
    `INSERT INTO admin_broadcasts (title, body, audience, category, status, filters, scheduled_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING *`,
    [
      title,
      body,
      audience,
      category,
      status,
      JSON.stringify(filters),
      payload.scheduled_at || payload.scheduledAt || null,
      auth.email || null,
    ],
  );

  return result.rows[0];
}

export async function sendBroadcast(pool, broadcastId) {
  const broadcastResult = await pool.query('SELECT * FROM admin_broadcasts WHERE id = $1', [broadcastId]);
  const broadcast = broadcastResult.rows[0];
  if (!broadcast) {
    const error = new Error('Broadcast not found');
    error.status = 404;
    throw error;
  }

  const filters = normalizeFilters(broadcast.filters);
  const recipients = await getBroadcastRecipients(pool, broadcast.audience, filters);
  const delivered = await insertMessages(pool, recipients, {
    broadcastId: broadcast.id,
    title: broadcast.title,
    body: broadcast.body,
    category: normalizeCategory(broadcast.category),
  });

  const updated = await pool.query(
    `UPDATE admin_broadcasts
        SET status = 'sent',
            sent_at = now(),
            updated_date = now()
      WHERE id = $1
      RETURNING *`,
    [broadcast.id],
  );

  return {
    broadcast: updated.rows[0],
    recipients: recipients.length,
    delivered,
  };
}

export async function listBroadcasts(pool, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  const result = await pool.query(
    `SELECT * FROM admin_broadcasts ORDER BY created_date DESC LIMIT $1`,
    [safeLimit],
  );
  return result.rows;
}

export async function createBroadcastSchedule(pool, payload = {}, auth = {}) {
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!title || !body) {
    const error = new Error('Schedule title and body are required');
    error.status = 400;
    throw error;
  }

  const cadence = normalizeCadence(payload.cadence);
  const audience = cadence === 'subscription_expiring'
    ? 'active_subscribers'
    : normalizeAudience(payload.audience);
  const category = normalizeCategory(payload.category || (cadence === 'subscription_expiring' ? 'reminder' : 'notification'));
  const nextRunAt = payload.next_run_at || payload.nextRunAt || new Date().toISOString();
  const filters = normalizeFilters(payload.filters);

  const result = await pool.query(
    `INSERT INTO broadcast_schedules (title, body, audience, category, cadence, filters, next_run_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING *`,
    [title, body, audience, category, cadence, JSON.stringify(filters), nextRunAt, auth.email || null],
  );

  return result.rows[0];
}

export async function listBroadcastSchedules(pool, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  const result = await pool.query(
    `SELECT * FROM broadcast_schedules ORDER BY created_date DESC LIMIT $1`,
    [safeLimit],
  );
  return result.rows;
}

function nextRunForCadence(cadence, fromDate = new Date()) {
  const date = new Date(fromDate);
  if (cadence === 'daily' || cadence === 'subscription_expiring') {
    date.setDate(date.getDate() + 1);
    return date.toISOString();
  }
  if (cadence === 'weekly') {
    date.setDate(date.getDate() + 7);
    return date.toISOString();
  }
  return null;
}

export async function runBroadcastSchedule(pool, scheduleId) {
  const result = await pool.query('SELECT * FROM broadcast_schedules WHERE id = $1', [scheduleId]);
  const schedule = result.rows[0];
  if (!schedule) {
    const error = new Error('Broadcast schedule not found');
    error.status = 404;
    throw error;
  }
  if (schedule.status !== 'active') {
    return { schedule, recipients: 0, delivered: 0, skipped: true };
  }

  const filters = normalizeFilters(schedule.filters);
  const recipients = schedule.cadence === 'subscription_expiring'
    ? await getSubscriptionExpiringRecipients(pool, filters)
    : await getBroadcastRecipients(pool, schedule.audience, filters);

  const broadcast = await createBroadcast(pool, {
    title: schedule.title,
    body: schedule.body,
    audience: schedule.audience,
    category: schedule.category,
    filters,
  }, { email: schedule.created_by });

  const delivered = await insertMessages(pool, recipients, {
    broadcastId: broadcast.id,
    title: schedule.title,
    body: schedule.body,
    category: normalizeCategory(schedule.category),
  });

  await pool.query(
    `UPDATE admin_broadcasts
        SET status = 'sent',
            sent_at = now(),
            updated_date = now()
      WHERE id = $1`,
    [broadcast.id],
  );

  const nextRunAt = nextRunForCadence(schedule.cadence);
  const nextStatus = nextRunAt ? 'active' : 'paused';
  const updated = await pool.query(
    `UPDATE broadcast_schedules
        SET status = $2,
            last_run_at = now(),
            next_run_at = $3,
            updated_date = now()
      WHERE id = $1
      RETURNING *`,
    [schedule.id, nextStatus, nextRunAt],
  );

  return {
    schedule: updated.rows[0],
    broadcast,
    recipients: recipients.length,
    delivered,
    skipped: false,
  };
}

export async function processDueBroadcastSchedules(pool, now = new Date()) {
  const due = await pool.query(
    `SELECT id FROM broadcast_schedules
     WHERE status = 'active'
       AND next_run_at IS NOT NULL
       AND next_run_at <= $1
     ORDER BY next_run_at ASC
     LIMIT 25`,
    [now.toISOString()],
  );

  const results = [];
  for (const row of due.rows) {
    try {
      results.push(await runBroadcastSchedule(pool, row.id));
    } catch (error) {
      results.push({ id: row.id, error: error?.message || String(error) });
    }
  }
  return results;
}

export async function listUserMessages(pool, auth = {}, limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const result = await pool.query(
    `SELECT *
     FROM user_messages
     WHERE user_email = $1
     ORDER BY created_date DESC
     LIMIT $2`,
    [auth.email, safeLimit],
  );
  const unreadResult = await pool.query(
    `SELECT count(*)::int AS count
     FROM user_messages
     WHERE user_email = $1 AND read_at IS NULL`,
    [auth.email],
  );

  return {
    items: result.rows,
    unread: toNumber(unreadResult.rows[0]?.count),
  };
}

export async function markUserMessageRead(pool, auth = {}, messageId = randomUUID()) {
  const result = await pool.query(
    `UPDATE user_messages
        SET read_at = COALESCE(read_at, now())
      WHERE id = $1 AND user_email = $2
      RETURNING *`,
    [messageId, auth.email],
  );
  if (!result.rows[0]) {
    const error = new Error('Message not found');
    error.status = 404;
    throw error;
  }
  return result.rows[0];
}
