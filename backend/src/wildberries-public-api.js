import { randomUUID } from 'node:crypto';

const WB_BASE_URL = 'https://www.wildberries.ru';
const WB_CARDS_DETAIL_URL = 'https://card.wb.ru/cards/v4/detail';
const WB_SEARCH_URL = 'https://search.wb.ru/exactmatch/ru/common/v18/search';
const DEFAULT_TIMEOUT_MS = 15_000;

const PRODUCT_DIMENSION_ALIASES = {
  length: ['длина товара', 'длина', 'длина предмета', 'глубина товара', 'глубина', 'глубина предмета'],
  width: ['ширина товара', 'ширина', 'ширина предмета'],
  height: ['высота товара', 'высота', 'высота предмета'],
};

const PRODUCT_WEIGHT_ALIASES = {
  withoutPackaging: [
    'вес товара без упаковки (г)',
    'вес товара без упаковки, г',
    'вес товара без упаковки',
    'вес без упаковки (г)',
    'вес без упаковки',
    'вес товара без упаковки (кг)',
    'вес товара без упаковки, кг',
    'вес предмета',
    'вес товара',
    'вес',
  ],
  withPackaging: [
    'вес товара с упаковкой (г)',
    'вес товара с упаковкой, г',
    'вес товара с упаковкой',
    'вес с упаковкой (г)',
    'вес с упаковкой',
    'вес брутто',
  ],
};

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
];

class WbCollectionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'WbCollectionError';
    this.details = details;
  }
}

const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const asString = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const normalizeNumberString = (value) => {
  const cleaned = String(value ?? '').trim().replace(/\s+/g, '').replace(/[^0-9,.-]+/g, '');
  if (!cleaned) return '';
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) return cleaned.replace(/,/g, '');
  if (hasComma) return cleaned.replace(',', '.');
  return cleaned;
};

const asNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const direct = Number(value.trim());
    if (Number.isFinite(direct)) return direct;
    const parsed = Number(normalizeNumberString(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const asBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return undefined;
};

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

const toArray = (value) => (Array.isArray(value) ? value : []);

const uniqueDefined = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const normalized = asString(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const priceFromCents = (value) => {
  const numeric = asNumber(value);
  if (numeric === undefined) return undefined;
  return numeric > 10_000 ? numeric / 100 : numeric;
};

const priceFromObject = (value, mode) => {
  const rec = asRecord(value);
  const candidates = mode === 'regular'
    ? [rec.basic, rec.total, rec.price, rec.product, rec.wallet, rec.value, rec.amount]
    : [rec.product, rec.wallet, rec.sale, rec.total, rec.basic, rec.value, rec.amount];
  for (const candidate of candidates) {
    const numeric = asNumber(candidate);
    if (numeric !== undefined) return numeric > 10_000 ? numeric / 100 : numeric;
  }
  return undefined;
};

const average = (values) => {
  const numbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!numbers.length) return undefined;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

export function buildProductUrl(article) {
  return `${WB_BASE_URL}/catalog/${encodeURIComponent(String(article))}/detail.aspx`;
}

export function nmIdToVolPart(nmId) {
  const s = String(nmId).trim();
  const numeric = Number(s);
  if (Number.isFinite(numeric) && numeric > 0) {
    return {
      vol: `vol${Math.floor(numeric / 100_000)}`,
      part: `part${Math.floor(numeric / 1_000)}`,
    };
  }
  return {
    vol: `vol${s.slice(0, 4)}`,
    part: `part${s.slice(0, 6)}`,
  };
}

export function defaultBasketHosts() {
  const out = [];
  for (let i = 1; i <= 32; i += 1) {
    out.push(`basket-${String(i).padStart(2, '0')}.wbbasket.ru`);
  }
  out.push('ekt-basket-cdn-15.geobasket.ru');
  return out;
}

export function normalizeBasketHosts(hosts) {
  const unique = new Set();
  for (const rawHost of hosts) {
    const host = String(rawHost ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (host) unique.add(host);
  }
  return [...unique];
}

const parseHostsCsv = (value) => {
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
};

const getBasketHosts = () => normalizeBasketHosts([
  ...parseHostsCsv(process.env.WB_BASKET_HOSTS),
  ...defaultBasketHosts(),
]);

export function buildCardJsonPath(nmId, locale = 'ru') {
  const { vol, part } = nmIdToVolPart(nmId);
  return `/${vol}/${part}/${encodeURIComponent(String(nmId))}/info/${encodeURIComponent(locale || 'ru')}/card.json`;
}

export function buildCardJsonUrls(nmId, hosts, opts = {}) {
  const path = buildCardJsonPath(nmId, opts.locale ?? 'ru');
  const query = opts.rnd ? `?rnd=${opts.rnd === true ? Date.now() : Number(opts.rnd)}` : '';
  return hosts.map((host) => `https://${host}${path}${query}`);
}

const pickDefaultUserAgent = () => (
  process.env.WB_USER_AGENT?.trim()
  || DEFAULT_USER_AGENTS[Math.floor(Math.random() * DEFAULT_USER_AGENTS.length)]
);

export function buildWbHeaders(referer) {
  const region = String(process.env.WB_REGION || '1259570991');
  const spp = String(process.env.WB_SPP || '30');
  return {
    'X-App-Type': String(process.env.WB_APP_TYPE || '1'),
    'X-Region': region,
    'X-Locale': String(process.env.WB_LOCALE || 'ru'),
    'Accept-Language': String(process.env.WB_LANGUAGE || 'ru-RU'),
    'User-Agent': pickDefaultUserAgent(),
    'X-Request-ID': randomUUID(),
    Cookie: `region=${region}; spp=${spp};`,
    Accept: 'application/json, text/plain, */*',
    ...(referer ? { Referer: referer, Origin: WB_BASE_URL } : {}),
  };
}

const fetchJson = async (url, options = {}) => {
  const startedAt = Date.now();
  const ctrl = new AbortController();
  const timeoutMs = Number(options.timeoutMs || process.env.WB_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timer = setTimeout(() => ctrl.abort(), Math.max(1_000, timeoutMs));
  try {
    const response = await fetch(url, {
      headers: options.headers || buildWbHeaders(),
      signal: ctrl.signal,
    });
    const text = await response.text().catch(() => '');
    const finishedAt = Date.now();
    const base = {
      ok: response.ok,
      status: response.status,
      url,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
    };

    if (!response.ok) {
      return { ...base, error: `${response.status} ${response.statusText}` };
    }

    try {
      return { ...base, json: text ? JSON.parse(text) : undefined };
    } catch (error) {
      return { ...base, ok: false, error: `Invalid JSON: ${error.message}` };
    }
  } catch (error) {
    const finishedAt = Date.now();
    return {
      ok: false,
      status: 0,
      url,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      error: error.message,
    };
  } finally {
    clearTimeout(timer);
  }
};

export function normalizeCardJson(obj) {
  const selling = asRecord(obj.selling);
  const media = asRecord(obj.media);
  return {
    nm_id: obj.nm_id,
    imt_id: obj.imt_id,
    slug: obj.slug,
    title: obj.imt_name,
    description: obj.description,
    brand_name: selling.brand_name,
    supplier_id: selling.supplier_id,
    supplier_name: selling.supplier_name,
    vendor_code: obj.vendor_code,
    photo_count: media.photo_count ?? null,
    has_video: media.has_video ? 1 : 0,
    colors: obj.colors ?? obj.full_colors ?? [],
    compositions: obj.compositions ?? [],
    options: obj.options ?? [],
    grouped_options: obj.grouped_options ?? [],
    sizes_table: obj.sizes_table ?? null,
    subj_name: obj.subj_name,
    subj_root_name: obj.subj_root_name,
    create_date: obj.create_date ?? null,
    update_date: obj.update_date ?? null,
    raw_payload: obj,
  };
}

const getCardHost = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

const buildImageUrls = (article, photoCount, host) => {
  const count = Math.max(0, Math.min(30, Math.floor(asNumber(photoCount) ?? 0)));
  if (!count || !host) return [];
  const { vol, part } = nmIdToVolPart(article);
  const base = `https://${host}/${vol}/${part}/${encodeURIComponent(String(article))}/images/big`;
  return Array.from({ length: count }, (_item, index) => `${base}/${index + 1}.webp`);
};

export async function fetchCardJson(article, options = {}) {
  const normalized = String(article ?? '').trim();
  const productUrl = buildProductUrl(normalized);
  const headers = buildWbHeaders(productUrl);
  const hosts = getBasketHosts();
  const urls = [
    ...buildCardJsonUrls(normalized, hosts, { locale: 'ru' }),
    ...buildCardJsonUrls(normalized, hosts, { locale: 'ru', rnd: true }),
  ];
  const attempts = [];

  for (const url of urls) {
    const result = await fetchJson(url, { headers, timeoutMs: options.timeoutMs });
    attempts.push({
      name: 'card.json',
      url,
      status: result.status,
      ok: result.ok,
      durationMs: result.durationMs,
      error: result.error,
    });
    const json = asRecord(result.json);
    if (!result.ok || !Object.keys(json).length) continue;
    const payloadNmId = asString(json.nm_id ?? json.nmId);
    if (payloadNmId && payloadNmId !== normalized) continue;
    return {
      ...result,
      attempts,
      normalized: normalizeCardJson(json),
      host: getCardHost(url),
    };
  }

  const last = attempts[attempts.length - 1];
  return {
    ok: false,
    status: last?.status || 0,
    url: last?.url || urls[0],
    durationMs: attempts.reduce((sum, item) => sum + (item.durationMs || 0), 0),
    error: `card.json not found (hosts=${hosts.length})`,
    attempts,
  };
}

export async function fetchCardsDetail(article, options = {}) {
  const normalized = String(article ?? '').trim();
  const url = new URL(WB_CARDS_DETAIL_URL);
  url.searchParams.set('appType', String(process.env.WB_APP_TYPE || '1'));
  url.searchParams.set('curr', String(process.env.WB_CURR || 'rub'));
  url.searchParams.set('dest', String(process.env.WB_REGION || '1259570991'));
  url.searchParams.set('spp', String(process.env.WB_SPP || '30'));
  url.searchParams.set('nm', normalized);
  const result = await fetchJson(url.toString(), {
    headers: buildWbHeaders(buildProductUrl(normalized)),
    timeoutMs: options.timeoutMs,
  });
  const payload = asRecord(result.json);
  const product = toArray(payload.products)[0] || toArray(asRecord(payload.data).products)[0];
  if (!result.ok) return result;
  if (!product) {
    return { ...result, ok: false, error: 'cards-detail: product not found' };
  }
  return { ...result, product };
}

export async function fetchSearchProduct(article, query = article, options = {}) {
  const url = new URL(WB_SEARCH_URL);
  url.searchParams.set('ab_testing', 'false');
  url.searchParams.set('appType', String(process.env.WB_APP_TYPE || '1'));
  url.searchParams.set('curr', String(process.env.WB_CURR || 'rub'));
  url.searchParams.set('dest', String(process.env.WB_REGION || '1259570991'));
  url.searchParams.set('query', String(query || article));
  url.searchParams.set('resultset', 'catalog');
  url.searchParams.set('sort', 'popular');
  url.searchParams.set('spp', String(process.env.WB_SPP || '30'));
  url.searchParams.set('suppressSpellcheck', 'false');
  const result = await fetchJson(url.toString(), {
    headers: buildWbHeaders(`${WB_BASE_URL}/catalog/0/search.aspx?search=${encodeURIComponent(query || article)}`),
    timeoutMs: options.timeoutMs,
  });
  const payload = asRecord(result.json);
  const products = toArray(payload.products).length ? toArray(payload.products) : toArray(asRecord(payload.data).products);
  const product = products.find((item) => String(asRecord(item).id ?? asRecord(item).nmId ?? '') === String(article))
    || products[0];
  if (!result.ok) return result;
  return { ...result, product };
}

const extractPrice = (product) => {
  const rec = asRecord(product);
  const sizes = toArray(rec.sizes);
  const priceU = firstNumber(rec.priceU, rec.price_u);
  const salePriceU = firstNumber(rec.salePriceU, rec.sale_price_u);
  let price = priceFromCents(priceU);
  let salePrice = priceFromCents(salePriceU);

  if (price === undefined || salePrice === undefined) {
    const prices = [];
    const salePrices = [];
    for (const size of sizes) {
      const item = asRecord(size);
      const priceObj = asRecord(item.price);
      const basic = priceFromCents(item.priceU ?? item.price_u) ?? priceFromObject(priceObj, 'regular');
      const sale = priceFromCents(item.salePriceU ?? item.sale_price_u) ?? priceFromObject(priceObj, 'sale');
      if (basic !== undefined) prices.push(basic);
      if (sale !== undefined) salePrices.push(sale);
    }
    price = price ?? average(prices);
    salePrice = salePrice ?? average(salePrices);
  }

  if (price !== undefined && salePrice !== undefined && salePrice > price) {
    return { price: salePrice, salePrice: price };
  }
  return { price, salePrice };
};

const extractStocks = (product) => {
  const sizes = toArray(asRecord(product).sizes);
  const byWarehouse = new Map();
  for (const size of sizes) {
    const stocks = toArray(asRecord(size).stocks);
    for (const stock of stocks) {
      const rec = asRecord(stock);
      const warehouseId = firstNumber(rec.warehouseId, rec.wh, rec.warehouse_id);
      const qty = firstNumber(rec.qty, rec.quantity, rec.amount, rec.count);
      if (warehouseId === undefined || qty === undefined) continue;
      const key = Math.floor(warehouseId);
      const existing = byWarehouse.get(key) || { warehouseId: key, qty: 0 };
      existing.qty += qty;
      for (const field of ['dtype', 'dist', 'priority', 'time1', 'time2']) {
        if (existing[field] === undefined) existing[field] = asNumber(rec[field]);
      }
      byWarehouse.set(key, existing);
    }
  }
  const stockByWarehouse = [...byWarehouse.values()].sort((a, b) => b.qty - a.qty || a.warehouseId - b.warehouseId);
  const stockTotal = stockByWarehouse.reduce((sum, item) => sum + (asNumber(item.qty) || 0), 0);
  return {
    stock: stockTotal || firstNumber(asRecord(product).totalQuantity, asRecord(product).stockTotal, asRecord(product).qty),
    stockByWarehouse: stockByWarehouse.length ? stockByWarehouse : undefined,
  };
};

const extractCharacteristicsFromOptions = (...optionsBuckets) => {
  const out = {};
  const visit = (entry) => {
    const rec = asRecord(entry);
    const nested = toArray(rec.options);
    nested.forEach(visit);

    const key = firstString(rec.name, rec.key, rec.label);
    const variableValues = toArray(rec.variable_values).map(asString).filter(Boolean);
    const value = firstString(rec.value, variableValues.length ? variableValues.join('; ') : undefined);
    if (!key || !value || out[key]) return;
    out[key] = value;
  };

  for (const bucket of optionsBuckets) {
    toArray(bucket).forEach(visit);
  }
  return Object.keys(out).length ? out : undefined;
};

const extractDimensionByAliases = (characteristics, aliases) => {
  if (!characteristics) return undefined;
  const normalized = new Map(
    Object.entries(characteristics).map(([key, value]) => [key.trim().toLowerCase(), String(value)]),
  );
  for (const alias of aliases) {
    const value = normalized.get(alias);
    const parsed = asNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const toWeightKg = (rawValue, alias) => {
  const parsed = asNumber(rawValue);
  if (parsed === undefined) return undefined;
  const normalizedValue = String(rawValue).trim().toLowerCase();
  const normalizedAlias = String(alias).trim().toLowerCase();
  const isKilograms = /(^|[\s,(])кг($|[\s),])/i.test(normalizedAlias) || /(^|[\s,(])кг($|[\s),])/i.test(normalizedValue);
  const isGrams = /(^|[\s,(])г($|[\s),])/i.test(normalizedAlias) || /(^|[\s,(])г($|[\s),])/i.test(normalizedValue);
  if (isKilograms) return parsed;
  if (isGrams) return parsed / 1000;
  return parsed > 80 ? parsed / 1000 : parsed;
};

const extractWeightByAliases = (characteristics, aliases) => {
  if (!characteristics) return undefined;
  const normalized = new Map(
    Object.entries(characteristics).map(([key, value]) => [key.trim().toLowerCase(), String(value)]),
  );
  for (const alias of aliases) {
    const value = normalized.get(alias);
    if (!value) continue;
    const parsed = toWeightKg(value, alias);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const extractDimensions = (characteristics) => {
  const packLength = asNumber(characteristics?.['Длина упаковки']);
  const packWidth = asNumber(characteristics?.['Ширина упаковки']);
  const packHeight = asNumber(characteristics?.['Высота упаковки']);
  return {
    sizeLengthCm: packLength ?? extractDimensionByAliases(characteristics, PRODUCT_DIMENSION_ALIASES.length),
    sizeWidthCm: packWidth ?? extractDimensionByAliases(characteristics, PRODUCT_DIMENSION_ALIASES.width),
    sizeHeightCm: packHeight ?? extractDimensionByAliases(characteristics, PRODUCT_DIMENSION_ALIASES.height),
    weightKg: extractWeightByAliases(characteristics, PRODUCT_WEIGHT_ALIASES.withoutPackaging)
      ?? extractWeightByAliases(characteristics, PRODUCT_WEIGHT_ALIASES.withPackaging),
  };
};

const normalizeVariant = (size, index) => {
  const rec = asRecord(size);
  const price = extractPrice({ sizes: [rec] });
  const stocks = toArray(rec.stocks);
  const stock = stocks.reduce((sum, item) => sum + (asNumber(asRecord(item).qty) || 0), 0);
  return {
    id: firstString(rec.chrtId, rec.chrt_id, rec.id, `variant-${index + 1}`),
    name: firstString(rec.name, rec.size, rec.techSize, `Variant ${index + 1}`),
    sku: firstString(rec.sku, rec.vendorCode, rec.vendor_code),
    size: firstString(rec.size, rec.techSize),
    color: firstString(rec.color, rec.origName),
    stock,
    available: stock > 0,
    price: price.price,
    salePrice: price.salePrice,
  };
};

const buildEndpointMeta = (id, result) => ({
  id,
  name: id,
  status: result?.ok ? 'success' : 'failed',
  attempts: Math.max(1, result?.attempts?.length || 1),
  startedAt: result?.startedAt,
  finishedAt: result?.finishedAt,
  durationMs: result?.durationMs || 0,
  statusCode: result?.status || 0,
  error: result?.ok ? undefined : result?.error,
});

const mergeRaw = (...records) => Object.assign({}, ...records.map(asRecord));

const buildProductProfile = ({ article, card, detail, search }) => {
  const cardNormalized = asRecord(card?.normalized);
  const cardRaw = asRecord(cardNormalized.raw_payload);
  const selling = asRecord(cardRaw.selling);
  const detailProduct = asRecord(detail?.product);
  const searchProduct = asRecord(search?.product);
  const source = Object.keys(detailProduct).length ? detailProduct : searchProduct;
  const price = extractPrice(mergeRaw(searchProduct, detailProduct));
  const stocks = extractStocks(mergeRaw(searchProduct, detailProduct));
  const photoCount = firstNumber(cardNormalized.photo_count, cardRaw.media && asRecord(cardRaw.media).photo_count, source.pics, source.photoCount);
  const cardImages = buildImageUrls(article, photoCount, card?.host);
  const sourceImages = uniqueDefined([
    ...toArray(source.images),
    ...toArray(source.photos),
    ...toArray(source.pictures),
  ]);
  const options = toArray(cardRaw.options).length ? cardRaw.options : cardNormalized.options;
  const groupedOptions = toArray(cardRaw.grouped_options).length ? cardRaw.grouped_options : cardNormalized.grouped_options;
  const characteristics = extractCharacteristicsFromOptions(options, groupedOptions, source.options, source.groupedOptions);
  const dimensions = extractDimensions(characteristics);
  const discountPct = price.price && price.salePrice && price.salePrice < price.price
    ? ((price.price - price.salePrice) / price.price) * 100
    : undefined;
  const sizes = toArray(source.sizes).map(normalizeVariant);
  const supplierId = firstString(
    source.supplierId,
    source.supplier_id,
    source.supplier,
    cardNormalized.supplier_id,
    selling.supplier_id,
  );
  const supplierName = firstString(
    source.supplierName,
    source.supplier_name,
    source.sellerName,
    source.storeName,
    cardNormalized.supplier_name,
    selling.supplier_name,
  );
  const name = firstString(source.name, source.title, cardNormalized.title, cardRaw.imt_name);
  const brand = firstString(source.brand, source.brandName, source.brand_name, cardNormalized.brand_name, selling.brand_name);
  const images = uniqueDefined([...sourceImages, ...cardImages]);
  const nmId = firstNumber(source.id, source.nmId, source.nm_id, cardNormalized.nm_id, article);

  return {
    article,
    nmId,
    name: name || `NM ${article}`,
    brand,
    vendorCode: firstString(source.vendorCode, source.vendor_code, cardNormalized.vendor_code, cardRaw.vendor_code),
    supplierId: supplierId ? asNumber(supplierId) ?? supplierId : undefined,
    supplierName,
    original: asBoolean(source.certificateVerified),
    verifiedSeller: asBoolean(source.sellerVerified),
    startDate: firstString(cardNormalized.create_date, cardRaw.create_date),
    price: price.price,
    salePrice: price.salePrice,
    discountPct,
    currency: 'RUB',
    rating: firstNumber(source.rating, source.reviewRating),
    reviews: {
      total: firstNumber(source.feedbacks, source.feedbackCount, source.reviewsCount) || 0,
      average: firstNumber(source.rating, source.reviewRating),
    },
    variants: sizes.length ? sizes : undefined,
    stock: stocks.stock,
    stockByWarehouse: stocks.stockByWarehouse,
    images: images.length ? images : undefined,
    metadata: {
      fetchedAt: Date.now(),
      rawSummary: {
        category: firstString(cardNormalized.subj_name, cardRaw.subj_name, source.subjectName),
        categoryRoot: firstString(cardNormalized.subj_root_name, cardRaw.subj_root_name),
        description: firstString(cardNormalized.description, cardRaw.description),
        season: firstString(cardRaw.season),
        photoCount,
        hasVideo: asBoolean(cardNormalized.has_video),
        colors: toArray(cardNormalized.colors).length ? cardNormalized.colors : undefined,
        compositions: toArray(cardNormalized.compositions).length ? cardNormalized.compositions : undefined,
        options,
        groupedOptions,
        characteristics,
        stockByWarehouse: stocks.stockByWarehouse,
        supplierId,
        supplierName,
      },
      cardJsonUrl: card?.url,
      cardsDetailUrl: detail?.url,
      searchUrl: search?.url,
    },
    category: firstString(cardNormalized.subj_name, cardRaw.subj_name, source.subjectName),
    categoryRoot: firstString(cardNormalized.subj_root_name, cardRaw.subj_root_name),
    description: firstString(cardNormalized.description, cardRaw.description),
    photoCount,
    characteristics,
    ...dimensions,
  };
};

export async function collectWbProduct(article, options = {}) {
  const normalized = String(article ?? '').trim();
  if (!normalized) throw new WbCollectionError('WB article is required');

  const report = async (progress, stage, preview) => {
    if (typeof options.onProgress === 'function') {
      await options.onProgress(Math.max(0, Math.min(99, Math.round(progress))), stage, preview);
    }
  };

  await report(15, 'card-json:start');
  const card = await fetchCardJson(normalized, options);
  await report(45, 'card-json:done');

  const detail = await fetchCardsDetail(normalized, options);
  await report(70, 'cards-detail:done');

  const query = options.query || normalized;
  const search = detail.ok ? undefined : await fetchSearchProduct(normalized, query, options);
  await report(85, 'search:done');

  const product = buildProductProfile({ article: normalized, card, detail, search });
  const endpoints = [
    buildEndpointMeta('card.json', card),
    buildEndpointMeta('cards-detail', detail),
    ...(search ? [buildEndpointMeta('search', search)] : []),
  ];
  const sourceOk = Boolean(card.ok || detail.ok || search?.ok);
  const errors = endpoints
    .filter((endpoint) => endpoint.status === 'failed')
    .map((endpoint) => `${endpoint.name}: ${endpoint.error || `HTTP ${endpoint.statusCode}`}`);
  const hasProduct = Boolean(product.name || product.nmId);

  await report(95, 'result:ready', {
    article: normalized,
    name: product.name,
    imageUrl: product.images?.[0],
    brand: product.brand,
    nmId: product.nmId,
    supplierId: product.supplierId ? String(product.supplierId) : undefined,
    supplierName: product.supplierName,
  });

  if (!sourceOk || !hasProduct) {
    throw new WbCollectionError(`WB product ${normalized} was not found`, { endpoints });
  }

  const seller = product.supplierId || product.supplierName
    ? {
        supplierId: product.supplierId,
        supplierName: product.supplierName,
        verified: product.verifiedSeller,
      }
    : undefined;

  return {
    ok: sourceOk,
    partial: errors.length > 0,
    errors: errors.length ? errors : undefined,
    article: normalized,
    nmId: product.nmId,
    fetchedAt: Date.now(),
    product,
    seller,
    endpoints,
    summary: product.metadata?.rawSummary || {},
    raw: {
      card: card.json,
      cardNormalized: card.normalized,
      cardsDetail: detail.json,
      search: search?.json,
    },
  };
}

export function mapWbCollectionToProductFields(collection) {
  const product = asRecord(collection?.product);
  const salePrice = asNumber(product.salePrice);
  const price = asNumber(product.price);
  return {
    wb_sku: asString(collection?.article),
    name: asString(product.name),
    image_url: toArray(product.images)[0],
    category: asString(product.category ?? asRecord(product.metadata?.rawSummary).category),
    price,
    sale_price: salePrice,
    discount_pct: asNumber(product.discountPct),
    size_length_cm: asNumber(product.sizeLengthCm),
    size_width_cm: asNumber(product.sizeWidthCm),
    size_height_cm: asNumber(product.sizeHeightCm),
    weight_kg: asNumber(product.weightKg),
    current_price: salePrice ?? price,
    stock: asNumber(product.stock),
    minimal_price: salePrice ?? price,
    commission_pct: undefined,
    last_synced_at: new Date().toISOString(),
  };
}

export { WbCollectionError };
