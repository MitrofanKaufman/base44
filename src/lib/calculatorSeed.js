import { calculateLogisticsCost } from './LogisticsService.js';
import { resolveWbCommission } from './CommissionService.js';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const timestamp = (value) => {
  const raw = firstValue(value?.updatedAt, value?.updated_at, value?.date, value?.created_date);
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const latest = (items = []) => [...items].sort((a, b) => timestamp(b) - timestamp(a))[0];

const snapshotProductData = (snapshot) => {
  const data = snapshot?.data || {};
  return data.product || data.mapped || data;
};

const snapshotSummaryData = (snapshot) => {
  const data = snapshot?.data || {};
  return data.summary || data.product?.metadata?.rawSummary || {};
};

const metricInputs = (snapshot) => {
  const metrics = snapshot?.metrics || {};
  return metrics.inputs || metrics.form || metrics.calculation || {};
};

const applyNumber = (target, key, ...values) => {
  const parsed = firstNumber(...values);
  if (parsed !== undefined) target[key] = parsed;
};

/**
 * @param {{
 *   defaultForm?: Record<string, any>,
 *   product?: Record<string, any> | null,
 *   project?: Record<string, any> | null,
 *   productSnapshots?: Array<Record<string, any>>,
 *   unitEconomicsSnapshots?: Array<Record<string, any>>,
 *   priceHistory?: Array<Record<string, any>>,
 *   commissionDirectories?: Array<Record<string, any>>,
 *   logisticsDirectoriesMap?: Record<string, any>,
 * }} [options]
 * @returns {Record<string, any>}
 */
export function buildCalculatorSeed({
  defaultForm = {},
  product = null,
  project = null,
  productSnapshots = [],
  unitEconomicsSnapshots = [],
  priceHistory = [],
  commissionDirectories = [],
  logisticsDirectoriesMap = {},
} = {}) {
  const productSnapshot = latest(productSnapshots);
  const unitSnapshot = latest(unitEconomicsSnapshots);
  const priceRecord = latest(priceHistory);
  const productData = snapshotProductData(productSnapshot);
  const summaryData = snapshotSummaryData(productSnapshot);
  const inputs = metricInputs(unitSnapshot);
  const fulfillmentMode = firstValue(
    inputs.fulfillment_mode,
    inputs.fulfillmentMode,
    product?.fulfillment_mode,
    defaultForm.fulfillment_mode,
    'FBO',
  );

  const category = firstValue(
    productData.category,
    productData.categoryName,
    summaryData.category,
    product?.category,
  );
  const seedProduct = { ...(product || {}), category };
  /** @type {Record<string, any>} */
  const next = {
    ...defaultForm,
    fulfillment_mode: fulfillmentMode,
    package_mode: firstValue(inputs.package_mode, inputs.packageMode, defaultForm.package_mode),
    category,
    fixed_monthly: firstNumber(inputs.fixed_monthly, inputs.fixedMonthly, project?.fixed_monthly, defaultForm.fixed_monthly) ?? 0,
    logistics_direction: firstValue(inputs.logistics_direction, defaultForm.logistics_direction, 'moscow'),
  };

  applyNumber(next, 'price', productData.salePrice, productData.sale_price, productData.current_price, productSnapshot?.price, product?.sale_price, product?.price, defaultForm.price);
  applyNumber(next, 'wb_cabinet_price', priceRecord?.our_price, productData.price, product?.price, next.price);
  applyNumber(next, 'size_length_cm', productData.sizeLengthCm, productData.size_length_cm, inputs.size_length_cm, product?.size_length_cm);
  applyNumber(next, 'size_width_cm', productData.sizeWidthCm, productData.size_width_cm, inputs.size_width_cm, product?.size_width_cm);
  applyNumber(next, 'size_height_cm', productData.sizeHeightCm, productData.size_height_cm, inputs.size_height_cm, product?.size_height_cm);
  applyNumber(next, 'weight_kg', productData.weightKg, productData.weight_kg, inputs.weight_kg, product?.weight_kg);
  applyNumber(next, 'monthly_plan', inputs.monthly_plan, inputs.planUnitsMonthly, defaultForm.monthly_plan);
  applyNumber(next, 'tax_pct', inputs.tax_pct, inputs.taxPct, defaultForm.tax_pct);
  applyNumber(next, 'acquiring_pct', inputs.acquiring_pct, inputs.acquiringPct, defaultForm.acquiring_pct);
  applyNumber(next, 'promo_pct', inputs.promo_pct, inputs.promoPct, defaultForm.promo_pct);
  applyNumber(next, 'return_rate_pct', inputs.return_rate_pct, inputs.returnRatePct, defaultForm.return_rate_pct);
  applyNumber(next, 'return_loss', inputs.return_loss, inputs.returnLoss, defaultForm.return_loss);
  applyNumber(next, 'cogs_purchase', inputs.cogs_purchase, inputs.cogsPurchase, unitSnapshot?.cost, defaultForm.cogs_purchase);
  applyNumber(next, 'cogs_packaging', inputs.cogs_packaging, inputs.cogsPackaging, defaultForm.cogs_packaging);
  applyNumber(next, 'cogs_fulfillment', inputs.cogs_fulfillment, inputs.cogsFulfillment, defaultForm.cogs_fulfillment);
  applyNumber(next, 'cogs_inbound_to_wb', inputs.cogs_inbound_to_wb, inputs.cogsInboundToWb, defaultForm.cogs_inbound_to_wb);
  applyNumber(next, 'waste_pct', inputs.waste_pct, inputs.wastePct, defaultForm.waste_pct);
  applyNumber(next, 'cac', inputs.cac, defaultForm.cac);
  applyNumber(next, 'paid_share_pct', inputs.paid_share_pct, inputs.paidSharePct, defaultForm.paid_share_pct);
  applyNumber(next, 'fbo_other', inputs.fbo_other, inputs.fboOther, defaultForm.fbo_other);
  applyNumber(next, 'fbs_ops', inputs.fbs_ops, inputs.fbsOps, defaultForm.fbs_ops);
  applyNumber(next, 'fbs_other', inputs.fbs_other, inputs.fbsOther, defaultForm.fbs_other);

  next.tax_system = firstValue(inputs.tax_system, inputs.taxSystem, defaultForm.tax_system);
  next.wb_commission_pct = resolveWbCommission(seedProduct, fulfillmentMode, commissionDirectories);

  const logisticsProduct = { ...seedProduct, ...next };
  const logistics = calculateLogisticsCost(
    logisticsProduct,
    fulfillmentMode,
    next.logistics_direction,
    logisticsDirectoriesMap,
  );
  if (fulfillmentMode === 'FBS') {
    next.fbs_last_mile = firstNumber(inputs.fbs_last_mile, inputs.fbsLastMilePerSale, logistics.total, defaultForm.fbs_last_mile) ?? 0;
    next.fbs_storage = firstNumber(inputs.fbs_storage, inputs.fbsStorage, logistics.storage, defaultForm.fbs_storage) ?? 0;
  } else {
    next.fbo_wb_logistics = firstNumber(inputs.fbo_wb_logistics, inputs.fboWbLogisticsPerSale, logistics.total, defaultForm.fbo_wb_logistics) ?? 0;
    next.fbo_storage = firstNumber(inputs.fbo_storage, inputs.fboStorage, logistics.storage, defaultForm.fbo_storage) ?? 0;
  }

  return next;
}

/**
 * @param {{
 *   form?: Record<string, any>,
 *   product?: Record<string, any> | null,
 *   fulfillmentMode?: string,
 *   commissionDirectories?: Array<Record<string, any>>,
 *   logisticsDirectoriesMap?: Record<string, any>,
 * }} [options]
 * @returns {Record<string, any>}
 */
export function applyFulfillmentModeSeed({
  form = {},
  product = null,
  fulfillmentMode = 'FBO',
  commissionDirectories = [],
  logisticsDirectoriesMap = {},
} = {}) {
  const category = firstValue(form.category, product?.category, product?.category_name);
  const productForCalc = {
    ...(product || {}),
    ...form,
    category,
    fulfillment_mode: fulfillmentMode,
  };
  /** @type {Record<string, any>} */
  const next = {
    ...form,
    fulfillment_mode: fulfillmentMode,
    wb_commission_pct: resolveWbCommission(productForCalc, fulfillmentMode, commissionDirectories),
  };
  const logistics = calculateLogisticsCost(
    productForCalc,
    fulfillmentMode,
    next.logistics_direction || 'moscow',
    logisticsDirectoriesMap,
  );

  if (fulfillmentMode === 'FBS') {
    next.fbs_last_mile = logistics.total;
    next.fbs_storage = logistics.storage;
  } else {
    next.fbo_wb_logistics = logistics.total;
    next.fbo_storage = logistics.storage;
  }

  return next;
}
