import assert from 'node:assert/strict';
import test from 'node:test';
import { openapi } from './swagger.js';
import {
  ensureSystemScheduledTaskTables,
  nextRunForCadence,
  processDueSystemTasks,
  runScheduledTask,
} from './system-scheduled-tasks.js';

const fixedNow = new Date('2026-05-13T12:00:00.000Z');
const fixedStartedAt = '2026-05-13T12:00:00.000Z';

function taskRow(id, status = 'running', error = null) {
  return {
    id,
    name: id,
    description: 'test task',
    cadence: id === 'wb-directories-sync' ? 'daily_02_00_utc' : 'hourly',
    status: 'active',
    next_run_at: '2026-05-13T13:00:00.000Z',
    last_run_at: fixedStartedAt,
    last_status: status,
    last_error: error,
    last_result: null,
    failure_count: error ? 1 : 0,
    locked_until: null,
  };
}

function runRow(values, patch = {}) {
  return {
    id: values[0],
    task_id: values[1],
    trigger: values[2],
    status: 'running',
    started_at: fixedStartedAt,
    created_by: values[3],
    ...patch,
  };
}

function parseMaybeJson(value) {
  if (!value) return null;
  return JSON.parse(value);
}

function createPool({ products = [], clients = [] } = {}) {
  const calls = [];
  const pool = {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('WITH due AS')) {
        return { rows: [{ id: 'wb-active-products-sync' }] };
      }
      if (sql.includes('UPDATE system_scheduled_tasks') && sql.includes("last_status = 'running'")) {
        return { rows: [taskRow(values[0])] };
      }
      if (sql.includes('SELECT * FROM system_scheduled_tasks WHERE id = $1')) {
        return { rows: [taskRow(values[0])] };
      }
      if (sql.includes('INSERT INTO system_task_runs')) {
        return { rows: [runRow(values)] };
      }
      if (sql.includes('FROM products p')) {
        assert.match(sql, /NOT EXISTS/);
        assert.match(sql, /j\.status IN \('queued', 'running'\)/);
        return { rows: products };
      }
      if (sql.includes('INSERT INTO wb_jobs')) {
        return {
          rows: [{
            id: values[0],
            status: 'queued',
            article: values[1],
            product_id: values[2],
            project_id: values[3],
            client_id: values[4],
            user_email: values[5],
            payload: parseMaybeJson(values[6]),
            progress: 0,
            attempts: 0,
            created_at: fixedStartedAt,
            updated_at: fixedStartedAt,
          }],
        };
      }
      if (sql.includes('FROM clients')) {
        return { rows: clients };
      }
      if (sql.includes('UPDATE system_task_runs')) {
        return {
          rows: [{
            id: values[0],
            task_id: 'task',
            trigger: 'manual',
            status: values[1],
            started_at: fixedStartedAt,
            finished_at: fixedStartedAt,
            duration_ms: 10,
            result: parseMaybeJson(values[2]),
            error: values[3],
          }],
        };
      }
      if (sql.includes('UPDATE system_scheduled_tasks')) {
        return { rows: [taskRow(values[0], values[1], values[2])] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return pool;
}

test('nextRunForCadence uses UTC daily and hourly cadences', () => {
  assert.equal(
    nextRunForCadence('daily_02_00_utc', new Date('2026-05-13T01:00:00.000Z')),
    '2026-05-13T02:00:00.000Z',
  );
  assert.equal(
    nextRunForCadence('daily_02_00_utc', new Date('2026-05-13T03:00:00.000Z')),
    '2026-05-14T02:00:00.000Z',
  );
  assert.equal(
    nextRunForCadence('hourly', fixedNow),
    '2026-05-13T13:00:00.000Z',
  );
});

test('ensureSystemScheduledTaskTables seeds the two backend tasks', async () => {
  const calls = [];
  const pool = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };

  await ensureSystemScheduledTaskTables(pool);

  const seedCalls = calls.filter((call) => call.sql.includes('INSERT INTO system_scheduled_tasks'));
  assert.deepEqual(seedCalls.map((call) => call.values[0]), [
    'wb-directories-sync',
    'wb-active-products-sync',
  ]);
  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS system_task_runs')));
});

test('manual active product run logs success and enqueues deduplicated jobs', async () => {
  const added = [];
  const pool = createPool({
    products: [{
      id: 'product-1',
      wb_sku: '12345',
      project_id: 'project-1',
      client_id: 'client-1',
      created_by: 'owner@example.test',
      last_synced_at: '2026-05-13T10:00:00.000Z',
    }],
  });

  const result = await runScheduledTask(pool, 'wb-active-products-sync', {
    now: fixedNow,
    actorEmail: 'admin@example.test',
    jobQueue: { add: async (...args) => added.push(args) },
  });

  assert.equal(result.ok, true);
  assert.equal(result.run.status, 'success');
  assert.equal(result.result.enqueued, 1);
  assert.equal(added.length, 1);
  assert.equal(added[0][0], 'wb:collect:product');
  assert.equal(added[0][1].product_id, 'product-1');
  assert.match(added[0][2].jobId, /^system-wb-product-/);
  assert.ok(pool.calls.some((call) => call.sql.includes('INSERT INTO system_task_runs')));
  assert.ok(pool.calls.some((call) => call.sql.includes('UPDATE system_task_runs')));
});

test('processDueSystemTasks locks due tasks before running them', async () => {
  const pool = createPool();
  const result = await processDueSystemTasks(pool, {
    now: fixedNow,
    jobQueue: { add: async () => {} },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].run.status, 'success');
  assert.match(pool.calls[0].sql, /FOR UPDATE SKIP LOCKED/);
  assert.equal(pool.calls[0].values[0], '2026-05-13T12:00:00.000Z');
  assert.equal(pool.calls[0].values[1], '2026-05-13T12:15:00.000Z');
});

test('directory sync records skipped when no shared or client token exists', async () => {
  const previous = {
    WB_SELLER_API_TOKEN: process.env.WB_SELLER_API_TOKEN,
    WILDBERRIES_SELLER_API_TOKEN: process.env.WILDBERRIES_SELLER_API_TOKEN,
    WB_API_TOKEN: process.env.WB_API_TOKEN,
  };
  delete process.env.WB_SELLER_API_TOKEN;
  delete process.env.WILDBERRIES_SELLER_API_TOKEN;
  delete process.env.WB_API_TOKEN;

  try {
    const result = await runScheduledTask(createPool(), 'wb-directories-sync', { now: fixedNow });
    assert.equal(result.ok, true);
    assert.equal(result.run.status, 'skipped');
    assert.match(result.result.reason, /Shared WB Seller API token is not configured/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('OpenAPI exposes system scheduled tasks and omits legacy ingestion receive', () => {
  assert.ok(openapi.paths['/admin/scheduled-tasks']);
  assert.ok(openapi.paths['/activity/sessions']);
  assert.equal(openapi.paths[`/functions/${'ingestion-receive'}`], undefined);
  assert.equal(openapi.paths[`/${'ingestion-receive'}`], undefined);
});
