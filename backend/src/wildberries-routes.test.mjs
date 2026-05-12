import assert from 'node:assert/strict';
import { after } from 'node:test';
import test from 'node:test';

import { registerWildberriesRoutes } from './wildberries-routes.js';
import { closeQueueResources } from './queue.js';

after(async () => {
  await closeQueueResources();
});

function createRouteHarness() {
  const routes = new Map();
  const app = {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
    put(path, ...handlers) {
      routes.set(`PUT ${path}`, handlers);
    },
  };
  return { app, routes };
}

test('commission directory sync route looks up clients through owner scope', async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
  const { app, routes } = createRouteHarness();
  const requireAuth = (_req, _res, next) => next();
  registerWildberriesRoutes(app, pool, requireAuth);

  const handlers = routes.get('POST /wildberries/clients/:clientId/commission-directory/sync');
  const route = handlers[handlers.length - 1];
  const req = {
    auth: { email: 'owner@example.test', role: 'user' },
    params: { clientId: 'client-2' },
    body: {},
    query: {},
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await route(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 404);
  assert.match(calls[0].sql, /FROM clients WHERE id = \$1 AND created_by = \$2/);
  assert.deepEqual(calls[0].values, ['client-2', 'owner@example.test']);
});
