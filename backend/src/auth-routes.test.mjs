import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { registerAuthRoutes } from './auth-routes.js';

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
    patch(path, ...handlers) {
      routes.set(`PATCH ${path}`, handlers);
    },
  };
  return { app, routes };
}

function createResponse() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function getOnboardingRoute(routes) {
  const handlers = routes.get('PATCH /auth/me/onboarding');
  assert.ok(handlers, 'onboarding route is registered');
  return handlers[handlers.length - 1];
}

describe('auth onboarding routes', () => {
  it('stores calculator onboarding status and returns a safe user', async () => {
    const calls = [];
    const pool = {
      async query(sql, values) {
        calls.push({ sql, values });
        return {
          rows: [{
            id: 'user-1',
            email: 'owner@example.test',
            full_name: 'Owner',
            role: 'user',
            created_date: '2026-05-15T00:00:00.000Z',
            updated_date: '2026-05-15T00:01:00.000Z',
            created_by: 'owner@example.test',
            onboarding_state: {
              calculator_intro: {
                version: 1,
                status: 'completed',
                completed_at: '2026-05-15T00:01:00.000Z',
              },
            },
            password_hash: 'secret-hash',
          }],
        };
      },
    };
    const { app, routes } = createRouteHarness();
    registerAuthRoutes(app, pool);
    const route = getOnboardingRoute(routes);
    const res = createResponse();

    await route({
      auth: { sub: 'user-1', email: 'owner@example.test', role: 'user' },
      body: { tour_key: 'calculator_intro', version: 1, status: 'completed' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /jsonb_build_object/);
    assert.equal(calls[0].values[0], 'calculator_intro');
    assert.equal(JSON.parse(calls[0].values[1]).status, 'completed');
    assert.equal(calls[0].values[2], 'user-1');
    assert.equal(res.payload.password_hash, undefined);
    assert.deepEqual(res.payload.onboarding_state.calculator_intro.status, 'completed');
  });

  it('rejects unsupported onboarding tour keys', async () => {
    const pool = {
      async query() {
        throw new Error('query should not be called');
      },
    };
    const { app, routes } = createRouteHarness();
    registerAuthRoutes(app, pool);
    const route = getOnboardingRoute(routes);
    const res = createResponse();

    await route({
      auth: { sub: 'user-1' },
      body: { tour_key: 'unknown_tour', version: 1, status: 'completed' },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, 'invalid tour_key');
  });

  it('rejects unsupported onboarding statuses', async () => {
    const pool = {
      async query() {
        throw new Error('query should not be called');
      },
    };
    const { app, routes } = createRouteHarness();
    registerAuthRoutes(app, pool);
    const route = getOnboardingRoute(routes);
    const res = createResponse();

    await route({
      auth: { sub: 'user-1' },
      body: { tour_key: 'calculator_intro', version: 1, status: 'dismissed' },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, 'invalid status');
  });
});
