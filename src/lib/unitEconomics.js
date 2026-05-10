/**
 * Расчёт юнит-экономики по документации unit.marketing
 * Все формулы строго из документации бухгалтера
 */

const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v ?? 0, min), max);
const safe = (v) => (v == null || v < 0 ? 0 : v);
const pct = (v) => clamp(v ?? 0) / 100;

export function calcVolumeliters(l, w, h) {
  if (!l || !w || !h) return null;
  return (l * w * h) / 1000;
}

export function isKgt(weightKg, volumeLiters) {
  return (weightKg > 25) || (volumeLiters > 25);
}

/**
 * Основной расчёт юнит-экономики
 * @param {object} p - параметры
 * @returns {object} - результаты расчёта
 */
export function calculate(p) {
  // 1. Цена для расчёта
  const priceNet = safe(p.price ?? p.sale_price ?? 0);

  // 2. Удержания WB и промо (без налога пока)
  const acquiring = priceNet * pct(p.acquiring_pct);
  const wbFee = priceNet * pct(p.wb_commission_pct);
  const promo = priceNet * pct(p.promo_pct);

  // 3. Базовая себестоимость (нужна для расчёта налога УСН Д-Р)
  const cogsBaseForTax = safe(p.cogs_purchase) + safe(p.cogs_packaging) + safe(p.cogs_fulfillment) + safe(p.cogs_inbound_to_wb);
  const cogsWithWasteForTax = cogsBaseForTax * (1 + pct(p.waste_pct));

  let channelVarForTax;
  if (p.fulfillment_mode === 'FBS') {
    channelVarForTax = safe(p.fbs_last_mile) + safe(p.fbs_ops) + safe(p.fbs_storage) + safe(p.fbs_other);
  } else {
    channelVarForTax = safe(p.fbo_wb_logistics) + safe(p.fbo_storage) + safe(p.fbo_other);
  }

  // 4. Расчёт налога в зависимости от системы налогообложения
  // УСН Доходы: налог % от всей выручки
  // УСН Доходы-Расходы: налог % от (выручка - расходы), мин. 1% от выручки
  let tax = 0;
  const taxSystem = p.tax_system || 'usn_income'; // usn_income | usn_income_expense
  if (taxSystem === 'usn_income') {
    tax = priceNet * pct(p.tax_pct);
  } else if (taxSystem === 'usn_income_expense') {
    const deductibleExpenses = cogsWithWasteForTax + channelVarForTax + acquiring + wbFee + promo;
    const taxableBase = Math.max(0, priceNet - deductibleExpenses);
    const calculatedTax = taxableBase * pct(p.tax_pct);
    const minTax = priceNet * 0.01; // минимальный налог 1% от дохода
    tax = Math.max(calculatedTax, minTax);
  }

  // 5. Чистая выручка
  const revenueNet = priceNet - tax - acquiring - wbFee - promo;

  // 4. Потери на возвраты на 1 продажу
  const returnLossPerSale = pct(p.return_rate_pct) * safe(p.return_loss);

  // 6. Базовая себестоимость
  const cogsBase = safe(p.cogs_purchase) + safe(p.cogs_packaging) + safe(p.cogs_fulfillment) + safe(p.cogs_inbound_to_wb);

  // 7. Себестоимость с браком
  const cogsWithWaste = cogsBase * (1 + pct(p.waste_pct));

  // 8. Переменные расходы канала
  let channelVar;
  if (p.fulfillment_mode === 'FBS') {
    channelVar = safe(p.fbs_last_mile) + safe(p.fbs_ops) + safe(p.fbs_storage) + safe(p.fbs_other);
  } else {
    channelVar = safe(p.fbo_wb_logistics) + safe(p.fbo_storage) + safe(p.fbo_other);
  }

  // 9. Все переменные затраты
  const varCost = cogsWithWaste + channelVar;

  // 10. Валовая прибыль
  const grossProfit = revenueNet - varCost - returnLossPerSale;

  // 11. Валовая маржа
  const grossMarginPct = grossProfit / Math.max(priceNet, 0.0001);

  // 12. Маркетинговые расходы
  const marketingCost = safe(p.cac) * pct(p.paid_share_pct);

  // 13. Contribution margin
  const contribution = grossProfit - marketingCost;

  // 14. Contribution margin %
  const contributionPct = contribution / Math.max(priceNet, 0.0001);

  // 15. Точка безубыточности
  const fixedMonthly = safe(p.fixed_monthly);
  const bepUnits = fixedMonthly > 0
    ? fixedMonthly / Math.max(contribution, 0.0001)
    : null;

  const isProfitable = contribution > 0;

  return {
    priceNet: round2(priceNet),
    tax: round2(tax),
    acquiring: round2(acquiring),
    wbFee: round2(wbFee),
    promo: round2(promo),
    revenueNet: round2(revenueNet),
    returnLossPerSale: round2(returnLossPerSale),
    cogsBase: round2(cogsBase),
    cogsWithWaste: round2(cogsWithWaste),
    channelVar: round2(channelVar),
    varCost: round2(varCost),
    grossProfit: round2(grossProfit),
    grossMarginPct: round4(grossMarginPct * 100),
    marketingCost: round2(marketingCost),
    contribution: round2(contribution),
    contributionPct: round4(contributionPct * 100),
    bepUnits: bepUnits != null ? round2(bepUnits) : null,
    isProfitable,
  };
}

const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10000) / 10000;

export function formatRub(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v);
}

export function formatPct(v) {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

export function formatNum(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(v);
}