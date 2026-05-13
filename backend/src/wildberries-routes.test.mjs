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

test('public commission directory sync requires an admin user', async () => {
  const { app, routes } = createRouteHarness();
  const requireAuth = (_req, _res, next) => next();
  registerWildberriesRoutes(app, { query: async () => ({ rows: [] }) }, requireAuth);

  const handlers = routes.get('POST /wildberries/directories/commission/sync');
  const route = handlers[handlers.length - 1];
  const req = {
    auth: { email: 'owner@example.test', role: 'user' },
    params: {},
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

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: 'Admin role is required' });
});

test('public commission directory sync stores rows under the system owner', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.WB_SELLER_API_TOKEN;
  process.env.WB_SELLER_API_TOKEN = 'shared-token';
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, 'shared-token');
    return new Response(JSON.stringify({
      report: [
        {
          subjectID: 123,
          subjectName: 'Дом',
          kgvpMarketplace: 14.5,
        },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.WB_SELLER_API_TOKEN;
    } else {
      process.env.WB_SELLER_API_TOKEN = originalToken;
    }
  });

  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return {
        rows: [{
          id: 'row-1',
          source: 'wildberries',
          category_id: '123',
          category_name: 'Дом',
          created_by: 'system',
        }],
      };
    },
  };
  const { app, routes } = createRouteHarness();
  const requireAuth = (_req, _res, next) => next();
  registerWildberriesRoutes(app, pool, requireAuth);

  const handlers = routes.get('POST /wildberries/directories/commission/sync');
  const route = handlers[handlers.length - 1];
  const req = {
    auth: { email: 'admin@example.test', role: 'admin' },
    params: {},
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

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.scope, 'public');
  assert.equal(res.payload.owner, 'system');
  assert.equal(res.payload.count, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /created_by/);
  assert.equal(calls[0].values[9], 'system');
});
