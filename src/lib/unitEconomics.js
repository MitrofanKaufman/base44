/**
 * Donor-compatible unit economics core.
 *
 * The formulas mirror unit.marketing's UnitEconomicsService.calculate() in
 * default docs-formula mode. The public calculate() function accepts both the
 * donor camelCase input names and this project's legacy snake_case form names.
 */

export const UNIT_ECON_BEP_GUARD_VALUE = 100_000_000;

const DEFAULT_TAX_SYSTEM = 'ip_usn_income_no_vat';

const TAX_SYSTEM_BASIS = {
  ip_usn_income_no_vat: 'income',
  ip_usn_income_expense_no_vat: 'income_expense',
  ip_usn_income_vat: 'income',
  ip_usn_income_expense_vat: 'income_expense',
  ip_osno: 'income_expense',
  ooo_usn_income_no_vat: 'income',
  ooo_usn_income_expense_no_vat: 'income_expense',
  ooo_usn_income_vat: 'income',
  ooo_usn_income_expense_vat: 'income_expense',
  ooo_osno: 'income_expense',
  npd: 'income',
};

const LEGACY_TAX_SYSTEMS = {
  usn_income: 'ip_usn_income_no_vat',
  usn_income_expense: 'ip_usn_income_expense_no_vat',
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pick = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined) return source[key];
  }
  return undefined;
};

const normalizeMoney = (value, fallback = 0) => {
  const parsed = toNumber(value);
  if (parsed === undefined) return fallback;
  return Math.max(0, parsed);
};

const normalizePercent = (value, fallback = 0) => {
  const parsed = toNumber(value);
  if (parsed === undefined) return fallback;
  return clamp(parsed, 0, 100);
};

const normalizeTaxSystem = (value) => {
  if (typeof value !== 'string') return undefined;
  const mapped = LEGACY_TAX_SYSTEMS[value] ?? value;
  return mapped in TAX_SYSTEM_BASIS ? mapped : undefined;
};

const normalizeVatPct = (value) => {
  const parsed = toNumber(value);
  if (parsed === 5 || parsed === 7 || parsed === 22) return parsed;
  return undefined;
};

const normalizePositive = (value) => {
  const parsed = toNumber(value);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
};

const normalizeIntId = (value) => {
  const parsed = toNumber(value);
  if (parsed === undefined) return undefined;
  const int = Math.floor(parsed);
  if (!Number.isFinite(int) || int < 0) return undefined;
  return int;
};

const normalizeNonNegativeInt = (value) => {
  const parsed = toNumber(value);
  if (parsed === undefined) return undefined;
  const int = Math.floor(parsed);
  if (!Number.isFinite(int) || int < 0) return undefined;
  return int;
};

const normalizeTariffMode = (value) => {
  if (value === 'pallet') return 'pallet';
  if (value === 'box') return 'box';
  return undefined;
};

const normalizePalletType = (value) => {
  if (value === 'piece') return 'piece';
  if (value === 'mono') return 'mono';
  return undefined;
};

const normalizeTariffDestination = (value) => {
  if (value === 'toWarehouse') return 'toWarehouse';
  if (value === 'toOffice') return 'toOffice';
  return undefined;
};

const normalizeBoolean = (value) => {
  if (value === true) return true;
  if (value === false) return false;
  return undefined;
};

const normalizeDateInput = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString().slice(0, 10);
};

export function calcVolumeliters(l, w, h) {
  if (!l || !w || !h) return null;
  return (l * w * h) / 1000;
}

export function isKgt(weightKg, volumeLiters) {
  return weightKg > 25 || volumeLiters > 25;
}

export function normalizeUnitEconomicsInput(inputs = {}) {
  const fulfillmentMode = pick(inputs, ['fulfillmentMode', 'fulfillment_mode']) === 'FBS' ? 'FBS' : 'FBO';
  const wbTariffMode = normalizeTariffMode(pick(inputs, ['wbTariffMode', 'wb_tariff_mode', 'package_mode']));
  const wbPalletType = wbTariffMode === 'pallet'
    ? normalizePalletType(pick(inputs, ['wbPalletType', 'wb_pallet_type']))
    : undefined;
  const wbBoxesPerPallet = wbTariffMode === 'pallet'
    ? normalizePositive(pick(inputs, ['wbBoxesPerPallet', 'wb_boxes_per_pallet']))
    : undefined;

  return {
    fulfillmentMode,
    taxSystem: normalizeTaxSystem(pick(inputs, ['taxSystem', 'tax_system'])) ?? DEFAULT_TAX_SYSTEM,
    productName: typeof pick(inputs, ['productName', 'product_name', 'name']) === 'string'
      ? pick(inputs, ['productName', 'product_name', 'name']).trim() || undefined
      : undefined,
    wbSku: typeof pick(inputs, ['wbSku', 'wb_sku']) === 'string'
      ? pick(inputs, ['wbSku', 'wb_sku']).trim() || undefined
      : undefined,
    sizeLengthCm: normalizePositive(pick(inputs, ['sizeLengthCm', 'size_length_cm'])),
    sizeWidthCm: normalizePositive(pick(inputs, ['sizeWidthCm', 'size_width_cm'])),
    sizeHeightCm: normalizePositive(pick(inputs, ['sizeHeightCm', 'size_height_cm'])),
    weightKg: normalizePositive(pick(inputs, ['weightKg', 'weight_kg'])),
    wbWarehouseId: normalizeIntId(pick(inputs, ['wbWarehouseId', 'wb_warehouse_id'])),
    wbTariffMode,
    wbPalletType,
    wbBoxesPerPallet,
    wbTariffDestination: normalizeTariffDestination(pick(inputs, ['wbTariffDestination', 'wb_tariff_destination'])),
    price: normalizeMoney(pick(inputs, ['price', 'priceNet', 'price_net', 'sale_price'])),
    wbSellerCabinetPriceEnabled: normalizeBoolean(
      pick(inputs, ['wbSellerCabinetPriceEnabled', 'wb_seller_cabinet_price_enabled']),
    ),
    discountPct: normalizePercent(pick(inputs, ['discountPct', 'discount_pct'])),
    wbCommissionPct: normalizePercent(pick(inputs, ['wbCommissionPct', 'wb_commission_pct'])),
    taxPct: normalizePercent(pick(inputs, ['taxPct', 'tax_pct'])),
    vatPct: normalizeVatPct(pick(inputs, ['vatPct', 'vat_pct'])),
    acquiringPct: normalizePercent(pick(inputs, ['acquiringPct', 'acquiring_pct'])),
    promoPct: normalizePercent(pick(inputs, ['promoPct', 'promo_pct'])),
    returnRatePct: normalizePercent(pick(inputs, ['returnRatePct', 'return_rate_pct'])),
    returnLoss: normalizeMoney(pick(inputs, ['returnLoss', 'return_loss'])),
    cogsPurchase: normalizeMoney(pick(inputs, ['cogsPurchase', 'cogs_purchase'])),
    cogsPackaging: normalizeMoney(pick(inputs, ['cogsPackaging', 'cogs_packaging'])),
    cogsFulfillment: normalizeMoney(pick(inputs, ['cogsFulfillment', 'cogs_fulfillment'])),
    cogsInboundToWb: normalizeMoney(pick(inputs, ['cogsInboundToWb', 'cogs_inbound_to_wb'])),
    wastePct: normalizePercent(pick(inputs, ['wastePct', 'waste_pct'])),
    cac: normalizeMoney(pick(inputs, ['cac'])),
    paidSharePct: normalizePercent(pick(inputs, ['paidSharePct', 'paid_share_pct'])),
    fixedMonthly: normalizeMoney(pick(inputs, ['fixedMonthly', 'fixed_monthly'])),
    planUnitsMonthly: normalizeMoney(pick(inputs, ['planUnitsMonthly', 'monthly_plan', 'plan_units_monthly'])),
    employeeCount: normalizeNonNegativeInt(pick(inputs, ['employeeCount', 'employee_count'])),
    payrollFundKRub: normalizeMoney(pick(inputs, ['payrollFundKRub', 'payroll_fund_krub', 'payroll_fund_k_rub'])),
    batchCode: typeof pick(inputs, ['batchCode', 'batch_code']) === 'string'
      ? pick(inputs, ['batchCode', 'batch_code']).trim() || undefined
      : undefined,
    batchVolume: normalizePositive(pick(inputs, ['batchVolume', 'batch_volume'])),
    batchDate: normalizeDateInput(pick(inputs, ['batchDate', 'batch_date'])),
    wbProfitCalcCompat: normalizeBoolean(pick(inputs, ['wbProfitCalcCompat', 'wb_profit_calc_compat'])),
    wbProfitCalcIrpPct: normalizePercent(pick(inputs, ['wbProfitCalcIrpPct', 'wb_profit_calc_irp_pct'])),
    wbProfitCalcTurnoverDays: normalizePositive(
      pick(inputs, ['wbProfitCalcTurnoverDays', 'wb_profit_calc_turnover_days']),
    ),
    wbProfitCalcAcceptanceCoefficient: normalizePositive(
      pick(inputs, ['wbProfitCalcAcceptanceCoefficient', 'wb_profit_calc_acceptance_coefficient']),
    ),
    fboWbLogisticsPerSale: normalizeMoney(pick(inputs, ['fboWbLogisticsPerSale', 'fbo_wb_logistics'])),
    fboStoragePerUnit: normalizeMoney(pick(inputs, ['fboStoragePerUnit', 'fbo_storage'])),
    fboOtherWbVariable: normalizeMoney(pick(inputs, ['fboOtherWbVariable', 'fbo_other'])),
    fbsLastMilePerSale: normalizeMoney(pick(inputs, ['fbsLastMilePerSale', 'fbs_last_mile'])),
    fbsSellerOpsPerUnit: normalizeMoney(pick(inputs, ['fbsSellerOpsPerUnit', 'fbs_ops'])),
    fbsStoragePerUnit: normalizeMoney(pick(inputs, ['fbsStoragePerUnit', 'fbs_storage'])),
    fbsOtherVariable: normalizeMoney(pick(inputs, ['fbsOtherVariable', 'fbs_other'])),
  };
}

export function calculateDonorUnitEconomics(inputs, product = {}) {
  const safeInputs = normalizeUnitEconomicsInput(inputs);
  const salePrice = normalizeMoney(safeInputs.price, product.salePrice ?? product.price ?? 0);
  const taxSystem = normalizeTaxSystem(safeInputs.taxSystem) ?? DEFAULT_TAX_SYSTEM;
  const wbCommissionRate = normalizePercent(safeInputs.wbCommissionPct) / 100;
  const taxRate = normalizePercent(safeInputs.taxPct) / 100;
  const vatRate = normalizePercent(safeInputs.vatPct) / 100;
  const acquiringRate = normalizePercent(safeInputs.acquiringPct) / 100;
  const promoRate = normalizePercent(safeInputs.promoPct) / 100;
  const returnRate = normalizePercent(safeInputs.returnRatePct) / 100;
  const wasteRate = normalizePercent(safeInputs.wastePct) / 100;
  const paidShare = normalizePercent(safeInputs.paidSharePct) / 100;

  const priceNet = salePrice;
  const acquiring = priceNet * acquiringRate;
  const wbFee = priceNet * wbCommissionRate;
  const promo = priceNet * promoRate;
  const returnLossPerSale = returnRate * normalizeMoney(safeInputs.returnLoss);
  const cogsBase =
    normalizeMoney(safeInputs.cogsPurchase) +
    normalizeMoney(safeInputs.cogsPackaging) +
    normalizeMoney(safeInputs.cogsFulfillment) +
    normalizeMoney(safeInputs.cogsInboundToWb);
  const cogsWithWaste = cogsBase * (1 + wasteRate);
  const channelVar = safeInputs.fulfillmentMode === 'FBS'
    ? normalizeMoney(safeInputs.fbsLastMilePerSale) +
      normalizeMoney(safeInputs.fbsSellerOpsPerUnit) +
      normalizeMoney(safeInputs.fbsStoragePerUnit) +
      normalizeMoney(safeInputs.fbsOtherVariable)
    : normalizeMoney(safeInputs.fboWbLogisticsPerSale) +
      normalizeMoney(safeInputs.fboStoragePerUnit) +
      normalizeMoney(safeInputs.fboOtherWbVariable);

  const marketingCost = normalizeMoney(safeInputs.cac) * paidShare;
  const vat = vatRate > 0 ? priceNet * vatRate / (1 + vatRate) : 0;
  const saleExVat = priceNet - vat;
  const deductibleVariable =
    cogsWithWaste +
    channelVar +
    returnLossPerSale +
    wbFee +
    acquiring +
    promo +
    marketingCost;
  const taxBase = TAX_SYSTEM_BASIS[taxSystem] === 'income_expense'
    ? Math.max(saleExVat - deductibleVariable, 0)
    : saleExVat;
  const businessTax = taxBase * taxRate;
  const tax = vat + businessTax;
  const revenueNet = saleExVat - businessTax - acquiring - wbFee - promo;

  const varCost = cogsWithWaste + channelVar;
  const grossProfit = revenueNet - varCost - returnLossPerSale;
  const contribution = grossProfit - marketingCost;

  const safePriceNet = Math.max(priceNet, 0.0001);
  const grossMarginPct = grossProfit / safePriceNet;
  const contributionPct = contribution / safePriceNet;

  const fixedMonthly = normalizeMoney(safeInputs.fixedMonthly);
  const payrollFundMonthly = normalizeMoney(safeInputs.payrollFundKRub) * 1000;
  const payrollTaxesMonthly = payrollFundMonthly * 0.3;
  const employeeCostsMonthly = payrollFundMonthly + payrollTaxesMonthly;
  const fixedMonthlyTotal = fixedMonthly + employeeCostsMonthly;
  const bepUnits = fixedMonthlyTotal > 0
    ? contribution > 0
      ? fixedMonthlyTotal / contribution
      : fixedMonthlyTotal / 0.0001
    : undefined;

  const warnings = [];
  if (contribution <= 0) {
    warnings.push('Contribution <= 0 - текущая модель убыточна/точка безубыточности недостижима');
  }

  return {
    priceNet: round(priceNet),
    vat: round(vat),
    businessTax: round(businessTax),
    taxBase: round(taxBase),
    tax: round(tax),
    acquiring: round(acquiring),
    wbFee: round(wbFee),
    promo: round(promo),
    revenueNet: round(revenueNet),
    returnLossPerSale: round(returnLossPerSale),
    cogsBase: round(cogsBase),
    cogsWithWaste: round(cogsWithWaste),
    channelVar: round(channelVar),
    varCost: round(varCost),
    grossProfit: round(grossProfit),
    grossMarginPct: round(grossMarginPct, 4),
    marketingCost: round(marketingCost),
    contribution: round(contribution),
    contributionPct: round(contributionPct, 4),
    bepUnits: typeof bepUnits === 'number' ? round(bepUnits, 2) : undefined,
    revenuePlan: undefined,
    variablePlan: undefined,
    contributionPlan: undefined,
    fixedPlan: undefined,
    profitPlan: undefined,
    payrollTaxesMonthly: round(payrollTaxesMonthly),
    employeeCostsMonthly: round(employeeCostsMonthly),
    fixedMonthlyTotal: round(fixedMonthlyTotal),
    warnings,
    price: product.price,
    salePrice,
    isProfitable: contribution > 0,
  };
}

export function calculate(input) {
  return calculateDonorUnitEconomics(input);
}

const hasFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export function ratioToPercent(value) {
  return hasFiniteNumber(value) ? value * 100 : value;
}

export function normalizePercentLike(value) {
  if (!hasFiniteNumber(value)) return value;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

export function formatRub(v) {
  if (!hasFiniteNumber(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v);
}

export function formatPct(v, mode = 'auto') {
  if (!hasFiniteNumber(v)) return '—';
  const value = mode === 'ratio'
    ? ratioToPercent(v)
    : mode === 'percent'
      ? v
      : normalizePercentLike(v);
  return `${value.toFixed(1)}%`;
}

export function formatNum(v) {
  if (!hasFiniteNumber(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(v);
}

export function isBepUnreachable(result) {
  return !result?.isProfitable || (hasFiniteNumber(result?.contribution) && result.contribution <= 0);
}
