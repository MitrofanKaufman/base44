import { createHash, randomUUID } from 'node:crypto';
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
}

export async function resolveWbArticleForPayload(pool, payload) {
  const direct = pickPayloadArticle(payload);
  if (direct) return direct;

  const productId = asString(payload.product_id ?? payload.productId);
  if (!productId) return undefined;
  const result = await pool.query('SELECT wb_sku FROM products WHERE id = $1', [productId]);
  return asString(result.rows[0]?.wb_sku);
}

export async function createWbJobRecord(pool, payload, userEmail, id = randomUUID()) {
  const article = await resolveWbArticleForPayload(pool, payload);
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

export async function listWbJobs(pool, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  const result = await pool.query(
    'SELECT * FROM wb_jobs ORDER BY updated_at DESC LIMIT $1',
    [safeLimit],
  );
  return result.rows.map(normalizeJobRow).filter(Boolean);
}

export async function getWbJob(pool, id) {
  const result = await pool.query('SELECT * FROM wb_jobs WHERE id = $1', [id]);
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

export async function markWbJobCanceled(pool, id) {
  const result = await pool.query(
    `UPDATE wb_jobs
        SET status = 'canceled',
            progress = 0,
            finished_at = now(),
            updated_at = now()
      WHERE id = $1 AND status IN ('queued', 'running')
      RETURNING *`,
    [id],
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

const updateProductFromCollection = async (pool, productId, collection) => {
  if (!productId) return null;
  const patch = getProductPatch(collection);
  const entries = Object.entries(patch);
  if (!entries.length) return null;

  const sets = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);
  const result = await pool.query(
    `UPDATE products
        SET ${sets.join(', ')},
            updated_date = now()
      WHERE id = $1
      RETURNING *`,
    [productId, ...values],
  );
  return result.rows[0] || null;
};

export async function saveWbCollectionResult(pool, collection, payload = {}, userEmail) {
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
    [article, fetchedAt.toISOString(), json(collection), userEmail || null],
  );

  await insertJsonRecord(
    pool,
    `INSERT INTO raw_marketplace_frames (
       source, stream, sourceeventid, payloadhash, emittedat, receivedat, traceid,
       payload, processingstatus, created_by
     ) VALUES ('wildberries', 'product', $1, $2, $3, $3, $4, $5::jsonb, 'processed', $6)`,
    [article, framePayloadHash, fetchedAt.toISOString(), traceId, json(collection), userEmail || null],
  );

  await insertJsonRecord(
    pool,
    `INSERT INTO marketplace_events (
       schemaversion, type, source, sourceeventid, traceid, data, createdat, created_by
     ) VALUES ('1.0', 'product.update', 'wildberries', $1, $2, $3::jsonb, $4, $5)`,
    [article, traceId, json(collection), fetchedAt.toISOString(), userEmail || null],
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
      userEmail || null,
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
        userEmail || null,
      ],
    );
  }

  const updatedProduct = await updateProductFromCollection(pool, productId, collection);
  if (productId && (asNumber(product.salePrice) ?? asNumber(product.price)) !== undefined) {
    await insertJsonRecord(
      pool,
      `INSERT INTO price_history (
         product_id, date, our_price, competitors, notes
       ) VALUES ($1, $2, $3, '[]'::jsonb, $4)`,
      [
        productId,
        fetchedAt.toISOString(),
        asNumber(product.salePrice) ?? asNumber(product.price),
        'Wildberries collection',
      ],
    );
  }

  return {
    article,
    fetchedAt: fetchedAt.toISOString(),
    product: updatedProduct,
  };
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
