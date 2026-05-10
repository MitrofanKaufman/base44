import dotenv from 'dotenv';
import { createJobWorker } from './queue.js';

dotenv.config();

const worker = createJobWorker(async (job) => {
  console.log(`[worker] job ${job.name}`, job.data);

  switch (job.name) {
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

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
