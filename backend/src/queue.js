import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null
});

export const jobQueue = new Queue('base44-jobs', { connection });

export function createJobWorker(processor) {
  return new Worker('base44-jobs', processor, { connection });
}
