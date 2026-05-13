import {
  createBroadcast,
  createBroadcastSchedule,
  getAdminMetrics,
  listBroadcasts,
  listBroadcastSchedules,
  listUserMessages,
  markUserMessageRead,
  recordUserActivity,
  runBroadcastSchedule,
  sendBroadcast,
} from './admin-service.js';

const route = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function registerAdminRoutes(app, pool, { requireAuth, requireRole, jobQueue }) {
  const requireAdmin = requireRole('admin');

  app.get('/admin/metrics', requireAuth, requireAdmin, route(async (_req, res) => {
    const metrics = await getAdminMetrics(pool, jobQueue);
    res.json(metrics);
  }));

  app.post('/activity/heartbeat', requireAuth, route(async (req, res) => {
    const activity = await recordUserActivity(pool, req.auth, req.body, req.headers);
    res.json({ ok: true, activity });
  }));

  app.get('/messages', requireAuth, route(async (req, res) => {
    const data = await listUserMessages(pool, req.auth, req.query.limit);
    res.json({ ok: true, ...data });
  }));

  app.post('/messages/:id/read', requireAuth, route(async (req, res) => {
    const message = await markUserMessageRead(pool, req.auth, req.params.id);
    res.json({ ok: true, message });
  }));

  app.get('/admin/broadcasts', requireAuth, requireAdmin, route(async (req, res) => {
    const items = await listBroadcasts(pool, req.query.limit);
    res.json({ ok: true, items });
  }));

  app.post('/admin/broadcasts', requireAuth, requireAdmin, route(async (req, res) => {
    const broadcast = await createBroadcast(pool, req.body, req.auth);
    if (req.body?.send_now || req.body?.sendNow) {
      const sent = await sendBroadcast(pool, broadcast.id);
      return res.status(201).json({ ok: true, ...sent });
    }
    return res.status(201).json({ ok: true, broadcast });
  }));

  app.post('/admin/broadcasts/:id/send', requireAuth, requireAdmin, route(async (req, res) => {
    const sent = await sendBroadcast(pool, req.params.id);
    res.json({ ok: true, ...sent });
  }));

  app.get('/admin/broadcast-schedules', requireAuth, requireAdmin, route(async (req, res) => {
    const items = await listBroadcastSchedules(pool, req.query.limit);
    res.json({ ok: true, items });
  }));

  app.post('/admin/broadcast-schedules', requireAuth, requireAdmin, route(async (req, res) => {
    const schedule = await createBroadcastSchedule(pool, req.body, req.auth);
    res.status(201).json({ ok: true, schedule });
  }));

  app.post('/admin/broadcast-schedules/:id/run', requireAuth, requireAdmin, route(async (req, res) => {
    const result = await runBroadcastSchedule(pool, req.params.id);
    res.json({ ok: true, ...result });
  }));
}
