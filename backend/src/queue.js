import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null
});

export const QUEUE_NAME = 'base44-jobs';
export const WB_COLLECT_PRODUCT_JOB = 'wb:collect:product';

export const jobQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 60 * 60 },
    removeOnFail: false,
    attempts: 2,
    backoff: { type: 'exponential', delay: 1500 }
  }
});

export function createJobWorker(processor) {
  return new Worker(QUEUE_NAME, processor, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 3)
  });
}

export async function closeQueueResources() {
  await Promise.allSettled([
    jobQueue.close(),
    connection.quit().catch(() => connection.disconnect()),
  ]);
}
