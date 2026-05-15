import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperationalAlerts,
  processDueScheduledTasks,
  readWorkerHealth,
  recordWorkerHeartbeat,
  runScheduledTask,
} from './scheduler-service.js';

const fixedStartedAt = '2026-05-13T12:00:00.000Z';

function makeTaskRow(id, status, error = null) {
  return {
    id,
    name: id,
    description: 'test task',
    cadence: 'every_15_minutes',
    status: 'active',
    next_run_at: '2026-05-13T12:15:00.000Z',
    last_run_at: fixedStartedAt,
    last_status: status,
    last_error: error,
    last_error_at: error ? fixedStartedAt : null,
  };
}

test('runScheduledTask writes success sync log for a manual task run', async () => {
  const calls = [];
  const pool = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('INSERT INTO sync_logs')) {
        return {
          rows: [{
            id: 'log-1',
            task_id: values[0],
            task_name: values[1],
            status: 'running',
            started_at: fixedStartedAt,
            created_by: values[2],
          }],
        };
      }
      if (sql.includes('FROM products p')) {
        return { rows: [] };
      }
      if (sql.includes('UPDATE sync_logs')) {
        return {
          rows: [{
            id: values[0],
            task_id: 'wb-active-product-collection',
            task_name: 'WB active product collection',
            status: values[1],
            started_at: fixedStartedAt,
            finished_at: fixedStartedAt,
            duration_ms: 10,
            result: JSON.parse(values[2]),
            error: values[3],
            created_by: 'admin@example.test',
          }],
        };
      }
      if (sql.includes('UPDATE scheduled_tasks')) {
        return { rows: [makeTaskRow(values[0], values[1], values[2])] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const result = await runScheduledTask(pool, { add: async () => {} }, 'wb-active-product-collection', {
    actorEmail: 'admin@example.test',
  });

  assert.equal(result.ok, true);
  assert.equal(result.log.status, 'success');
  assert.equal(result.log.created_by, 'admin@example.test');
  assert.equal(result.result.enqueued, 0);
  assert.match(calls[0].sql, /INSERT INTO sync_logs/);
  assert.deepEqual(calls[0].values, [
    'wb-active-product-collection',
    'WB active product collection',
    'admin@example.test',
  ]);
  assert.match(calls.at(-1).sql, /locked_until = NULL/);
});

test('runScheduledTask records failed sync logs when execution fails', async () => {
  const calls = [];
  const pool = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('INSERT INTO sync_logs')) {
        return {
          rows: [{
            id: 'log-2',
            task_id: values[0],
            task_name: values[1],
            status: 'running',
            started_at: fixedStartedAt,
            created_by: values[2],
          }],
        };
      }
      if (sql.includes('FROM products p')) {
        throw new Error('database unavailable');
      }
      if (sql.includes('UPDATE sync_logs')) {
        return {
          rows: [{
            id: values[0],
            task_id: 'wb-active-product-collection',
            task_name: 'WB active product collection',
            status: values[1],
            started_at: fixedStartedAt,
            finished_at: fixedStartedAt,
            duration_ms: 10,
            result: values[2] ? JSON.parse(values[2]) : null,
            error: values[3],
          }],
        };
      }
      if (sql.includes('UPDATE scheduled_tasks')) {
        return { rows: [makeTaskRow(values[0], values[1], values[2])] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const result = await runScheduledTask(pool, null, 'wb-active-product-collection');

  assert.equal(result.ok, false);
  assert.equal(result.log.status, 'failed');
  assert.equal(result.log.error, 'database unavailable');
  assert.equal(result.task.last_status, 'failed');
  assert.equal(result.task.last_error, 'database unavailable');
});

test('processDueScheduledTasks claims due tasks before running them', async () => {
  const now = new Date('2026-05-13T12:00:00.000Z');
  const calls = [];
  const pool = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('WITH due AS')) {
        return { rows: [{ id: 'wb-active-product-collection' }] };
      }
      if (sql.includes('INSERT INTO sync_logs')) {
        return {
          rows: [{
            id: 'log-3',
            task_id: values[0],
            task_name: values[1],
            status: 'running',
            started_at: fixedStartedAt,
          }],
        };
      }
      if (sql.includes('FROM products p')) {
        return { rows: [] };
      }
      if (sql.includes('UPDATE sync_logs')) {
        return {
          rows: [{
            id: values[0],
            task_id: 'wb-active-product-collection',
            task_name: 'WB active product collection',
            status: values[1],
            started_at: fixedStartedAt,
            finished_at: fixedStartedAt,
            duration_ms: 10,
            result: JSON.parse(values[2]),
            error: values[3],
          }],
        };
      }
      if (sql.includes('UPDATE scheduled_tasks')) {
        return { rows: [makeTaskRow(values[0], values[1], values[2])] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const results = await processDueScheduledTasks(pool, { add: async () => {} }, now);

  assert.equal(results.length, 1);
  assert.equal(results[0].log.status, 'success');
  assert.match(calls[0].sql, /FOR UPDATE SKIP LOCKED/);
  assert.equal(calls[0].values[0], '2026-05-13T12:00:00.000Z');
  assert.equal(calls[0].values[1], '2026-05-13T12:15:00.000Z');
});

test('worker heartbeat health feeds operational alerts', async () => {
  const pool = {
    async query(sql, values = []) {
      if (sql.includes('INSERT INTO worker_heartbeats')) {
        return {
          rows: [{
            worker_id: values[0],
            process_id: values[1],
            queue_name: values[2],
            host_name: values[3],
            status: values[4],
            last_seen_at: fixedStartedAt,
            metadata: JSON.parse(values[5]),
          }],
        };
      }
      if (sql.includes('FROM worker_heartbeats')) {
        return {
          rows: [
            {
              worker_id: 'worker-fresh',
              process_id: 123,
              queue_name: 'base44-jobs',
              host_name: 'host-a',
              status: 'running',
              last_seen_at: '2026-05-13T12:00:00.000Z',
              metadata: {},
            },
            {
              worker_id: 'worker-stale',
              process_id: 124,
              queue_name: 'base44-jobs',
              host_name: 'host-b',
              status: 'stopped',
              last_seen_at: '2026-05-13T11:00:00.000Z',
              metadata: {},
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  const heartbeat = await recordWorkerHeartbeat(pool, {
    workerId: 'worker-fresh',
    processId: 123,
    queueName: 'base44-jobs',
    hostName: 'host-a',
    metadata: { pid: 123 },
  });
  const workers = await readWorkerHealth(pool, new Date('2026-05-13T12:00:30.000Z'));
  const alerts = buildOperationalAlerts({
    collectionQueue: {
      queued: 60,
      failed: 0,
      bull: { waiting: 0, delayed: 0, failed: 0, unavailable: false },
    },
    workers,
  });

  assert.equal(heartbeat.worker_id, 'worker-fresh');
  assert.equal(workers.active, 1);
  assert.equal(workers.stale, 1);
  assert.ok(alerts.some((alert) => alert.id === 'queue-backlog'));
  assert.ok(alerts.some((alert) => alert.id === 'worker-heartbeat-stale'));
});
