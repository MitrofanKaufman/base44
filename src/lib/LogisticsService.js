/**
 * Сервис управления логистикой и тарифами
 * Обрабатывает зависимости между схемой доставки, товаром, направлением и справочниками
 */

const TARIFF_CACHE = {}; // кешируем тарифы для быстрого доступа

/**
 * Получить тарифы для товара и направления
 * @param {string} direction - направление доставки (moscow, spb и т.д.)
 * @param {string} mode - FBO или FBS
 * @param {object} directoriesMap - справочники из БД {source: {direction_id: {...}}}
 * @returns {object} - {base, per_kg, storage}
 */
export function getTariffs(direction, mode, directoriesMap = {}) {
  const cacheKey = `${direction}_${mode}`;
  if (TARIFF_CACHE[cacheKey]) {
    return TARIFF_CACHE[cacheKey];
  }

  // Поиск в справочниках WB
  const wbDir = (directoriesMap.wildberries || []).find(
    d => d.direction_id === direction
  );

  if (wbDir?.tariffs?.[mode]) {
    const tariff = {
      base: wbDir.tariffs[mode].base,
      per_kg: wbDir.tariffs[mode].per_kg,
      storage: wbDir.tariffs[mode].storage,
      source: 'wildberries'
    };
    TARIFF_CACHE[cacheKey] = tariff;
    return tariff;
  }

  // Fallback по умолчанию
  const defaults = {
    'FBO': { base: 45, per_kg: 1.5, storage: 8, source: 'default' },
    'FBS': { base: 30, per_kg: 0.8, storage: 5, source: 'default' }
  };

  const tariff = defaults[mode] || defaults['FBO'];
  TARIFF_CACHE[cacheKey] = tariff;
  return tariff;
}

/**
 * Рассчитать стоимость логистики для товара
 * @param {object} product - данные товара
 * @param {string} mode - FBO или FBS
 * @param {string} direction - направление доставки
 * @param {object} directoriesMap - справочники
 * @returns {object} - разбор затрат: {base, weight, total}
 */
export function calculateLogisticsCost(product, mode, direction, directoriesMap = {}) {
  const tariffs = getTariffs(direction, mode, directoriesMap);

  const weightKg = product.weight_kg || 0;
  const baseCost = tariffs.base;
  const weightCost = Math.max(0, weightKg - 0.05) * (tariffs.per_kg || 0); // первые 50г включены в базовую ставку

  return {
    base: baseCost,
    weight: Math.round(weightCost * 100) / 100,
    total: Math.round((baseCost + weightCost) * 100) / 100,
    storage: tariffs.storage,
    source: tariffs.source
  };
}

/**
 * Получить комиссию WB на основе категории и товара
 * @param {object} product - данные товара
 * @param {object} categoryCommissions - {category: commissionPct}
 * @returns {number} - комиссия в процентах
 */
export function getWBCommission(product, categoryCommissions = {}) {
  if (!product) return 15; // комиссия по умолчанию

  // Приоритет: явно установленное значение > категория > default
  if (product.wb_commission_pct) {
    return product.wb_commission_pct;
  }

  if (product.category && categoryCommissions[product.category]) {
    return categoryCommissions[product.category];
  }

  return 15; // комиссия по умолчанию для категории
}

/**
 * Получить доступные направления доставки из справочников
 * @param {object} directoriesMap - справочники {source: [...]}
 * @param {string} source - источник (wildberries, yandex, ozon)
 * @returns {array} - [{id, name, icon}]
 */
export function getAvailableDirections(directoriesMap = {}, source = 'wildberries') {
  const directories = directoriesMap[source] || [];

  if (directories.length === 0) {
    // Fallback значения
    return [
      { id: 'moscow', name: 'Москва', icon: '🏙️' },
      { id: 'spb', name: 'Санкт-Петербург', icon: '🏛️' }
    ];
  }

  return directories.map(dir => ({
    id: dir.direction_id,
    name: dir.direction_name,
    icon: '📍',
    source: source
  }));
}

/**
 * Проверить зависимость товара от схемы доставки
 * Некоторые товары могут быть недоступны в FBS или требовать специальной подготовки
 * @param {object} product - данные товара
 * @param {string} mode - FBO или FBS
 * @returns {object} - {available, restrictions: []}
 */
export function checkFulfillmentCompatibility(product, mode) {
  if (!product) {
    return { available: true, restrictions: [] };
  }

  const restrictions = [];

  // Товары более 25кг или 25л могут быть недоступны в FBS
  const volumeLiters = product.weight_kg || 0;
  if (mode === 'FBS' && product.weight_kg > 25) {
    restrictions.push('Товар тяжелее 25кг недоступен для FBS');
  }

  // Хрупкие товары требуют специальной упаковки в FBS
  if (mode === 'FBS' && product.is_fragile) {
    restrictions.push('Хрупкие товары требуют документов для FBS');
  }

  return {
    available: restrictions.length === 0,
    restrictions
  };
}

/**
 * Очистить кеш тарифов (вызывается при обновлении справочников)
 */
export function clearTariffCache() {
  Object.keys(TARIFF_CACHE).forEach(key => delete TARIFF_CACHE[key]);
}