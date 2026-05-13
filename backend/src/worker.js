import dotenv from 'dotenv';
import { createJobWorker } from './queue.js';
import { getPool } from './db.js';
import { ensureAdminTables, processDueBroadcastSchedules } from './admin-service.js';
import {
  ensureWildberriesCollectionTables,
  processWbCollectProductJob,
} from './wildberries-repository.js';

dotenv.config();

const pool = getPool();
await ensureWildberriesCollectionTables(pool);
await ensureAdminTables(pool);

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

worker.on('completed', (job) => {
  console.log(`[worker] completed ${job.name}#${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] failed ${job?.name}#${job?.id}`, err);
});

const broadcastSchedulerInterval = setInterval(
  runBroadcastScheduler,
  Number(process.env.BROADCAST_SCHEDULER_INTERVAL_MS || 60_000),
);
broadcastSchedulerInterval.unref();
await runBroadcastScheduler();

process.on('SIGINT', async () => {
  clearInterval(broadcastSchedulerInterval);
  await worker.close();
  process.exit(0);
});
