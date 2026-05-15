import dotenv from 'dotenv';
import { createJobWorker, jobQueue } from './queue.js';
import { getPool } from './db.js';
import { ensureAdminTables, processDueBroadcastSchedules } from './admin-service.js';
import { ensureSystemScheduledTaskTables, processDueSystemTasks } from './system-scheduled-tasks.js';
import { markWorkerStopped, recordWorkerHeartbeat } from './scheduler-service.js';
import {
  ensureWildberriesCollectionTables,
  processWbCollectProductJob,
} from './wildberries-repository.js';

dotenv.config();

/**
 * Пул соединений с базой данных
 * @type {import('pg').Pool}
 */
const pool = getPool();

// Инициализация таблиц
await ensureWildberriesCollectionTables(pool);
await ensureAdminTables(pool);
await ensureSystemScheduledTaskTables(pool);

/**
 * Отправляет heartbeat сигнал для воркера
 * @returns {Promise<void>}
 */
async function sendWorkerHeartbeat() {
  try {
    await recordWorkerHeartbeat(pool, {
      queueName: 'base44-jobs',
      metadata: {
        pid: process.pid,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  } catch (error) {
    console.error('[worker] heartbeat failed', error);
  }
}

/**
 * Запускает планировщик рассылок
 * @returns {Promise<void>}
 */
async function runBroadcastScheduler() {
  try {
    const results = await processDueBroadcastSchedules(pool);
    if (results.length > 0) {
      console.log(`[worker] processed ${results.length} broadcast schedule(s)`);
    }
  } catch (error) {
    console.error('[worker] broadcast scheduler failed', error);
  }
}

/**
 * Запускает планировщик системных задач
 * @returns {Promise<void>}
 */
async function runSystemTaskScheduler() {
  try {
    const results = await processDueSystemTasks(pool, { jobQueue });
    if (results.length > 0) {
      console.log(`[worker] processed ${results.length} system scheduled task(s)`);
    }
  } catch (error) {
    console.error('[worker] system task scheduler failed', error);
  }
}

/**
 * Воркер для обработки заданий из очереди
 * @type {import('bullmq').Worker}
 */
const worker = createJobWorker(async (job) => {
  console.log(`[worker] job ${job.name}`, job.data);

  switch (job.name) {
    case 'wb:collect:product':
      return await processWbCollectProductJob(pool, job);
    case 'sync-client':
      return { ok: true, entity: 'Client', id: job.data.id };
    case 'sync-project':
      return { ok: true, entity: 'Project', id: job.data.id };
    case 'sync-product':
      return { ok: true, entity: 'Product', id: job.data.id };
    default:
      return { ok: true, received: true };
  }
});

/**
 * Обработчик завершения задания
 */
worker.on('completed', (job) => {
  console.log(`[worker] completed ${job.name}#${job.id}`);
});

/**
 * Обработчик ошибки задания
 */
worker.on('failed', (job, err) => {
  console.error(`[worker] failed ${job?.name}#${job?.id}`, err);
});

// Планировщик рассылок
const broadcastSchedulerInterval = setInterval(
  runBroadcastScheduler,
  Number(process.env.BROADCAST_SCHEDULER_INTERVAL_MS || 60_000),
);
broadcastSchedulerInterval.unref();
await runBroadcastScheduler();

// Планировщик системных задач
const systemTaskSchedulerInterval = setInterval(
  runSystemTaskScheduler,
  Number(process.env.SYSTEM_TASK_INTERVAL_MS || 60_000),
);
systemTaskSchedulerInterval.unref();
await runSystemTaskScheduler();

// Heartbeat воркера
const workerHeartbeatInterval = setInterval(
  sendWorkerHeartbeat,
  Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 30_000),
);
workerHeartbeatInterval.unref();
await sendWorkerHeartbeat();

/**
 * Корректно останавливает воркер
 * @returns {Promise<void>}
 */
async function shutdownWorker() {
  clearInterval(broadcastSchedulerInterval);
  clearInterval(systemTaskSchedulerInterval);
  clearInterval(workerHeartbeatInterval);
  await markWorkerStopped(pool).catch(() => {});
  await worker.close();
  process.exit(0);
}

// Обработчики сигналов завершения
process.on('SIGINT', shutdownWorker);
process.on('SIGTERM', shutdownWorker);
