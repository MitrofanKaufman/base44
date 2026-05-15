import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Соединение с Redis для BullMQ
 * @type {IORedis}
 */
const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null
});

/**
 * Имя очереди заданий
 * @constant {string}
 */
export const QUEUE_NAME = 'base44-jobs';

/**
 * Имя задания для сбора данных товара с Wildberries
 * @constant {string}
 */
export const WB_COLLECT_PRODUCT_JOB = 'wb:collect:product';

/**
 * Очередь заданий BullMQ
 * @type {Queue}
 */
export const jobQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 60 * 60 },
    removeOnFail: false,
    attempts: 2,
    backoff: { type: 'exponential', delay: 1500 }
  }
});

/**
 * Создает воркер для обработки заданий из очереди
 * @param {Function} processor - Функция-процессор для обработки заданий
 * @returns {Worker} Экземпляр воркера BullMQ
 */
export function createJobWorker(processor) {
  return new Worker(QUEUE_NAME, processor, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 3)
  });
}

/**
 * Закрывает ресурсы очереди и соединения с Redis
 * @returns {Promise<void>} Промис завершения закрытия ресурсов
 */
export async function closeQueueResources() {
  await Promise.allSettled([
    jobQueue.close(),
    connection.quit().catch(() => connection.disconnect()),
  ]);
}
