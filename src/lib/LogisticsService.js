/**
 * Сервис управления логистикой и тарифами
 * Обрабатывает зависимости между схемой доставки, товаром, направлением и справочниками
 */

const TARIFF_CACHE = {}; // кешируем тарифы для быстрого доступа

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const roundMoney = (value) => Math.round(value * 100) / 100;

// Стандартные размеры европаллеты и плановая высота загруженной паллеты.
const STANDARD_PALLET_DIMENSIONS = {
  length_cm: 120,
  width_cm: 80,
  height_cm: 15,
  max_loaded_height_cm: 180,
};

/**
 * Рассчитать количество коробок на паллете на основе размеров коробки
 * @param {object} box - размеры коробки {size_length_cm, size_width_cm, size_height_cm}
 * @returns {number} - количество коробок на паллете
 */
export function calculateBoxesPerPallet(box = {}) {
  const boxLength = toNumber(box.size_length_cm ?? box.sizeLengthCm);
  const boxWidth = toNumber(box.size_width_cm ?? box.sizeWidthCm);
  const boxHeight = toNumber(box.size_height_cm ?? box.sizeHeightCm);

  if (!boxLength || !boxWidth || !boxHeight) return 0;

  const palletLength = toNumber(box.pallet_length_cm ?? box.palletLengthCm) || STANDARD_PALLET_DIMENSIONS.length_cm;
  const palletWidth = toNumber(box.pallet_width_cm ?? box.palletWidthCm) || STANDARD_PALLET_DIMENSIONS.width_cm;
  const palletHeight = toNumber(box.pallet_height_cm ?? box.palletHeightCm) || STANDARD_PALLET_DIMENSIONS.height_cm;
  const maxLoadedHeight = toNumber(box.max_loaded_height_cm ?? box.maxLoadedHeightCm) || STANDARD_PALLET_DIMENSIONS.max_loaded_height_cm;
  const usableHeight = Math.max(0, maxLoadedHeight - palletHeight);

  const boxesByBase = Math.max(
    Math.floor(palletLength / boxLength) * Math.floor(palletWidth / boxWidth),
    Math.floor(palletLength / boxWidth) * Math.floor(palletWidth / boxLength),
  );
  const tiers = Math.floor(usableHeight / boxHeight);

  return boxesByBase * tiers;
}

/**
 * Получить фиксированные размеры паллеты
 * @returns {object} - {length_cm, width_cm, height_cm}
 */
export function getPalletDimensions() {
  return { ...STANDARD_PALLET_DIMENSIONS };
}

export function getProductVolumeLiters(product = {}) {
  const length = toNumber(product.size_length_cm ?? product.sizeLengthCm);
  const width = toNumber(product.size_width_cm ?? product.sizeWidthCm);
  const height = toNumber(product.size_height_cm ?? product.sizeHeightCm);
  if (!length || !width || !height) return 0;
  return roundMoney((length * width * height) / 1000);
}

export function getBillableWeightKg(product = {}) {
  const weightKg = toNumber(product.weight_kg ?? product.weightKg);
  const volumeLiters = getProductVolumeLiters(product);
  const volumetricWeightKg = volumeLiters / 5;
  return roundMoney(Math.max(weightKg, volumetricWeightKg));
}

/**
 * Получить тарифы для товара и направления
 * @param {string} direction - направление доставки (moscow, spb и т.д.)
 * @param {string} mode - FBO или FBS
 * @param {object} directoriesMap - справочники из БД {source: {direction_id: {...}}}
 * @returns {object} - {base, per_kg, storage}
 */
export function getTariffs(direction, mode, directoriesMap = {}) {
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
    return tariff;
  }

  const cacheKey = `${direction}_${mode}_default`;
  if (TARIFF_CACHE[cacheKey]) {
    return TARIFF_CACHE[cacheKey];
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

  const weightKg = toNumber(product?.weight_kg ?? product?.weightKg);
  const volumeLiters = getProductVolumeLiters(product);
  const billableWeightKg = getBillableWeightKg(product);
  const baseCost = tariffs.base;
  const weightCost = Math.max(0, billableWeightKg - 0.05) * (tariffs.per_kg || 0); // первые 50г включены в базовую ставку

  return {
    base: baseCost,
    weightKg,
    volumeLiters,
    billableWeightKg,
    weight: roundMoney(weightCost),
    total: roundMoney(baseCost + weightCost),
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
  const weightKg = toNumber(product.weight_kg ?? product.weightKg);
  const volumeLiters = getProductVolumeLiters(product);
  if (mode === 'FBS' && (weightKg > 25 || volumeLiters > 25)) {
    restrictions.push('Товар тяжелее 25кг или больше 25л недоступен для FBS');
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
