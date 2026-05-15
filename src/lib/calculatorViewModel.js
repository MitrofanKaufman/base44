import { calculate, calculateWbReportMetrics } from './unitEconomics.js';

const COST_COLORS = {
  cogs: '#ea580c',
  logistics: '#3b82f6',
  commission: '#8b5cf6',
  tax: '#10b981',
  marketing: '#f59e0b',
  acquiring: '#6366f1',
  promo: '#f97316',
  return: '#ec4899',
  fees: '#8b5cf6',
  profit: '#10b981',
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const finiteNumber = (value, fallback = 0) => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const positiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const withPct = (items) => {
  const positiveItems = items
    .map((item) => ({ ...item, value: round(Math.max(0, finiteNumber(item.value))) }))
    .filter((item) => item.value > 0);
  const total = round(positiveItems.reduce((sum, item) => sum + item.value, 0));

  return {
    total,
    slices: positiveItems.map((item) => ({
      ...item,
      pct: total > 0 ? (item.value / total) * 100 : 0,
    })),
  };
};

export function getLogisticsSensitivityField(form = {}) {
  return form.fulfillment_mode === 'FBS' ? 'fbs_last_mile' : 'fbo_wb_logistics';
}

export function buildBepView(result = {}) {
  const contribution = finiteNumber(result.contribution);
  const fixedMonthlyTotal = finiteNumber(result.fixedMonthlyTotal);

  if (contribution > 0 && fixedMonthlyTotal <= 0) {
    return {
      isReachable: true,
      units: 0,
      display: '0 шт.',
      status: 'no_fixed_costs',
    };
  }

  if (result.isProfitable && Number.isFinite(result.bepUnits)) {
    const units = Math.ceil(result.bepUnits);
    return {
      isReachable: true,
      units,
      display: `${units} шт.`,
      status: 'reachable',
    };
  }

  return {
    isReachable: false,
    units: undefined,
    display: '∞',
    status: 'unreachable',
  };
}

export function buildMonthlyView(form = {}, result = {}, bep = buildBepView(result)) {
  const units = positiveNumber(form.monthly_plan ?? form.planUnitsMonthly);
  const fixedMonthlyTotal = finiteNumber(result.fixedMonthlyTotal, finiteNumber(form.fixed_monthly));
  const contribution = finiteNumber(result.contribution);
  const revenueNet = finiteNumber(result.revenueNet);
  const safetyMargin = units !== undefined && bep.isReachable && Number.isFinite(bep.units)
    ? round(units - bep.units, 1)
    : undefined;

  return {
    units,
    revenue: units !== undefined ? round(revenueNet * units) : undefined,
    profit: units !== undefined ? round(contribution * units - fixedMonthlyTotal) : undefined,
    fixedMonthlyTotal,
    safetyMargin,
  };
}

export function buildCostBreakdown(result = {}) {
  return withPct([
    { key: 'cogs', label: 'Себестоимость с браком', color: COST_COLORS.cogs, value: result.cogsWithWaste },
    { key: 'logistics', label: 'Логистика и хранение', color: COST_COLORS.logistics, value: result.channelVar },
    { key: 'commission', label: 'Комиссия WB', color: COST_COLORS.commission, value: result.wbFee },
    { key: 'tax', label: 'Налоги', color: COST_COLORS.tax, value: result.tax },
    { key: 'marketing', label: 'Маркетинг', color: COST_COLORS.marketing, value: result.marketingCost },
    { key: 'acquiring', label: 'Эквайринг', color: COST_COLORS.acquiring, value: result.acquiring },
    { key: 'promo', label: 'Промо и акции', color: COST_COLORS.promo, value: result.promo },
    { key: 'return', label: 'Потери на возвраты', color: COST_COLORS.return, value: result.returnLossPerSale },
  ]);
}

export function buildProfitStructure(result = {}) {
  return withPct([
    { key: 'cogs', label: 'Себестоимость', color: COST_COLORS.cogs, value: result.cogsWithWaste },
    {
      key: 'fees',
      label: 'Комиссии, налоги и промо',
      color: COST_COLORS.fees,
      value:
        finiteNumber(result.tax) +
        finiteNumber(result.wbFee) +
        finiteNumber(result.acquiring) +
        finiteNumber(result.promo),
    },
    {
      key: 'logistics',
      label: 'Логистика и возвраты',
      color: COST_COLORS.logistics,
      value: finiteNumber(result.channelVar) + finiteNumber(result.returnLossPerSale),
    },
    { key: 'marketing', label: 'Маркетинг', color: COST_COLORS.marketing, value: result.marketingCost },
    { key: 'profit', label: 'Contribution', color: COST_COLORS.profit, value: Math.max(0, finiteNumber(result.contribution)) },
  ]);
}

export function buildCalculatorViewModel(form = {}, result = calculate(form)) {
  const bep = buildBepView(result);
  return {
    result,
    bep,
    monthly: buildMonthlyView(form, result, bep),
    costBreakdown: buildCostBreakdown(result),
    profitStructure: buildProfitStructure(result),
    wbReport: calculateWbReportMetrics(form),
  };
}
