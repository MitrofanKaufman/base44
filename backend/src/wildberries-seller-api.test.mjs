import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeDirectoryPayload,
  normalizeWbCommissionDirectory,
  normalizeWbLogisticsDirections,
  WbSellerApi,
} from './wildberries-seller-api.js';

const okJson = (payload) => new Response(
  JSON.stringify(payload),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
);

test('WbSellerApi sends raw seller token to marketplace offices endpoint', async (t) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return okJson([{ id: 10, name: 'PVZ Moscow' }]);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const api = new WbSellerApi();
  await api.getMarketplaceOffices({ token: 'seller-token', timeoutMs: 1_000 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://marketplace-api.wildberries.ru/api/v3/offices');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Authorization, 'seller-token');
  assert.equal(calls[0].init.headers.Accept, 'application/json');
});

test('WbSellerApi maps WB rate limit to a 429 error', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('rate limit', { status: 429 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const api = new WbSellerApi();
  await assert.rejects(
    () => api.getMarketplaceWarehouses({ token: 'seller-token', timeoutMs: 1_000 }),
    /HTTP 429/,
  );
});

test('normalizeDirectoryPayload extracts rows from donor-compatible array keys', () => {
  const normalized = normalizeDirectoryPayload({
    response: {
      offices: [
        { id: 1, name: 'PVZ 1' },
        { id: 2, name: 'PVZ 2' },
      ],
    },
  });

  assert.equal(normalized.status, 'ok');
  assert.equal(normalized.rowCount, 2);
  assert.deepEqual(normalized.columns, ['id', 'name']);
});

test('normalizeWbLogisticsDirections creates current LogisticsDirectory records', () => {
  const directions = normalizeWbLogisticsDirections([
    {
      key: 'marketplaceOffices',
      payload: {
        offices: [
          {
            id: 101,
            name: 'ПВЗ Москва',
            address: 'Москва, Тверская 1',
            isActive: true,
          },
        ],
      },
    },
    {
      key: 'suppliesWarehouses',
      payload: [
        {
          ID: 202,
          warehouseName: 'Коледино',
          warehouseAddress: 'Московская область',
          allowUnload: true,
        },
      ],
    },
  ], { syncedAt: '2026-05-11T00:00:00.000Z' });

  assert.equal(directions.length, 2);
  assert.deepEqual(directions[0], {
    source: 'wildberries',
    direction_id: 'marketplaceOffices:101',
    direction_name: 'ПВЗ Москва',
    tariffs: {},
    raw_data: {
      id: 101,
      name: 'ПВЗ Москва',
      address: 'Москва, Тверская 1',
      isActive: true,
      wb_directory_key: 'marketplaceOffices',
      type: 'pvz',
      active: true,
      external_id: 101,
      lat: undefined,
      lng: undefined,
    },
    synced_at: '2026-05-11T00:00:00.000Z',
  });
  assert.equal(directions[1].direction_id, 'suppliesWarehouses:202');
  assert.equal(directions[1].direction_name, 'Коледино');
  assert.equal(directions[1].raw_data.type, 'warehouse');
});

test('normalizeWbCommissionDirectory maps WB commission report rows by fulfillment model', () => {
  const rows = normalizeWbCommissionDirectory({
    report: [
      {
        subjectID: 123,
        subjectName: 'Дом',
        parentID: 10,
        parentName: 'Товары для дома',
        kgvpMarketplace: 14.5,
        kgvpSupplier: '11,5',
        kgvpPickup: 7,
        kgvpBooking: 8,
        kgvpSupplierExpress: 18,
        paidStorageKgvp: 2,
      },
    ],
  }, { syncedAt: '2026-05-12T00:00:00.000Z' });

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    source: 'wildberries',
    category_id: '123',
    category_name: 'Дом',
    parent_category_id: '10',
    parent_category_name: 'Товары для дома',
    commission_pct: 14.5,
    commission_by_model: {
      kgvpMarketplace: 14.5,
      kgvpSupplier: 11.5,
      kgvpPickup: 7,
      kgvpBooking: 8,
      kgvpSupplierExpress: 18,
      paidStorageKgvp: 2,
    },
    raw_data: {
      subjectID: 123,
      subjectName: 'Дом',
      parentID: 10,
      parentName: 'Товары для дома',
      kgvpMarketplace: 14.5,
      kgvpSupplier: '11,5',
      kgvpPickup: 7,
      kgvpBooking: 8,
      kgvpSupplierExpress: 18,
      paidStorageKgvp: 2,
    },
    synced_at: '2026-05-12T00:00:00.000Z',
  });
});
