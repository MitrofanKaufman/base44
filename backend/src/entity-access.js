const READONLY_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by']);
export const PUBLIC_RECORD_OWNER = 'system';

const OWNED_REFERENCES = {
  client_id: { table: 'clients', idField: 'id' },
  project_id: { table: 'projects', idField: 'id' },
  product_id: { table: 'products', idField: 'id' },
};

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/i;

export const toDbField = (def, apiField) => def.fields[apiField]?.db;

export const isAdminAuth = (auth = {}) => auth?.role === 'admin';

export function assertSqlIdentifier(identifier) {
  if (!IDENTIFIER_RE.test(String(identifier || ''))) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return identifier;
}

export const sanitizeInput = (def, payload = {}) => {
  const out = {};
  for (const [apiField, value] of Object.entries(payload || {})) {
    if (!def.fields[apiField]) continue;
    if (READONLY_FIELDS.has(apiField)) continue;
    out[apiField] = value;
  }
  return out;
};

function buildAccessClause(def, auth, index, options = {}) {
  if (isAdminAuth(auth)) return null;
  const createdByField = toDbField(def, 'created_by');
  if (!createdByField || !auth?.email) {
    return { clause: 'FALSE', values: [] };
  }
  if (def.publicRead && options.includePublic !== false) {
    return {
      clause: `(${createdByField} = $${index} OR ${createdByField} = $${index + 1} OR ${createdByField} IS NULL)`,
      values: [auth.email, PUBLIC_RECORD_OWNER],
    };
  }
  return { clause: `${createdByField} = $${index}`, values: [auth.email] };
}

export function buildOwnerAccess(auth = {}, ownerField = 'created_by', index = 1) {
  assertSqlIdentifier(ownerField);
  if (isAdminAuth(auth)) {
    return { clause: '', values: [], nextIndex: index };
  }
  if (!auth?.email) {
    return { clause: 'FALSE', values: [], nextIndex: index };
  }
  return {
    clause: `${ownerField} = $${index}`,
    values: [auth.email],
    nextIndex: index + 1,
  };
}

export function appendOwnerAccess(whereSql, values = [], auth = {}, ownerField = 'created_by') {
  const access = buildOwnerAccess(auth, ownerField, values.length + 1);
  if (!access.clause) return { sql: whereSql, values };
  const prefix = whereSql && whereSql.trim() ? `${whereSql} AND ` : 'WHERE ';
  return {
    sql: `${prefix}${access.clause}`,
    values: [...values, ...access.values],
  };
}

export async function getOwnedRecord(pool, {
  table,
  id,
  auth = {},
  idField = 'id',
  ownerField = 'created_by',
  select = '*',
}) {
  assertSqlIdentifier(table);
  assertSqlIdentifier(idField);
  assertSqlIdentifier(ownerField);
  const where = appendOwnerAccess(
    `WHERE ${idField} = $1`,
    [id],
    auth,
    ownerField,
  );
  const result = await pool.query(
    `SELECT ${select} FROM ${table} ${where.sql} LIMIT 1`,
    where.values,
  );
  return result.rows[0] || null;
}

export function buildWhere(query = {}, def, auth = {}, options = {}) {
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

  const access = buildAccessClause(def, auth, idx, options);
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
