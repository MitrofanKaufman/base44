/**
 * Сервис управления комиссиями маркетплейсов
 * Хранит комиссии по категориям и источникам
 */

const DEFAULT_COMMISSIONS = {
  wildberries: {
    'Электроника': 15,
    'Одежда': 20,
    'Обувь': 25,
    'Мебель': 12,
    'Красота': 18,
    'Спорт': 20,
    'Книги': 10,
    'default': 15
  },
  yandex: {
    'Электроника': 12,
    'Одежда': 18,
    'Обувь': 22,
    'Мебель': 10,
    'default': 12
  },
  ozon: {
    'Электроника': 13,
    'Одежда': 19,
    'Обувь': 24,
    'Мебель': 11,
    'default': 13
  }
};

export function getCommissionByCategory(category, source = 'wildberries') {
  const sourceCommissions = DEFAULT_COMMISSIONS[source] || DEFAULT_COMMISSIONS.wildberries;
  return sourceCommissions[category] || sourceCommissions.default;
}

export function getCommissionByProduct(product, source = 'wildberries') {
  // Приоритет: явная комиссия на товаре > категория > default
  if (product?.wb_commission_pct) {
    return product.wb_commission_pct;
  }

  if (product?.category) {
    return getCommissionByCategory(product.category, source);
  }

  const sourceCommissions = DEFAULT_COMMISSIONS[source] || DEFAULT_COMMISSIONS.wildberries;
  return sourceCommissions.default;
}

export function getAllCommissions(source = 'wildberries') {
  return DEFAULT_COMMISSIONS[source] || DEFAULT_COMMISSIONS.wildberries;
}

/**
 * Получить рекомендуемую цену с учетом комиссии и целевой маржи
 * @param {number} cost - себестоимость
 * @param {number} targetMarginPct - целевая маржа (%)
 * @param {number} commissionPct - комиссия (%)
 * @returns {number} - рекомендуемая розничная цена
 */
export function getRecommendedPrice(cost, targetMarginPct = 20, commissionPct = 15) {
  if (!cost || cost <= 0) return 0;

  // P = C / (1 - (commission + tax) / 100 - targetMargin / 100)
  // где P - розничная цена, C - себестоимость
  const totalDeduction = (commissionPct + 6) / 100 + (targetMarginPct / 100); // 6% налог УСН по умолчанию
  const price = cost / (1 - totalDeduction);

  return Math.round(price);
}