import { jobQueue } from './queue.js';

export function registerQueueRoutes(app, requireAuth) {
  app.post('/queue/enqueue', requireAuth, async (req, res) => {
    const { name = 'default', data = {} } = req.body || {};
    const job = await jobQueue.add(name, data, {
      removeOnComplete: true,
      removeOnFail: 50
    });
    res.status(201).json({ id: job.id, name: job.name, data: job.data });
  });
}
