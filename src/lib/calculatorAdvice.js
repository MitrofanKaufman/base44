import { calculate, formatRub } from './unitEconomics.js';

const PRICE_SEARCH_LIMIT = 10_000_000;

const finiteNumber = (value, fallback = 0) => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const positiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const activeLogisticsFields = (form = {}) => (
  form.fulfillment_mode === 'FBS'
    ? ['fbs_last_mile', 'fbs_ops', 'fbs_storage', 'fbs_other']
    : ['fbo_wb_logistics', 'fbo_storage', 'fbo_other']
);

const roundRub = (value) => Math.round(value);

function addFieldHint(fieldHints, field, item) {
  if (!field) return;
  fieldHints[field] = {
    itemId: item.id,
    severity: item.severity,
    title: item.title,
    message: item.message,
  };
}

function findPriceForContribution(form = {}, targetContribution) {
  let low = 0;
  let high = Math.max(Number(form.price) || 0, 1);

  while (high <= PRICE_SEARCH_LIMIT) {
    const projected = calculate({ ...form, price: high });
    if (finiteNumber(projected.contribution) >= targetContribution) break;
    high *= 2;
  }

  if (high > PRICE_SEARCH_LIMIT) return undefined;

  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    const projected = calculate({ ...form, price: mid });
    if (finiteNumber(projected.contribution) >= targetContribution) high = mid;
    else low = mid;
  }

  let rounded = Math.ceil(high);
  for (let i = 0; i < 1000; i += 1) {
    const projected = calculate({ ...form, price: rounded });
    if (finiteNumber(projected.contribution) >= targetContribution) return rounded;
    rounded += 1;
  }

  return undefined;
}

/**
 * @param {Record<string, any>} form
 * @param {Record<string, any>} result
 * @param {number} gapRub
 * @returns {CalculatorAdviceItem[]}
 */
function buildDriverItems(form = {}, result = {}, gapRub = 0) {
  const activeFields = activeLogisticsFields(form);
  const drivers = [
    {
      id: 'cogs',
      field: 'cogs_purchase',
      fields: ['cogs_purchase', 'cogs_packaging', 'cogs_fulfillment', 'cogs_inbound_to_wb', 'waste_pct'],
      title: 'Высокая себестоимость',
      message: `Себестоимость с браком забирает ${formatRub(result.cogsWithWaste)} с каждой продажи. Проверьте закупку, упаковку, доставку до WB и процент брака.`,
      impactRub: finiteNumber(result.cogsWithWaste),
    },
    {
      id: 'logistics',
      field: activeFields[0],
      fields: activeFields,
      title: 'Дорогая логистика',
      message: `Логистика и хранение дают ${formatRub(result.channelVar)} переменных затрат. Проверьте схему FBO/FBS, габариты, направление и прочие расходы канала.`,
      impactRub: finiteNumber(result.channelVar),
    },
    {
      id: 'marketing',
      field: finiteNumber(form.cac) > 0 ? 'cac' : 'paid_share_pct',
      fields: ['paid_share_pct', 'cac'],
      title: 'Маркетинг съедает прибыль',
      message: `Платный трафик добавляет ${formatRub(result.marketingCost)} к затратам на заказ. Снизьте CAC или долю платного трафика, если цена не меняется.`,
      impactRub: finiteNumber(result.marketingCost),
    },
    {
      id: 'returns',
      field: 'return_rate_pct',
      fields: ['return_rate_pct', 'return_loss'],
      title: 'Потери на возвратах',
      message: `Возвраты добавляют ${formatRub(result.returnLossPerSale)} потерь на продажу. Проверьте процент возврата и сумму потери при возврате.`,
      impactRub: finiteNumber(result.returnLossPerSale),
    },
    {
      id: 'fees',
      field: 'wb_commission_pct',
      fields: ['wb_commission_pct', 'tax_pct', 'acquiring_pct', 'promo_pct'],
      title: 'Комиссии, налог и промо',
      message: `Комиссии, налог, эквайринг и промо суммарно забирают ${formatRub(
        finiteNumber(result.wbFee) +
        finiteNumber(result.tax) +
        finiteNumber(result.acquiring) +
        finiteNumber(result.promo),
      )}. Проверьте комиссию категории, налоговый режим и размер скидок.`,
      impactRub:
        finiteNumber(result.wbFee) +
        finiteNumber(result.tax) +
        finiteNumber(result.acquiring) +
        finiteNumber(result.promo),
    },
  ];

  const minMeaningfulImpact = Math.max(1, gapRub * 0.1);

  return drivers
    .filter((driver) => driver.impactRub >= minMeaningfulImpact)
    .sort((a, b) => b.impactRub - a.impactRub)
    .map((driver) => ({
      id: driver.id,
      severity: /** @type {CalculatorAdviceSeverity} */ ('warning'),
      field: driver.field,
      fields: driver.fields,
      title: driver.title,
      message: driver.message,
      impactRub: roundRub(driver.impactRub),
      recommendedValue: undefined,
      canApply: false,
      projectedContribution: undefined,
    }));
}

/**
 * @typedef {'profitable' | 'unit_loss' | 'monthly_loss'} CalculatorAdviceStatus
 * @typedef {'critical' | 'warning' | 'info' | 'success'} CalculatorAdviceSeverity
 *
 * @typedef {Object} CalculatorAdviceItem
 * @property {string} id
 * @property {CalculatorAdviceSeverity} severity
 * @property {string} field
 * @property {string[]} [fields]
 * @property {string} title
 * @property {string} message
 * @property {number} impactRub
 * @property {number | undefined} recommendedValue
 * @property {boolean} canApply
 * @property {number | undefined} projectedContribution
 *
 * @typedef {Object} CalculatorFieldHint
 * @property {string} itemId
 * @property {CalculatorAdviceSeverity} severity
 * @property {string} title
 * @property {string} message
 *
 * @typedef {Object} CalculatorAdvice
 * @property {CalculatorAdviceStatus} status
 * @property {{ severity: CalculatorAdviceSeverity, title: string, message: string }} summary
 * @property {CalculatorAdviceItem[]} items
 * @property {Record<string, CalculatorFieldHint>} fieldHints
 */

/**
 * Builds profitability diagnostics for the calculator form.
 *
 * @param {Record<string, any>} form
 * @param {Record<string, any>} [result]
 * @param {{ minContributionRub?: number }} [options]
 * @returns {CalculatorAdvice}
 */
export function buildCalculatorAdvice(form = {}, result = calculate(form), { minContributionRub = 1 } = {}) {
  const contribution = finiteNumber(result.contribution);
  const fieldHints = /** @type {Record<string, CalculatorFieldHint>} */ ({});

  if (contribution <= 0) {
    const targetContribution = Math.max(0.01, minContributionRub);
    const gapRub = Math.max(targetContribution - contribution, 0);
    const recommendedPrice = findPriceForContribution(form, targetContribution);
    const priceProjection = recommendedPrice === undefined
      ? undefined
      : calculate({ ...form, price: recommendedPrice });

    const priceItem = /** @type {CalculatorAdviceItem} */ ({
      id: 'price',
      severity: 'critical',
      field: 'price',
      fields: ['price'],
      title: 'Цена не покрывает переменные затраты',
      message: recommendedPrice === undefined
        ? `Не удалось подобрать цену до ${formatRub(PRICE_SEARCH_LIMIT)}. Проверьте комиссии, налоги и переменные расходы.`
        : `Чтобы вывести contribution выше нуля, поднимите цену минимум до ${formatRub(recommendedPrice)}.`,
      impactRub: roundRub(gapRub),
      recommendedValue: recommendedPrice,
      canApply: recommendedPrice !== undefined,
      projectedContribution: priceProjection ? finiteNumber(priceProjection.contribution) : undefined,
    });

    const driverItems = buildDriverItems(form, result, gapRub);
    const visibleItems = [priceItem, ...driverItems.slice(0, 3)];
    [priceItem, ...driverItems].forEach((item) => {
      (item.fields || [item.field]).forEach((field) => addFieldHint(fieldHints, field, item));
    });

    return {
      status: 'unit_loss',
      summary: {
        severity: 'critical',
        title: 'Модель убыточна на каждой продаже',
        message: `Contribution сейчас ${formatRub(contribution)}. Нужно улучшить результат минимум на ${formatRub(gapRub)}, чтобы выйти в плюс.`,
      },
      items: visibleItems,
      fieldHints,
    };
  }

  const monthlyPlan = positiveNumber(form.monthly_plan ?? form.planUnitsMonthly);
  const fixedMonthlyTotal = finiteNumber(result.fixedMonthlyTotal);
  const bepUnits = positiveNumber(result.bepUnits);

  if (monthlyPlan !== undefined && fixedMonthlyTotal > 0 && bepUnits !== undefined && monthlyPlan < Math.ceil(bepUnits)) {
    const requiredUnits = Math.ceil(bepUnits);
    const monthlyProfit = contribution * monthlyPlan - fixedMonthlyTotal;
    const monthlyItem = /** @type {CalculatorAdviceItem} */ ({
      id: 'monthly-plan',
      severity: 'warning',
      field: 'monthly_plan',
      fields: ['monthly_plan', 'fixed_monthly'],
      title: 'План продаж ниже точки безубыточности',
      message: `При текущем contribution нужно продавать минимум ${requiredUnits} шт./мес. Текущий план даёт ${formatRub(monthlyProfit)} операционного результата.`,
      impactRub: roundRub(Math.abs(monthlyProfit)),
      recommendedValue: requiredUnits,
      canApply: false,
      projectedContribution: contribution,
    });

    monthlyItem.fields.forEach((field) => addFieldHint(fieldHints, field, monthlyItem));

    return {
      status: 'monthly_loss',
      summary: {
        severity: 'warning',
        title: 'Товар прибыльный на единицу, но не покрывает месяц',
        message: `План ${Math.round(monthlyPlan)} шт./мес ниже точки безубыточности ${requiredUnits} шт./мес.`,
      },
      items: [monthlyItem],
      fieldHints,
    };
  }

  return {
    status: 'profitable',
    summary: {
      severity: 'success',
      title: 'Модель прибыльна',
      message: `Contribution ${formatRub(contribution)} на единицу. Критичных подсказок нет.`,
    },
    items: [],
    fieldHints,
  };
}
