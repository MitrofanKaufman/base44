import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import { getPool } from './db.js';
import { entityDefinitions } from './entity-definitions.js';
import { openapi } from './swagger.js';
import { registerQueueRoutes } from './queue-routes.js';
import { requireAuth, requireRole } from './auth.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerWildberriesRoutes } from './wildberries-routes.js';
import { ensureWildberriesCollectionTables } from './wildberries-repository.js';
import {
  assertOwnedReferences,
  buildWhere,
  sanitizeInput,
  toDbField,
} from './entity-access.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((v) => v.trim()) : true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

const pool = getPool();

const toApiRecord = (def, row) => {
  const out = {};
  for (const [apiField, meta] of Object.entries(def.fields)) {
    out[apiField] = row[meta.db];
  }
  return out;
};

const toDbValue = (def, apiField, value) => {
  const type = def.fields[apiField]?.schema?.type;
  if ((type === 'object' || type === 'array') && value !== null && value !== undefined) {
    return JSON.stringify(value);
  }
  return value;
};

const parseJsonParam = (value) => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const toSort = (sortBy, def) => {
  const raw = sortBy || 'updated_date';
  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  const dbField = toDbField(def, field) || 'updated_date';
  return `${dbField} ${desc ? 'DESC' : 'ASC'}`;
};

const registerEntity = (name, def) => {
  const base = `/entities/${name}`;
  const entityAuth = name === 'User' ? [requireAuth, requireRole('admin')] : [requireAuth];
  const route = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

  app.get(base, ...entityAuth, route(async (req, res) => {
    const q = parseJsonParam(req.query.q);
    const limit = Number(req.query.limit || 100);
    const skip = Number(req.query.skip || 0);
    const sortSql = toSort(req.query.sort_by || req.query.sort, def);
    const { sql, values } = buildWhere(q, def, req.auth);
    const query = `SELECT * FROM ${def.table} ${sql} ORDER BY ${sortSql} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const result = await pool.query(query, [...values, limit, skip]);
    res.json(result.rows.map((row) => toApiRecord(def, row)));
  }));

  app.post(base, ...entityAuth, route(async (req, res) => {
    const data = sanitizeInput(def, req.body);
    if (def.fields.created_by && req.auth?.email) data.created_by = req.auth.email;
    await assertOwnedReferences(pool, req.auth, data);
    const entries = Object.entries(data);
    if (!entries.length) return res.status(400).json({ error: 'empty payload' });
    const cols = entries.map(([k]) => toDbField(def, k));
    const vals = entries.map(([k, v]) => toDbValue(def, k, v));
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    const query = `INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await pool.query(query, vals);
    res.status(201).json(toApiRecord(def, result.rows[0]));
  }));

  app.post(`${base}/bulk`, ...entityAuth, route(async (req, res) => {
    const rows = Array.isArray(req.body) ? req.body : [];
    if (!rows.length) return res.status(400).json({ error: 'payload must be a non-empty array' });
    const created = [];
    for (const row of rows) {
      const data = sanitizeInput(def, row);
      if (def.fields.created_by && req.auth?.email) data.created_by = req.auth.email;
      await assertOwnedReferences(pool, req.auth, data);
      const entries = Object.entries(data);
      if (!entries.length) continue;
      const cols = entries.map(([k]) => toDbField(def, k));
      const vals = entries.map(([k, v]) => toDbValue(def, k, v));
      const placeholders = vals.map((_, i) => `$${i + 1}`);
      const query = `INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      const result = await pool.query(query, vals);
      created.push(toApiRecord(def, result.rows[0]));
    }
    res.status(201).json(created);
  }));

  app.put(`${base}/bulk`, ...entityAuth, async (_req, res) => {
    res.status(501).json({ error: 'bulk update is not implemented in this scaffold' });
  });

  app.patch(`${base}/update-many`, ...entityAuth, route(async (req, res) => {
    const queryFilter = req.body?.query || {};
    const updateData = sanitizeInput(def, req.body?.data || {});
    const entries = Object.entries(updateData);
    if (!entries.length) return res.status(400).json({ error: 'empty update data' });
    await assertOwnedReferences(pool, req.auth, updateData);
    const setValues = entries.map(([k, v]) => toDbValue(def, k, v));
    const sets = entries.map(([k], i) => `${toDbField(def, k)} = $${i + 1}`);
    const where = buildWhere(queryFilter, def, req.auth);
    const whereShifted = where.sql.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + setValues.length}`);
    const sql = `UPDATE ${def.table} SET ${sets.join(', ')}, updated_date = now() ${whereShifted} RETURNING *`;
    const result = await pool.query(sql, [...setValues, ...where.values]);
    res.json(result.rows.map((row) => toApiRecord(def, row)));
  }));

  app.delete(base, ...entityAuth, route(async (req, res) => {
    const bodyFilter = req.body || {};
    const where = buildWhere(bodyFilter, def, req.auth);
    if (!where.filterCount) return res.status(400).json({ error: 'empty filter is not allowed' });
    const result = await pool.query(`DELETE FROM ${def.table} ${where.sql}`, where.values);
    res.json({ deleted: result.rowCount });
  }));

  app.get(`${base}/:id`, ...entityAuth, route(async (req, res) => {
    const where = buildWhere({ id: req.params.id }, def, req.auth);
    const result = await pool.query(`SELECT * FROM ${def.table} ${where.sql}`, where.values);
    if (!result.rows[0]) return res.sendStatus(404);
    res.json(toApiRecord(def, result.rows[0]));
  }));

  app.put(`${base}/:id`, ...entityAuth, route(async (req, res) => {
    const data = sanitizeInput(def, req.body);
    const entries = Object.entries(data);
    if (!entries.length) return res.status(400).json({ error: 'empty payload' });
    await assertOwnedReferences(pool, req.auth, data);
    const sets = entries.map(([k], i) => `${toDbField(def, k)} = $${i + 1}`);
    const vals = entries.map(([k, v]) => toDbValue(def, k, v));
    const where = buildWhere({ id: req.params.id }, def, req.auth);
    const whereShifted = where.sql.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + vals.length}`);
    const query = `UPDATE ${def.table} SET ${sets.join(', ')}, updated_date = now() ${whereShifted} RETURNING *`;
    const result = await pool.query(query, [...vals, ...where.values]);
    if (!result.rows[0]) return res.sendStatus(404);
    res.json(toApiRecord(def, result.rows[0]));
  }));

  app.delete(`${base}/:id`, ...entityAuth, route(async (req, res) => {
    const where = buildWhere({ id: req.params.id }, def, req.auth);
    await pool.query(`DELETE FROM ${def.table} ${where.sql}`, where.values);
    res.sendStatus(204);
  }));

  app.put(`${base}/:id/restore`, ...entityAuth, async (_req, res) => {
    res.status(501).json({ error: 'restore is not implemented in hard-delete mode' });
  });
};

app.get('/healthz', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.get('/openapi.json', (_req, res) => res.json(openapi));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
registerAuthRoutes(app, pool);
registerQueueRoutes(app, requireAuth);
registerWildberriesRoutes(app, pool, requireAuth);

for (const [name, def] of Object.entries(entityDefinitions)) {
  registerEntity(name, def);
}

const port = Number(process.env.PORT || 3000);
app.use((err, _req, res, _next) => {
  console.error('[api-error]', err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'internal server error' });
});

await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT');
await ensureWildberriesCollectionTables(pool);

app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
