import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { entityDefinitions } from './entity-definitions.js';
import { assertOwnedReferences, buildWhere, getOwnedRecord } from './entity-access.js';
import { getWbJob, listWbJobs, markWbJobCanceled, saveWbCollectionResult } from './wildberries-repository.js';

describe('entity access scoping', () => {
  it('scopes non-admin queries to records created by the current user', () => {
    const where = buildWhere(
      { status: 'active' },
      entityDefinitions.Client,
      { email: 'owner@example.test', role: 'user' },
    );

    assert.equal(where.sql, 'WHERE status = $1 AND created_by = $2');
    assert.deepEqual(where.values, ['active', 'owner@example.test']);
    assert.equal(where.filterCount, 1);
  });

  it('does not scope admin queries', () => {
    const where = buildWhere(
      { status: 'active' },
      entityDefinitions.Client,
      { email: 'admin@example.test', role: 'admin' },
    );

    assert.equal(where.sql, 'WHERE status = $1');
    assert.deepEqual(where.values, ['active']);
  });

  it('rejects references to records owned by another user', async () => {
    const calls = [];
    const pool = {
      async query(sql, values) {
        calls.push({ sql, values });
        return { rows: [] };
      },
    };

    await assert.rejects(
      () => assertOwnedReferences(
        pool,
        { email: 'owner@example.test', role: 'user' },
        { client_id: 'client-2' },
      ),
      /Forbidden reference: client_id/,
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /FROM clients/);
    assert.deepEqual(calls[0].values, ['client-2', 'owner@example.test']);
  });

  it('loads direct records through the owner boundary for non-admin users', async () => {
    const calls = [];
    const pool = {
      async query(sql, values) {
        calls.push({ sql, values });
        return { rows: [] };
      },
    };

    await getOwnedRecord(pool, {
      table: 'clients',
      id: 'client-1',
      auth: { email: 'owner@example.test', role: 'user' },
      select: 'id',
    });

    assert.match(calls[0].sql, /WHERE id = \$1 AND created_by = \$2/);
    assert.deepEqual(calls[0].values, ['client-1', 'owner@example.test']);
  });

  it('does not add an owner boundary for admin direct record loads', async () => {
    const calls = [];
    const pool = {
      async query(sql, values) {
        calls.push({ sql, values });
        return { rows: [] };
      },
    };

    await getOwnedRecord(pool, {
      table: 'clients',
      id: 'client-1',
      auth: { email: 'admin@example.test', role: 'admin' },
      select: 'id',
    });

    assert.match(calls[0].sql, /WHERE id = \$1 LIMIT 1/);
    assert.deepEqual(calls[0].values, ['client-1']);
  });

  it('scopes WB job list, read, and cancel operations by user_email', async () => {
    const calls = [];
    const pool = {
      async query(sql, values) {
        calls.push({ sql, values });
        return { rows: [] };
      },
    };
    const auth = { email: 'owner@example.test', role: 'user' };

    await listWbJobs(pool, 10, auth);
    await getWbJob(pool, 'job-1', auth);
    await markWbJobCanceled(pool, 'job-1', auth);

    assert.match(calls[0].sql, /FROM wb_jobs WHERE user_email = \$1/);
    assert.deepEqual(calls[0].values, ['owner@example.test', 10]);
    assert.match(calls[1].sql, /WHERE id = \$1 AND user_email = \$2/);
    assert.deepEqual(calls[1].values, ['job-1', 'owner@example.test']);
    assert.match(calls[2].sql, /AND user_email = \$2/);
    assert.deepEqual(calls[2].values, ['job-1', 'owner@example.test']);
  });

  it('persists WB price history under the collection owner', async () => {
    const calls = [];
    const pool = {
      async query(sql, values) {
        calls.push({ sql, values });
        return { rows: [], rowCount: 0 };
      },
    };

    await saveWbCollectionResult(
      pool,
      {
        article: '123',
        fetchedAt: Date.parse('2026-05-12T00:00:00.000Z'),
        product: { name: 'WB product', salePrice: 1000 },
        seller: {},
      },
      { product_id: 'product-1', article: '123' },
      { userEmail: 'actor@example.test', ownerEmail: 'owner@example.test' },
    );

    const priceHistoryCall = calls.find((call) => /INSERT INTO price_history/.test(call.sql));
    assert.ok(priceHistoryCall);
    assert.match(priceHistoryCall.sql, /created_by/);
    assert.deepEqual(priceHistoryCall.values, [
      'product-1',
      '2026-05-12T00:00:00.000Z',
      1000,
      'Wildberries collection',
      'owner@example.test',
    ]);
  });
});
