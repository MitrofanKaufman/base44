import { createHash, randomUUID } from 'node:crypto';
import { appendOwnerAccess, isAdminAuth } from './entity-access.js';
import { collectWbProduct, mapWbCollectionToProductFields } from './wildberries-public-api.js';

const JOB_STATUSES = new Set(['queued', 'running', 'done', 'failed', 'canceled']);

const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const asString = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const asNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const json = (value) => JSON.stringify(value ?? {});

const safeJsonParse = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

const toIso = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
};

const payloadHash = (payload) => (
  createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex')
);

const normalizeStatus = (status) => {
  const normalized = String(status || 'queued').trim();
  return JOB_STATUSES.has(normalized) ? normalized : 'queued';
};

const normalizeJobRow = (row) => {
  if (!row) return null;
  const payload = safeJsonParse(row.payload, {});
  const result = row.result ? safeJsonParse(row.result, undefined) : undefined;
  return {
    id: row.id,
    type: 'wb:collect:product',
    status: normalizeStatus(row.status),
    progress: asNumber(row.progress) ?? 0,
    payload,
    result,
    attempts: asNumber(row.attempts) ?? 0,
    error: row.error || undefined,
    errorStage: row.error_stage || undefined,
    errorEndpoint: row.error_endpoint || undefined,
    errorCode: row.error_code || undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
  };
};

const pickPayloadArticle = (payload) => (
  asString(payload.article)
  || asString(payload.wb_sku)
  || asString(payload.sku)
);

export async function ensureWildberriesCollectionTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wb_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed', 'canceled')),
      article TEXT NOT NULL,
      product_id TEXT,
      project_id TEXT,
      client_id TEXT,
      user_email TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      progress NUMERIC DEFAULT 0,
      attempts NUMERIC DEFAULT 0,
      error TEXT,
      error_stage TEXT,
      error_endpoint TEXT,
      error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wb_jobs_status_updated ON wb_jobs(status, updated_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wb_jobs_article_updated ON wb_jobs(article, updated_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wb_jobs_user_updated ON wb_jobs(user_email, updated_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wb_raw (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      article TEXT NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL,
      data JSONB NOT NULL,
      user_email TEXT,
      created_date TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wb_raw_article_fetched ON wb_raw(article, fetched_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wb_raw_user_fetched ON wb_raw(user_email, fetched_at DESC)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_commission_directories (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      parent_category_id TEXT,
      parent_category_name TEXT,
      commission_pct NUMERIC,
      commission_by_model JSONB NOT NULL DEFAULT '{}'::jsonb,
      raw_data JSONB,
      synced_at TIMESTAMPTZ,
      created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_commission_owner_category
      ON marketplace_commission_directories(source, category_id, created_by)
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_marketplace_commission_category_name ON marketplace_commission_directories(source, lower(category_name))');
}

export async function resolveWbArticleForPayload(pool, payload, auth = {}) {
  const direct = pickPayloadArticle(payload);
  if (direct) return direct;

  const productId = asString(payload.product_id ?? payload.productId);
  if (!productId) return undefined;
  const where = appendOwnerAccess('WHERE id = $1', [productId], auth, 'created_by');
  const result = await pool.query(`SELECT wb_sku FROM products ${where.sql}`, where.values);
  return asString(result.rows[0]?.wb_sku);
}

export async function createWbJobRecord(pool, payload, userEmail, id = randomUUID(), auth = {}) {
  const article = await resolveWbArticleForPayload(pool, payload, auth);
  if (!article) throw new Error('WB article is required');
  const normalizedPayload = {
    ...payload,
    article,
    product_id: payload.product_id ?? payload.productId,
    project_id: payload.project_id ?? payload.projectId,
    client_id: payload.client_id ?? payload.clientId,
  };

  const result = await pool.query(
    `INSERT INTO wb_jobs (
       id, status, article, product_id, project_id, client_id, user_email, payload, progress, attempts
     ) VALUES ($1, 'queued', $2, $3, $4, $5, $6, $7::jsonb, 0, 0)
     ON CONFLICT (id) DO UPDATE SET
       status = 'queued',
       article = EXCLUDED.article,
       product_id = EXCLUDED.product_id,
       project_id = EXCLUDED.project_id,
       client_id = EXCLUDED.client_id,
       user_email = EXCLUDED.user_email,
       payload = EXCLUDED.payload,
       progress = 0,
       error = NULL,
       updated_at = now()
     RETURNING *`,
    [
      id,
      article,
      asString(normalizedPayload.product_id),
      asString(normalizedPayload.project_id),
      asString(normalizedPayload.client_id),
      userEmail || null,
      json(normalizedPayload),
    ],
  );

  return normalizeJobRow(result.rows[0]);
}

export async function listWbJobs(pool, limit = 100, auth = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  const where = appendOwnerAccess('', [], auth, 'user_email');
  const result = await pool.query(
    `SELECT * FROM wb_jobs ${where.sql} ORDER BY updated_at DESC LIMIT $${where.values.length + 1}`,
    [...where.values, safeLimit],
  );
  return result.rows.map(normalizeJobRow).filter(Boolean);
}

export async function getWbJob(pool, id, auth = {}) {
  const where = appendOwnerAccess('WHERE id = $1', [id], auth, 'user_email');
  const result = await pool.query(`SELECT * FROM wb_jobs ${where.sql}`, where.values);
  return normalizeJobRow(result.rows[0]);
}

export async function updateWbJobProgress(pool, id, progress, patch = {}) {
  const result = await pool.query(
    `UPDATE wb_jobs
        SET progress = $2,
            status = COALESCE($3, status),
            attempts = COALESCE($4, attempts),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      id,
      Math.max(0, Math.min(100, Number(progress || 0))),
      patch.status || null,
      Number.isFinite(Number(patch.attempts)) ? Number(patch.attempts) : null,
    ],
  );
  return normalizeJobRow(result.rows[0]);
}

export async function markWbJobRunning(pool, id, attempts) {
  const result = await pool.query(
    `UPDATE wb_jobs
        SET status = 'running',
            progress = GREATEST(progress, 5),
            attempts = $2,
            error = NULL,
            error_stage = NULL,
            error_endpoint = NULL,
            error_code = NULL,
            started_at = COALESCE(started_at, now()),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, attempts],
  );
  return normalizeJobRow(result.rows[0]);
}

export async function markWbJobDone(pool, id, resultPayload) {
  const result = await pool.query(
    `UPDATE wb_jobs
        SET status = 'done',
            progress = 100,
            result = $2::jsonb,
            error = NULL,
            finished_at = now(),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, json(resultPayload)],
  );
  return normalizeJobRow(result.rows[0]);
}

export async function markWbJobFailed(pool, id, error, patch = {}) {
  const result = await pool.query(
    `UPDATE wb_jobs
        SET status = 'failed',
            progress = 100,
            error = $2,
            error_stage = $3,
            error_endpoint = $4,
            error_code = $5,
            finished_at = now(),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      id,
      error?.message || String(error || 'Unknown error'),
      patch.errorStage || error?.stage || null,
      patch.errorEndpoint || error?.endpoint || null,
      patch.errorCode || error?.code || null,
    ],
  );
  return normalizeJobRow(result.rows[0]);
}

export async function markWbJobCanceled(pool, id, auth = {}) {
  const ownerSql = isAdminAuth(auth) ? '' : ' AND user_email = $2';
  const values = isAdminAuth(auth) ? [id] : [id, auth.email];
  const result = await pool.query(
    `UPDATE wb_jobs
        SET status = 'canceled',
            progress = 0,
            finished_at = now(),
            updated_at = now()
      WHERE id = $1 AND status IN ('queued', 'running')${ownerSql}
      RETURNING *`,
    values,
  );
  return normalizeJobRow(result.rows[0]);
}

const insertJsonRecord = async (pool, sql, values) => {
  try {
    await pool.query(sql, values);
  } catch (error) {
    console.error('[wildberries-persist]', error.message);
  }
};

const getProductPatch = (collection) => {
  const mapped = mapWbCollectionToProductFields(collection);
  const entries = {
    name: mapped.name,
    image_url: mapped.image_url,
    category: mapped.category,
    price: mapped.price,
    sale_price: mapped.sale_price,
    discount_pct: mapped.discount_pct,
    size_length_cm: mapped.size_length_cm,
    size_width_cm: mapped.size_width_cm,
    size_height_cm: mapped.size_height_cm,
    weight_kg: mapped.weight_kg,
    last_synced_at: new Date().toISOString(),
  };
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined && value !== null && value !== ''));
};

const updateProductFromCollection = async (pool, productId, collection, ownerEmail) => {
  if (!productId) return null;
  const patch = getProductPatch(collection);
  const entries = Object.entries(patch);
  if (!entries.length) return null;

  const sets = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);
  const ownerClause = ownerEmail ? ` AND created_by = $${values.length + 2}` : '';
  const result = await pool.query(
    `UPDATE products
        SET ${sets.join(', ')},
            updated_date = now()
      WHERE id = $1${ownerClause}
      RETURNING *`,
    ownerEmail ? [productId, ...values, ownerEmail] : [productId, ...values],
  );
  return result.rows[0] || null;
};

export async function saveWbCollectionResult(pool, collection, payload = {}, options = {}) {
  const userEmail = typeof options === 'string' ? options : options.userEmail;
  const ownerEmail = typeof options === 'object' ? options.ownerEmail : userEmail;
  const article = asString(collection.article) || asString(payload.article);
  const fetchedAt = new Date(asNumber(collection.fetchedAt) || Date.now());
  const product = asRecord(collection.product);
  const seller = asRecord(collection.seller);
  const productId = asString(payload.product_id ?? payload.productId);
  const framePayloadHash = payloadHash(collection);
  const traceId = asString(payload.trace_id ?? payload.traceId) || `wb-${article}-${fetchedAt.getTime()}`;

  await insertJsonRecord(
    pool,
    'INSERT INTO wb_raw (article, fetched_at, data, user_email) VALUES ($1, $2, $3::jsonb, $4)',
    [article, fetchedAt.toISOString(), json(collection), ownerEmail || userEmail || null],
  );

  await insertJsonRecord(
    pool,
    `INSERT INTO raw_marketplace_frames (
       source, stream, sourceeventid, payloadhash, emittedat, receivedat, traceid,
       payload, processingstatus, created_by
     ) VALUES ('wildberries', 'product', $1, $2, $3, $3, $4, $5::jsonb, 'processed', $6)`,
    [article, framePayloadHash, fetchedAt.toISOString(), traceId, json(collection), ownerEmail || userEmail || null],
  );

  await insertJsonRecord(
    pool,
    `INSERT INTO marketplace_events (
       schemaversion, type, source, sourceeventid, traceid, data, createdat, created_by
     ) VALUES ('1.0', 'product.update', 'wildberries', $1, $2, $3::jsonb, $4, $5)`,
    [article, traceId, json(collection), fetchedAt.toISOString(), ownerEmail || userEmail || null],
  );

  await insertJsonRecord(
    pool,
    `INSERT INTO product_snapshots (
       productid, source, externalid, name, sku, price, data, updatedat, created_by
     ) VALUES ($1, 'wildberries', $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      productId || article,
      article,
      asString(product.name),
      asString(product.vendorCode) || article,
      asNumber(product.salePrice) ?? asNumber(product.price),
      json(collection),
      fetchedAt.toISOString(),
      ownerEmail || userEmail || null,
    ],
  );

  if (seller.supplierId || seller.supplierName) {
    await insertJsonRecord(
      pool,
      `INSERT INTO seller_snapshots (
         sellerid, source, name, rating, data, updatedat, created_by
       ) VALUES ($1, 'wildberries', $2, $3, $4::jsonb, $5, $6)`,
      [
        asString(seller.supplierId) || asString(product.supplierId) || `seller-${article}`,
        asString(seller.supplierName) || asString(product.supplierName),
        asNumber(seller.rating),
        json(seller),
        fetchedAt.toISOString(),
        ownerEmail || userEmail || null,
      ],
    );
  }

  const updatedProduct = await updateProductFromCollection(pool, productId, collection, ownerEmail);
  if (productId && (asNumber(product.salePrice) ?? asNumber(product.price)) !== undefined) {
    await insertJsonRecord(
      pool,
      `INSERT INTO price_history (
         product_id, date, our_price, competitors, notes, created_by
       ) VALUES ($1, $2, $3, '[]'::jsonb, $4, $5)`,
      [
        productId,
        fetchedAt.toISOString(),
        asNumber(product.salePrice) ?? asNumber(product.price),
        'Wildberries collection',
        ownerEmail || userEmail || null,
      ],
    );
  }

  return {
    article,
    fetchedAt: fetchedAt.toISOString(),
    product: updatedProduct,
  };
}

export async function upsertMarketplaceCommissionDirectory(pool, rows, ownerEmail) {
  const synced = [];
  for (const row of rows) {
    const result = await pool.query(
      `INSERT INTO marketplace_commission_directories (
         source,
         category_id,
         category_name,
         parent_category_id,
         parent_category_name,
         commission_pct,
         commission_by_model,
         raw_data,
         synced_at,
         created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz, $10)
       ON CONFLICT (source, category_id, created_by) DO UPDATE SET
         category_name = EXCLUDED.category_name,
         parent_category_id = EXCLUDED.parent_category_id,
         parent_category_name = EXCLUDED.parent_category_name,
         commission_pct = EXCLUDED.commission_pct,
         commission_by_model = EXCLUDED.commission_by_model,
         raw_data = EXCLUDED.raw_data,
         synced_at = EXCLUDED.synced_at,
         updated_date = now()
       RETURNING *`,
      [
        row.source,
        row.category_id,
        row.category_name,
        row.parent_category_id || null,
        row.parent_category_name || null,
        asNumber(row.commission_pct) ?? null,
        json(row.commission_by_model),
        json(row.raw_data),
        row.synced_at,
        ownerEmail || null,
      ],
    );
    synced.push(result.rows[0]);
  }
  return synced;
}

export async function processWbCollectProductJob(pool, bullJob) {
  const payload = asRecord(bullJob.data);
  const jobId = asString(payload.jobRecordId) || String(bullJob.id);
  const article = await resolveWbArticleForPayload(pool, payload);
  if (!article) throw new Error('WB article is required');
  const userEmail = asString(payload.user_email ?? payload.userEmail);
  const attempts = Number(bullJob.attemptsMade || 0) + 1;

  await markWbJobRunning(pool, jobId, attempts);
  await bullJob.updateProgress({ percent: 5, stage: 'job:start' }).catch(() => {});

  try {
    const collection = await collectWbProduct(article, {
      query: payload.query,
      timeoutMs: payload.timeout_ms ?? payload.timeoutMs,
      onProgress: async (percent, stage, preview) => {
        await updateWbJobProgress(pool, jobId, percent, { status: 'running', attempts });
        await bullJob.updateProgress({ percent, stage, preview }).catch(() => {});
      },
    });

    const persistence = await saveWbCollectionResult(pool, collection, { ...payload, article }, userEmail);
    const result = { article, fetchedAt: collection.fetchedAt, data: collection, persistence };
    await markWbJobDone(pool, jobId, result);
    await bullJob.updateProgress({ percent: 100, stage: 'job:done' }).catch(() => {});
    return result;
  } catch (error) {
    await markWbJobFailed(pool, jobId, error);
    throw error;
  }
}
