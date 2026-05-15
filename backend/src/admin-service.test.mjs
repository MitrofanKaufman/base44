import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectProcessLoad,
  createActivitySession,
  getAdminMetrics,
  getBroadcastRecipients,
  recordBroadcastScheduleFailure,
  recordUserActivity,
} from './admin-service.js';

test('createActivitySession issues a server-owned session id', async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return {
        rows: [{
          session_id: values[0],
          user_email: values[2],
          path: values[3],
          created_at: '2026-05-13T12:00:00.000Z',
          last_seen_at: '2026-05-13T12:00:00.000Z',
          expires_at: '2026-05-14T12:00:00.000Z',
        }],
      };
    },
  };

  const session = await createActivitySession(
    pool,
    { sub: 'user-1', email: 'owner@example.test' },
    { path: '/admin' },
    { 'user-agent': 'node-test', 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
  );

  assert.equal(session.user_email, 'owner@example.test');
  assert.equal(session.sessionId, session.session_id);
  assert.ok(session.session_id);
  assert.match(calls[0].sql, /INSERT INTO activity_sessions/);
  assert.deepEqual(calls[0].values.slice(1, 6), ['user-1', 'owner@example.test', '/admin', 'node-test', '203.0.113.10']);
});

test('recordUserActivity upserts by authenticated user and session', async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes('FROM activity_sessions')) {
        return { rows: [{ session_id: values[1] }] };
      }
      if (sql.includes('UPDATE activity_sessions')) {
        return { rows: [], rowCount: 1 };
      }
      return {
        rows: [{
          user_email: values[1],
          session_id: values[2],
          path: values[3],
          last_seen_at: '2026-05-13T12:00:00.000Z',
        }],
      };
    },
  };

  const result = await recordUserActivity(
    pool,
    { sub: 'user-1', email: 'owner@example.test' },
    { sessionId: 'session-1', path: '/admin' },
    { 'user-agent': 'node-test' },
  );

  assert.equal(result.user_email, 'owner@example.test');
  assert.equal(result.session_id, 'session-1');
  assert.equal(result.path, '/admin');
  assert.match(calls[0].sql, /FROM activity_sessions/);
  assert.deepEqual(calls[0].values, ['owner@example.test', 'session-1']);
  assert.match(calls[1].sql, /UPDATE activity_sessions/);
  assert.match(calls[2].sql, /ON CONFLICT \(user_email, session_id\)/);
  assert.deepEqual(calls[2].values, ['user-1', 'owner@example.test', 'session-1', '/admin', 'node-test']);
});

test('recordUserActivity rejects an unknown activity session', async () => {
  const pool = {
    async query(sql) {
      assert.match(sql, /FROM activity_sessions/);
      return { rows: [] };
    },
  };

  await assert.rejects(
    () => recordUserActivity(
      pool,
      { sub: 'user-1', email: 'owner@example.test' },
      { sessionId: 'missing-session', path: '/admin' },
      {},
    ),
    (error) => error.status === 401 && /Unknown activity session/.test(error.message),
  );
});

test('getAdminMetrics aggregates database and queue counters', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('INSERT INTO admin_metric_snapshots')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM admin_metric_snapshots')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('pg_database_size')) {
        return {
          rows: [{
            database_bytes: '2048',
            registered_users: 12,
            online_users: 3,
            visits_today: 4,
            visits_week: 8,
            visits_month: 11,
            paid_accounts_total_records: 6,
            paid_accounts_total: 5,
            paid_accounts_active: 4,
            products_total: 42,
            accounts_with_tokens: 7,
            wb_jobs_queued: 2,
            wb_jobs_running: 1,
            wb_jobs_failed: 9,
            wb_jobs_done: 20,
          }],
        };
      }
      if (sql.includes('FROM admin_metric_snapshots')) {
        return {
          rows: [{
            cpu_load_pct: '88.5',
            memory_used_bytes: '1024',
            memory_limit_bytes: '4096',
            created_at: '2026-05-13T12:00:00.000Z',
          }],
        };
      }
      if (sql.includes('FROM worker_heartbeats')) {
        return {
          rows: [{
            worker_id: 'worker-1',
            process_id: 123,
            queue_name: 'base44-jobs',
            host_name: 'test-host',
            status: 'running',
            last_seen_at: new Date().toISOString(),
            metadata: { pid: 123 },
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const jobQueue = {
    async getJobCounts() {
      return { waiting: 2, active: 1, delayed: 3, failed: 4, completed: 5, paused: 0 };
    },
  };

  const metrics = await getAdminMetrics(pool, jobQueue);

  assert.equal(metrics.database.sizeBytes, 2048);
  assert.equal(metrics.users.registered, 12);
  assert.equal(metrics.users.online, 3);
  assert.equal(metrics.collectionQueue.queued, 2);
  assert.equal(metrics.collectionQueue.bull.delayed, 3);
  assert.equal(metrics.products.total, 42);
  assert.equal(metrics.products.accountsWithTokens, 7);
  assert.equal(metrics.traffic.month, 11);
  assert.equal(metrics.maxLoad.cpuLoadPct, 88.5);
  assert.equal(metrics.workers.active, 1);
  assert.ok(metrics.alerts.some((alert) => alert.id === 'queue-failed-jobs'));
});

test('recordBroadcastScheduleFailure backs off retries and pauses after five failures', async () => {
  const now = new Date('2026-05-13T12:00:00.000Z');
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT * FROM broadcast_schedules')) {
        return {
          rows: [{
            id: 'schedule-1',
            status: 'active',
            attempt_count: 2,
            failure_count: 4,
          }],
        };
      }
      if (sql.includes('UPDATE broadcast_schedules')) {
        return {
          rows: [{
            id: 'schedule-1',
            status: values[1],
            last_error: values[2],
            last_attempt_at: values[3],
            next_run_at: values[4],
          }],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const schedule = await recordBroadcastScheduleFailure(pool, 'schedule-1', new Error('delivery failed'), now);

  assert.equal(schedule.status, 'paused');
  assert.equal(schedule.last_error, 'delivery failed');
  assert.equal(schedule.next_run_at, null);
  assert.deepEqual(calls[1].values, [
    'schedule-1',
    'paused',
    'delivery failed',
    '2026-05-13T12:00:00.000Z',
    null,
  ]);
});

test('getBroadcastRecipients honors explicit email filters before audience filters', async () => {
  const queries = [];
  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      return { rows: [{ email: 'admin@example.test' }] };
    },
  };

  const recipients = await getBroadcastRecipients(pool, 'paid_accounts', {
    emails: ['ADMIN@example.test', ''],
  });

  assert.deepEqual(recipients, ['admin@example.test']);
  assert.match(queries[0].sql, /lower\(email\) = ANY/);
  assert.deepEqual(queries[0].values, [['admin@example.test']]);
});

test('collectProcessLoad does not expose unsigned sentinel memory limits', () => {
  const original = process.constrainedMemory;
  process.constrainedMemory = () => 18_446_744_073_709_552_000;
  try {
    const load = collectProcessLoad();
    assert.ok(load.memoryLimitBytes > 0);
    assert.ok(load.memoryLimitBytes < 9_223_372_036_854_775_807);
  } finally {
    process.constrainedMemory = original;
  }
});
