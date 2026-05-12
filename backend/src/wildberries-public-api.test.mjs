import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectWbProduct,
  mapWbCollectionToProductFields,
} from './wildberries-public-api.js';

test('collectWbProduct builds product profile from WB card and detail payloads', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalHosts = process.env.WB_BASKET_HOSTS;
  process.env.WB_BASKET_HOSTS = 'basket-01.wbbasket.ru';

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalHosts === undefined) {
      delete process.env.WB_BASKET_HOSTS;
    } else {
      process.env.WB_BASKET_HOSTS = originalHosts;
    }
  });

  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/info/ru/card.json')) {
      return new Response(JSON.stringify({
        nm_id: 123456,
        imt_id: 987,
        imt_name: 'Тестовый товар',
        vendor_code: 'vendor-123',
        subj_name: 'Дом',
        subj_root_name: 'Товары',
        description: 'Описание',
        media: { photo_count: 2, has_video: true },
        selling: {
          brand_name: 'Brand',
          supplier_id: 555,
          supplier_name: 'Seller',
        },
        options: [
          { name: 'Длина упаковки', value: '30' },
          { name: 'Ширина упаковки', value: '20' },
          { name: 'Высота упаковки', value: '10' },
          { name: 'Вес товара без упаковки (г)', value: '500' },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    if (target.includes('card.wb.ru/cards/v4/detail')) {
      return new Response(JSON.stringify({
        products: [{
          id: 123456,
          name: 'Тестовый товар',
          brand: 'Brand',
          priceU: 199900,
          salePriceU: 149900,
          rating: 4.7,
          feedbacks: 42,
          sizes: [{
            chrtId: 1,
            name: '0',
            price: { basic: 199900, product: 149900 },
            stocks: [
              { warehouseId: 10, qty: 3 },
              { warehouseId: 11, qty: 4 },
            ],
          }],
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  };

  const collection = await collectWbProduct('123456');
  const mapped = mapWbCollectionToProductFields(collection);

  assert.equal(collection.ok, true);
  assert.equal(collection.product.name, 'Тестовый товар');
  assert.equal(collection.product.supplierName, 'Seller');
  assert.equal(collection.product.stock, 7);
  assert.equal(mapped.current_price, 1499);
  assert.equal(mapped.price, 1999);
  assert.equal(mapped.sale_price, 1499);
  assert.equal(mapped.size_length_cm, 30);
  assert.equal(mapped.size_width_cm, 20);
  assert.equal(mapped.size_height_cm, 10);
  assert.equal(mapped.weight_kg, 0.5);
  assert.equal(mapped.image_url, 'https://basket-01.wbbasket.ru/vol1/part123/123456/images/big/1.webp');
});
