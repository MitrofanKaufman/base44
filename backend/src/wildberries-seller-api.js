const COMMON_API = 'https://common-api.wildberries.ru';
const MARKETPLACE_API = 'https://marketplace-api.wildberries.ru';
const SUPPLIES_API = 'https://supplies-api.wildberries.ru';

const DEFAULT_TIMEOUT_MS = 15_000;

const ARRAY_CANDIDATE_KEYS = [
  'report',
  'warehouses',
  'offices',
  'items',
  'data',
  'options',
  'tariffs',
  'coefficients',
  'result',
];

export class WbSellerApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'WbSellerApiError';
    this.status = status;
  }
}

const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
);

const toRecordRows = (value) => value.map((item) => (
  item && typeof item === 'object' && !Array.isArray(item) ? item : { value: item }
));

const findRowsInObject = (record) => {
  for (const key of ARRAY_CANDIDATE_KEYS) {
    if (Array.isArray(record[key])) return toRecordRows(record[key]);
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) return toRecordRows(value);
  }

  for (const value of Object.values(record)) {
    const nested = asRecord(value);
    if (!nested) continue;

    for (const key of ARRAY_CANDIDATE_KEYS) {
      if (Array.isArray(nested[key])) return toRecordRows(nested[key]);
    }
    for (const nestedValue of Object.values(nested)) {
      if (Array.isArray(nestedValue)) return toRecordRows(nestedValue);
    }
  }

  return [];
};

const deriveColumns = (rows) => {
  const columns = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) columns.add(key);
    if (columns.size >= 80) break;
  }
  return [...columns];
};

const parseNumericString = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower === '-' || lower === '--' || lower.includes('не принимает')) return undefined;
  const normalized = trimmed
    .replace(/\s+/g, '')
    .replace(/[^0-9,.-]+/g, '')
    .replace(/,(?=\d{1,2}$)/, '.')
    .replace(/,/g, '');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return parseNumericString(value);
  return undefined;
};

const asString = (value) => (
  typeof value === 'string' && value.trim() ? value.trim() : undefined
);

const firstString = (...values) => {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return undefined;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const normalized = asNumber(value);
    if (normalized !== undefined) return normalized;
  }
  return undefined;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(normalized)) return false;
  return undefined;
};

const normalizeDate = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const slugify = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/ё/g, 'е')
  .replace(/[^a-zа-я0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const buildEndpointId = (key, row, fallbackName) => {
  const id = firstNumber(
    row.ID,
    row.id,
    row.officeId,
    row.officeID,
    row.office_id,
    row.warehouseID,
    row.warehouseId,
    row.warehouse_id,
  );
  if (id !== undefined) return `${key}:${Math.floor(id)}`;

  const stringId = firstString(
    row.externalId,
    row.external_id,
    row.code,
    row.uid,
    row.uuid,
    row.address,
    fallbackName,
  );
  const slug = slugify(stringId);
  return slug ? `${key}:${slug}` : undefined;
};

const getRawActive = (row) => {
  const active = normalizeBoolean(row.isActive)
    ?? normalizeBoolean(row.active)
    ?? normalizeBoolean(row.is_active)
    ?? normalizeBoolean(row.allowUnload)
    ?? normalizeBoolean(row.status);
  return active ?? true;
};

const mapLogisticsRow = (key, row, syncedAt) => {
  const kind = key === 'marketplaceOffices' ? 'pvz' : 'warehouse';
  const label = kind === 'pvz' ? 'ПВЗ' : 'Склад';
  const name = firstString(
    row.name,
    row.officeName,
    row.warehouseName,
    row.warehouse,
    row.address,
    row.fullAddress,
    row.location,
  );
  const address = firstString(row.address, row.fullAddress, row.warehouseAddress, row.location);
  const directionId = buildEndpointId(key, row, name || address);
  if (!directionId) return null;

  const externalId = firstNumber(
    row.ID,
    row.id,
    row.officeId,
    row.officeID,
    row.office_id,
    row.warehouseID,
    row.warehouseId,
    row.warehouse_id,
  );
  const directionName = name || `${label} ${directionId}`;
  const lat = firstNumber(row.latitude, row.lat, row.geoLat, row.y);
  const lng = firstNumber(row.longitude, row.lng, row.lon, row.geoLon, row.x);

  return {
    source: 'wildberries',
    direction_id: directionId,
    direction_name: directionName,
    tariffs: {},
    raw_data: {
      ...row,
      wb_directory_key: key,
      type: kind,
      address,
      active: getRawActive(row),
      external_id: externalId,
      lat,
      lng,
    },
    synced_at: syncedAt,
  };
};

export function normalizeDirectoryPayload(payload) {
  let rows = [];

  if (Array.isArray(payload)) {
    rows = toRecordRows(payload);
  } else {
    const record = asRecord(payload);
    if (record) {
      rows = findRowsInObject(record);
      if (rows.length === 0) rows = [record];
    }
  }

  return {
    rows,
    columns: deriveColumns(rows),
    rowCount: rows.length,
    status: rows.length > 0 ? 'ok' : 'empty',
  };
}

export function normalizeWbLogisticsDirections(payloads, options = {}) {
  const syncedAt = options.syncedAt || new Date().toISOString();
  const directions = [];
  const seen = new Set();

  for (const { key, payload } of payloads) {
    const normalized = normalizeDirectoryPayload(payload);
    for (const row of normalized.rows) {
      const direction = mapLogisticsRow(key, row, syncedAt);
      if (!direction || seen.has(direction.direction_id)) continue;
      seen.add(direction.direction_id);
      directions.push(direction);
    }
  }

  return directions;
}

const COMMISSION_MODEL_FIELDS = [
  'kgvpMarketplace',
  'kgvpSupplier',
  'kgvpPickup',
  'kgvpBooking',
  'kgvpSupplierExpress',
  'paidStorageKgvp',
];

const firstFieldValue = (row, ...keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
};

const commissionModelFromRow = (row) => {
  const out = {};
  for (const key of COMMISSION_MODEL_FIELDS) {
    const value = firstNumber(row[key], row[key[0].toLowerCase() + key.slice(1)]);
    if (value !== undefined) out[key] = value;
  }
  return out;
};

export function normalizeWbCommissionDirectory(payload, options = {}) {
  const syncedAt = options.syncedAt || new Date().toISOString();
  const normalized = normalizeDirectoryPayload(payload);
  const out = [];
  const seen = new Set();

  for (const row of normalized.rows) {
    const categoryName = firstString(
      firstFieldValue(row, 'subjectName', 'subject_name', 'name', 'categoryName', 'category_name'),
    );
    const categoryIdRaw = firstFieldValue(row, 'subjectID', 'subjectId', 'subject_id', 'id', 'categoryId', 'category_id');
    const categoryId = String(categoryIdRaw ?? '').trim() || slugify(categoryName);
    const parentCategoryIdRaw = firstFieldValue(row, 'parentID', 'parentId', 'parent_id', 'parentCategoryId');
    if (!categoryId || !categoryName || seen.has(categoryId)) continue;
    seen.add(categoryId);

    const commissionByModel = commissionModelFromRow(row);
    out.push({
      source: 'wildberries',
      category_id: categoryId,
      category_name: categoryName,
      parent_category_id: String(parentCategoryIdRaw ?? '').trim() || undefined,
      parent_category_name: firstString(firstFieldValue(row, 'parentName', 'parent_name', 'parentCategoryName')),
      commission_pct: firstNumber(
        commissionByModel.kgvpMarketplace,
        commissionByModel.kgvpSupplier,
        firstFieldValue(row, 'commission', 'commissionPct', 'commission_pct'),
      ),
      commission_by_model: commissionByModel,
      raw_data: row,
      synced_at: syncedAt,
    });
  }

  return out;
}

export class WbSellerApi {
  async fetchWithTimeout(url, init, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(1_000, timeoutMs));
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  buildUrl(url, query) {
    if (!query || Object.keys(query).length === 0) return url;
    const target = new URL(url);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      target.searchParams.set(key, String(value));
    }
    return target.toString();
  }

  async requestJson(url, opts) {
    const token = String(opts.token ?? '').trim();
    if (!token) throw new WbSellerApiError('WB Seller API token is empty', 400);
    const timeoutMs = typeof opts.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs)
      ? opts.timeoutMs
      : DEFAULT_TIMEOUT_MS;
    const requestUrl = this.buildUrl(url, opts.query);

    const hasBody = opts.body !== undefined;
    const body = hasBody ? JSON.stringify(opts.body) : undefined;
    const res = await this.fetchWithTimeout(
      requestUrl,
      {
        method: opts.method || 'GET',
        headers: {
          Authorization: token,
          Accept: 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(hasBody ? { body } : {}),
      },
      timeoutMs,
    );

    if (res.status === 401 || res.status === 403) {
      throw new WbSellerApiError('WB Seller API token is invalid', 400);
    }
    if (res.status === 429) {
      throw new WbSellerApiError('WB Seller API rate limit exceeded (HTTP 429)', 429);
    }
    if (!res.ok) {
      throw new WbSellerApiError(`WB Seller API request failed: HTTP ${res.status}`, 502);
    }

    try {
      return await res.json();
    } catch {
      throw new WbSellerApiError('WB Seller API returned invalid JSON', 502);
    }
  }

  async getCommissionRaw(opts) {
    return await this.requestJson(`${COMMON_API}/api/v1/tariffs/commission`, opts);
  }

  async getTariffsBox(opts) {
    return await this.requestJson(
      `${COMMON_API}/api/v1/tariffs/box`,
      { token: opts.token, timeoutMs: opts.timeoutMs, query: { date: normalizeDate(opts.date) } },
    );
  }

  async getMarketplaceOffices(opts) {
    return await this.requestJson(`${MARKETPLACE_API}/api/v3/offices`, opts);
  }

  async getMarketplaceWarehouses(opts) {
    return await this.requestJson(`${MARKETPLACE_API}/api/v3/warehouses`, opts);
  }

  async getSuppliesWarehouses(opts) {
    return await this.requestJson(`${SUPPLIES_API}/api/v1/warehouses`, opts);
  }
}
