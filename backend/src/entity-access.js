const READONLY_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by']);

const OWNED_REFERENCES = {
  client_id: { table: 'clients', idField: 'id' },
  project_id: { table: 'projects', idField: 'id' },
  product_id: { table: 'products', idField: 'id' },
};

export const toDbField = (def, apiField) => def.fields[apiField]?.db;

export const isAdminAuth = (auth = {}) => auth?.role === 'admin';

export const sanitizeInput = (def, payload = {}) => {
  const out = {};
  for (const [apiField, value] of Object.entries(payload || {})) {
    if (!def.fields[apiField]) continue;
    if (READONLY_FIELDS.has(apiField)) continue;
    out[apiField] = value;
  }
  return out;
};

function buildAccessClause(def, auth, index) {
  if (isAdminAuth(auth)) return null;
  const createdByField = toDbField(def, 'created_by');
  if (!createdByField || !auth?.email) {
    return { clause: 'FALSE', values: [] };
  }
  return { clause: `${createdByField} = $${index}`, values: [auth.email] };
}

export function buildWhere(query = {}, def, auth = {}) {
  const values = [];
  const clauses = [];
  let idx = 1;
  let filterCount = 0;

  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    const dbField = toDbField(def, key);
    if (!dbField) continue;
    clauses.push(`${dbField} = $${idx++}`);
    values.push(value);
    filterCount += 1;
  }

  const access = buildAccessClause(def, auth, idx);
  if (access) {
    clauses.push(access.clause);
    values.push(...access.values);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
    filterCount,
  };
}

export async function assertOwnedReferences(pool, auth = {}, data = {}) {
  if (isAdminAuth(auth)) return;
  if (!auth?.email) {
    throw Object.assign(new Error('Forbidden reference: anonymous'), { status: 403 });
  }

  for (const [field, ref] of Object.entries(OWNED_REFERENCES)) {
    const value = data?.[field];
    if (value === undefined || value === null || value === '') continue;
    const result = await pool.query(
      `SELECT ${ref.idField} FROM ${ref.table} WHERE ${ref.idField} = $1 AND created_by = $2 LIMIT 1`,
      [value, auth.email],
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error(`Forbidden reference: ${field}`), { status: 403 });
    }
  }
}
