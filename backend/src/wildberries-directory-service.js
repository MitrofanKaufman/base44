import {
  normalizeWbCommissionDirectory,
  normalizeWbLogisticsDirections,
  WbSellerApi,
} from './wildberries-seller-api.js';
import { PUBLIC_RECORD_OWNER } from './entity-access.js';
import { upsertMarketplaceCommissionDirectory } from './wildberries-repository.js';

export const SHARED_SELLER_TOKEN_ENV_KEYS = [
  'WB_SELLER_API_TOKEN',
  'WILDBERRIES_SELLER_API_TOKEN',
  'WB_API_TOKEN',
];

export const tokenMeta = (token) => {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return { hasToken: false };
  return {
    hasToken: true,
    last4: trimmed.slice(-4),
  };
};

export const getSharedSellerToken = () => {
  for (const key of SHARED_SELLER_TOKEN_ENV_KEYS) {
    const token = String(process.env[key] ?? '').trim();
    if (token) return token;
  }
  return '';
};

export async function upsertLogisticsDirection(pool, direction, createdBy) {
  const values = [
    direction.source,
    direction.direction_id,
    direction.direction_name,
    JSON.stringify(direction.tariffs || {}),
    JSON.stringify(direction.raw_data || {}),
    direction.synced_at,
  ];

  const updated = await pool.query(
    `UPDATE logistics_directories
       SET direction_name = $3,
           tariffs = $4::jsonb,
           raw_data = $5::jsonb,
           synced_at = $6::timestamptz,
           updated_date = now()
     WHERE source = $1 AND direction_id = $2
       AND created_by IS NOT DISTINCT FROM $7
     RETURNING id`,
    [...values, createdBy || null],
  );

  if (updated.rowCount > 0) return { inserted: false, updated: updated.rowCount };

  await pool.query(
    `INSERT INTO logistics_directories (
       source,
       direction_id,
       direction_name,
       tariffs,
       raw_data,
       synced_at,
       created_by
     ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::timestamptz, $7)`,
    [...values, createdBy || null],
  );

  return { inserted: true, updated: 0 };
}

export async function syncWbLogisticsDirections(pool, token, ownerEmail) {
  const timeoutMs = Number(process.env.WB_SELLER_API_TIMEOUT_MS || 15_000);
  const api = new WbSellerApi();
  const endpointCalls = [
    { key: 'marketplaceOffices', call: () => api.getMarketplaceOffices({ token, timeoutMs }) },
    { key: 'marketplaceWarehouses', call: () => api.getMarketplaceWarehouses({ token, timeoutMs }) },
    { key: 'suppliesWarehouses', call: () => api.getSuppliesWarehouses({ token, timeoutMs }) },
  ];
  const settled = await Promise.allSettled(
    endpointCalls.map(async (entry) => ({ key: entry.key, payload: await entry.call() })),
  );

  const payloads = [];
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      payloads.push(result.value);
      return;
    }
    errors.push({
      key: endpointCalls[index].key,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });

  if (payloads.length === 0) throw settled[0]?.reason || new Error('Wildberries sync failed');

  const syncedAt = new Date().toISOString();
  const directions = normalizeWbLogisticsDirections(payloads, { syncedAt });

  let inserted = 0;
  let updated = 0;
  for (const direction of directions) {
    const result = await upsertLogisticsDirection(pool, direction, ownerEmail);
    if (result.inserted) inserted += 1;
    updated += result.updated;
  }

  return {
    ok: true,
    source: 'wildberries',
    synced_at: syncedAt,
    count: directions.length,
    inserted,
    updated,
    errors,
    directions,
  };
}

export async function syncWbCommissionDirectory(pool, token, ownerEmail, locale = 'ru') {
  const timeoutMs = Number(process.env.WB_SELLER_API_TIMEOUT_MS || 15_000);
  const api = new WbSellerApi();
  const payload = await api.getCommissionRaw({
    token,
    timeoutMs,
    query: { locale },
  });
  const syncedAt = new Date().toISOString();
  const rows = normalizeWbCommissionDirectory(payload, { syncedAt });
  const saved = await upsertMarketplaceCommissionDirectory(pool, rows, ownerEmail);

  return {
    ok: true,
    source: 'wildberries',
    synced_at: syncedAt,
    count: saved.length,
    items: saved,
  };
}

export async function listActiveClientsWithWbToken(pool) {
  const result = await pool.query(
    `SELECT id, name, wb_api_token, created_by
       FROM clients
      WHERE status = 'active'
        AND NULLIF(trim(COALESCE(wb_api_token, '')), '') IS NOT NULL
      ORDER BY updated_date ASC`,
  );
  return result.rows;
}

export async function syncPublicWbDirectories(pool, locale = 'ru') {
  const token = getSharedSellerToken();
  if (!token) {
    return {
      skipped: true,
      reason: `Shared WB Seller API token is not configured (${SHARED_SELLER_TOKEN_ENV_KEYS.join(' or ')})`,
    };
  }

  const [logistics, commission] = await Promise.all([
    syncWbLogisticsDirections(pool, token, PUBLIC_RECORD_OWNER),
    syncWbCommissionDirectory(pool, token, PUBLIC_RECORD_OWNER, locale),
  ]);

  return {
    skipped: false,
    owner: PUBLIC_RECORD_OWNER,
    token: tokenMeta(token),
    logistics,
    commission,
  };
}

export async function syncSharedWbDirectories(pool, locale = 'ru') {
  return syncPublicWbDirectories(pool, locale);
}

export async function syncClientWbDirectories(pool, client, locale = 'ru') {
  const token = String(client?.wb_api_token ?? '').trim();
  if (!token) {
    return {
      skipped: true,
      client_id: client?.id,
      client_name: client?.name,
      reason: 'WB Seller API token is not configured for this client',
    };
  }

  const ownerEmail = client.created_by || null;
  const [logistics, commission] = await Promise.all([
    syncWbLogisticsDirections(pool, token, ownerEmail),
    syncWbCommissionDirectory(pool, token, ownerEmail, locale),
  ]);

  return {
    skipped: false,
    client_id: client.id,
    client_name: client.name,
    token: tokenMeta(token),
    logistics,
    commission,
  };
}
