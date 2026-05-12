import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { entityDefinitions } from './entity-definitions.js';
import { assertOwnedReferences, buildWhere } from './entity-access.js';

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
});
