import { WbSellerApiError } from './wildberries-seller-api.js';
import {
  assertOwnedReferences,
  getOwnedRecord,
  isAdminAuth,
  PUBLIC_RECORD_OWNER,
} from './entity-access.js';
import { jobQueue, WB_COLLECT_PRODUCT_JOB } from './queue.js';
import {
  collectWbProduct,
  mapWbCollectionToProductFields,
  WbCollectionError,
} from './wildberries-public-api.js';
import {
  createWbJobRecord,
  getWbJob,
  listWbJobs,
  markWbJobCanceled,
  saveWbCollectionResult,
} from './wildberries-repository.js';
import {
  getSharedSellerToken,
  SHARED_SELLER_TOKEN_ENV_KEYS,
  syncWbCommissionDirectory,
  syncWbLogisticsDirections,
  tokenMeta,
} from './wildberries-directory-service.js';

const getClient = async (pool, clientId, auth) => {
  return getOwnedRecord(pool, {
    table: 'clients',
    id: clientId,
    auth,
    ownerField: 'created_by',
    select: 'id, name, wb_api_token, created_by',
  });
};

const getProduct = async (pool, productId, auth) => {
  return getOwnedRecord(pool, {
    table: 'products',
    id: productId,
    auth,
    ownerField: 'created_by',
    select: 'id, wb_sku, project_id, client_id, created_by',
  });
};

const toClientError = (error) => {
  if (error instanceof WbSellerApiError) {
    return { status: error.status, message: error.message };
  }
  if (error instanceof WbCollectionError) {
    return { status: 404, message: error.message };
  }
  return { status: 500, message: 'Wildberries sync failed' };
};

const toPreviewResponse = (collection) => {
  const mapped = mapWbCollectionToProductFields(collection);
  return {
    ok: collection.ok,
    article: collection.article,
    nmId: collection.nmId,
    fetchedAt: collection.fetchedAt,
    product: collection.product,
    seller: collection.seller,
    endpoints: collection.endpoints,
    errors: collection.errors,
    partial: collection.partial,
    mapped,
    current_price: mapped.current_price,
    stock: mapped.stock,
    commission_pct: mapped.commission_pct,
    minimal_price: mapped.minimal_price,
  };
};

const syncMiddlewares = (requireAuth, syncRateLimiter) => (
  syncRateLimiter ? [requireAuth, syncRateLimiter] : [requireAuth]
);

export function registerWildberriesRoutes(app, pool, requireAuth, options = {}) {
  const syncAuth = syncMiddlewares(requireAuth, options.syncRateLimiter);

  app.get('/wildberries/products/:article/preview', requireAuth, async (req, res, next) => {
    try {
      const collection = await collectWbProduct(req.params.article, {
        query: req.query.query,
        timeoutMs: Number(req.query.timeout_ms || process.env.WB_FETCH_TIMEOUT_MS || 15_000),
      });
      return res.json(toPreviewResponse(collection));
    } catch (error) {
      const { status, message } = toClientError(error);
      if (status >= 500 && !(error instanceof WbCollectionError)) return next(error);
      return res.status(status).json({ error: message });
    }
  });

  app.post('/wildberries/products/:article/collect', ...syncAuth, async (req, res, next) => {
    try {
      const productId = req.body?.product_id ?? req.body?.productId;
      let productOwnerEmail = req.auth?.email;
      if (productId) {
        const product = await getProduct(pool, productId, req.auth);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        productOwnerEmail = product.created_by || req.auth?.email;
      }
      const collection = await collectWbProduct(req.params.article, {
        query: req.body?.query,
        timeoutMs: Number(req.body?.timeout_ms || req.body?.timeoutMs || process.env.WB_FETCH_TIMEOUT_MS || 15_000),
      });
      const persistence = req.body?.save === false
        ? null
        : await saveWbCollectionResult(
          pool,
          collection,
          {
            ...req.body,
            article: req.params.article,
            product_id: req.body?.product_id ?? req.body?.productId,
          },
          { userEmail: req.auth?.email, ownerEmail: productOwnerEmail },
        );
      return res.json({ ...toPreviewResponse(collection), persistence });
    } catch (error) {
      const { status, message } = toClientError(error);
      if (status >= 500 && !(error instanceof WbCollectionError)) return next(error);
      return res.status(status).json({ error: message });
    }
  });

  app.post('/wildberries/products/:productId/sync', ...syncAuth, async (req, res, next) => {
    try {
      const product = await getProduct(pool, req.params.productId, req.auth);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      const article = String(product.wb_sku || '').trim();
      if (!article) return res.status(400).json({ error: 'Product has no WB SKU' });

      const collection = await collectWbProduct(article, {
        query: req.body?.query,
        timeoutMs: Number(req.body?.timeout_ms || req.body?.timeoutMs || process.env.WB_FETCH_TIMEOUT_MS || 15_000),
      });
      const persistence = await saveWbCollectionResult(
        pool,
        collection,
        {
          ...req.body,
          article,
          product_id: product.id,
          project_id: product.project_id,
          client_id: product.client_id,
        },
        { userEmail: req.auth?.email, ownerEmail: product.created_by || req.auth?.email },
      );
      return res.json({ ...toPreviewResponse(collection), persistence });
    } catch (error) {
      const { status, message } = toClientError(error);
      if (status >= 500 && !(error instanceof WbCollectionError)) return next(error);
      return res.status(status).json({ error: message });
    }
  });

  app.post('/wildberries/jobs', ...syncAuth, async (req, res, next) => {
    try {
      const payload = {
        ...(req.body || {}),
        product_id: req.body?.product_id ?? req.body?.productId,
        project_id: req.body?.project_id ?? req.body?.projectId,
        client_id: req.body?.client_id ?? req.body?.clientId,
        user_email: req.auth?.email,
      };
      await assertOwnedReferences(pool, req.auth, payload);
      const jobRecord = await createWbJobRecord(pool, payload, req.auth?.email, undefined, req.auth);
      await jobQueue.add(
        WB_COLLECT_PRODUCT_JOB,
        {
          ...jobRecord.payload,
          jobRecordId: jobRecord.id,
          user_email: req.auth?.email,
        },
        {
          jobId: jobRecord.id,
          attempts: Math.max(1, Number(req.body?.attempts || process.env.WB_JOB_ATTEMPTS || 2)),
          removeOnComplete: { age: 24 * 60 * 60 },
          removeOnFail: false,
        },
      );
      return res.status(201).json({ ok: true, job: jobRecord });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/wildberries/jobs', requireAuth, async (req, res, next) => {
    try {
      const items = await listWbJobs(pool, req.query.limit || 100, req.auth);
      return res.json({ ok: true, items });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/wildberries/jobs/:id', requireAuth, async (req, res, next) => {
    try {
      const job = await getWbJob(pool, req.params.id, req.auth);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.json({ ok: true, job });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/wildberries/jobs/:id/cancel', requireAuth, async (req, res, next) => {
    try {
      const jobRecord = await getWbJob(pool, req.params.id, req.auth);
      if (!jobRecord) return res.status(404).json({ error: 'Job not found' });
      const bullJob = await jobQueue.getJob(req.params.id);
      if (bullJob) {
        await bullJob.discard();
        await bullJob.remove();
      }
      const job = await markWbJobCanceled(pool, req.params.id, req.auth);
      return res.json({ ok: Boolean(job), job });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/wildberries/clients/:clientId/seller-token', requireAuth, async (req, res, next) => {
    try {
      const client = await getClient(pool, req.params.clientId, req.auth);
      if (!client) return res.status(404).json({ error: 'Client not found' });
      return res.json(tokenMeta(client.wb_api_token));
    } catch (error) {
      return next(error);
    }
  });

  app.put('/wildberries/clients/:clientId/seller-token', requireAuth, async (req, res, next) => {
    try {
      const token = req.body?.token === null ? '' : String(req.body?.token ?? '').trim();
      const ownerClause = isAdminAuth(req.auth) ? '' : ' AND created_by = $3';
      const values = isAdminAuth(req.auth)
        ? [req.params.clientId, token || null]
        : [req.params.clientId, token || null, req.auth.email];
      const result = await pool.query(
        `UPDATE clients
            SET wb_api_token = $2,
                updated_date = now()
          WHERE id = $1${ownerClause}
          RETURNING wb_api_token`,
        values,
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
      return res.json(tokenMeta(result.rows[0].wb_api_token));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/wildberries/directories/logistics/sync', ...syncAuth, async (req, res, next) => {
    try {
      if (!isAdminAuth(req.auth)) return res.status(403).json({ error: 'Admin role is required' });
      const token = getSharedSellerToken();
      if (!token) {
        return res.status(400).json({
          error: `Shared WB Seller API token is not configured (${SHARED_SELLER_TOKEN_ENV_KEYS.join(' or ')})`,
        });
      }

      const result = await syncWbLogisticsDirections(pool, token, PUBLIC_RECORD_OWNER);
      return res.json({
        ...result,
        scope: 'public',
        owner: PUBLIC_RECORD_OWNER,
        token: tokenMeta(token),
      });
    } catch (error) {
      const { status, message } = toClientError(error);
      if (status >= 500 && !(error instanceof WbSellerApiError)) return next(error);
      return res.status(status).json({ error: message });
    }
  });

  app.post('/wildberries/directories/commission/sync', ...syncAuth, async (req, res, next) => {
    try {
      if (!isAdminAuth(req.auth)) return res.status(403).json({ error: 'Admin role is required' });
      const token = getSharedSellerToken();
      if (!token) {
        return res.status(400).json({
          error: `Shared WB Seller API token is not configured (${SHARED_SELLER_TOKEN_ENV_KEYS.join(' or ')})`,
        });
      }

      const result = await syncWbCommissionDirectory(
        pool,
        token,
        PUBLIC_RECORD_OWNER,
        req.body?.locale || req.query?.locale || 'ru',
      );
      return res.json({
        ...result,
        scope: 'public',
        owner: PUBLIC_RECORD_OWNER,
        token: tokenMeta(token),
      });
    } catch (error) {
      const { status, message } = toClientError(error);
      if (status >= 500 && !(error instanceof WbSellerApiError)) return next(error);
      return res.status(status).json({ error: message });
    }
  });

  app.post('/wildberries/clients/:clientId/logistics-directions/sync', ...syncAuth, async (req, res, next) => {
    try {
      const client = await getClient(pool, req.params.clientId, req.auth);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const token = String(client.wb_api_token ?? '').trim();
      if (!token) {
        return res.status(400).json({ error: 'WB Seller API token is not configured for this client' });
      }

      const ownerEmail = client.created_by || req.auth?.email;
      const result = await syncWbLogisticsDirections(pool, token, ownerEmail);

      return res.json({
        ...result,
        client_id: client.id,
        client_name: client.name,
        token: tokenMeta(token),
      });
    } catch (error) {
      const { status, message } = toClientError(error);
      if (status >= 500 && !(error instanceof WbSellerApiError)) return next(error);
      return res.status(status).json({ error: message });
    }
  });

  app.post('/wildberries/clients/:clientId/commission-directory/sync', ...syncAuth, async (req, res, next) => {
    try {
      const client = await getClient(pool, req.params.clientId, req.auth);
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const token = String(client.wb_api_token ?? '').trim();
      if (!token) {
        return res.status(400).json({ error: 'WB Seller API token is not configured for this client' });
      }

      const ownerEmail = client.created_by || req.auth?.email;
      const result = await syncWbCommissionDirectory(
        pool,
        token,
        ownerEmail,
        req.body?.locale || req.query?.locale || 'ru',
      );

      return res.json({
        ...result,
        client_id: client.id,
        client_name: client.name,
        token: tokenMeta(token),
      });
    } catch (error) {
      const { status, message } = toClientError(error);
      if (status >= 500 && !(error instanceof WbSellerApiError)) return next(error);
      return res.status(status).json({ error: message });
    }
  });
}
