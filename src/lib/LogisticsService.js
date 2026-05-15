/**
 * Сервис управления логистикой и тарифами
 * Обрабатывает зависимости между схемой доставки, товаром, направлением и справочниками
 */

/**
 * Кеш тарифов для быстрого доступа
 * @type {Object<string, Object>}
 */
const TARIFF_CACHE = {}; // кешируем тарифы для быстрого доступа

/**
 * Преобразует значение в число, возвращает 0 для невалидных значений
 * @param {*} value - Значение для преобразования
 * @returns {number} Число или 0
 */
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Округляет денежное значение до 2 знаков
 * @param {number} value - Значение для округления
 * @returns {number} Округленное значение
 */
const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Нормализует режим выполнения заказа
 * @param {string} mode - Режим выполнения
 * @returns {string} 'FBS' или 'FBO'
 */
const normalizeFulfillmentMode = (mode) => (mode === 'FBS' ? 'FBS' : 'FBO');

/**
 * Нормализует режим упаковки
 * @param {string} mode - Режим упаковки
 * @returns {string} 'pallet' или 'box'
 */
const normalizePackageMode = (mode) => (mode === 'pallet' ? 'pallet' : 'box');

/**
 * Возвращает первое определенное значение из списка
 * @param {...*} values - Список значений
 * @returns {*} Первое валидное значение или undefined
 */
const pickFirst = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

/**
 * Проверяет, является ли значение объектом
 * @param {*} value - Значение для проверки
 * @returns {boolean} true, если это объект
 */
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

/**
 * Проверяет, является ли значение листом тарифа
 * @param {*} value - Значение для проверки
 * @returns {boolean} true, если это лист тарифа
 */
const isTariffLeaf = (value) => (
  isObject(value)
  && (
    value.base !== undefined
    || value.per_kg !== undefined
    || value.perKg !== undefined
    || value.per_liter !== undefined
    || value.perLiter !== undefined
    || value.storage !== undefined
    || value.boxDeliveryBase !== undefined
    || value.boxDeliveryMarketplaceBase !== undefined
    || value.palletDeliveryValueBase !== undefined
    || value.boxStorageBase !== undefined
    || value.palletStorageValueExpr !== undefined
  )
);

/**
 * Нормализует тариф к единому формату
 * @param {Object} tariff - Исходный тариф
 * @param {string} source - Источник тарифа
 * @param {string} packageMode - Режим упаковки
 * @returns {Object} Нормализованный тариф
 */
const normalizeTariff = (tariff, source, packageMode) => {
  const isPallet = packageMode === 'pallet';
  const hasPerUnitPalletValue = isPallet && (
    tariff?.palletDeliveryValueBase !== undefined
    || tariff?.palletDeliveryValueLiter !== undefined
  );

  return {
    base: toNumber(pickFirst(
      tariff?.base,
      tariff?.base_rub,
      tariff?.baseRub,
      isPallet ? tariff?.palletDeliveryValueBase : undefined,
      !isPallet ? tariff?.boxDeliveryBase : undefined,
      !isPallet ? tariff?.boxDeliveryMarketplaceBase : undefined,
    )),
    per_kg: toNumber(pickFirst(tariff?.per_kg, tariff?.perKg)),
    per_liter: toNumber(pickFirst(
      tariff?.per_liter,
      tariff?.perLiter,
      isPallet ? tariff?.palletDeliveryValueLiter : undefined,
      !isPallet ? tariff?.boxDeliveryLiter : undefined,
      !isPallet ? tariff?.boxDeliveryMarketplaceLiter : undefined,
    )),
    storage: toNumber(pickFirst(
      tariff?.storage,
      tariff?.storage_rub,
      tariff?.storageRub,
      isPallet ? tariff?.palletStorageValueExpr : undefined,
    )),
    storage_base: toNumber(pickFirst(
      tariff?.storage_base,
      tariff?.storageBase,
      !isPallet ? tariff?.boxStorageBase : undefined,
    )),
    storage_per_liter: toNumber(pickFirst(
      tariff?.storage_per_liter,
      tariff?.storagePerLiter,
      !isPallet ? tariff?.boxStorageLiter : undefined,
    )),
    source,
    packageMode,
    allocation: pickFirst(tariff?.allocation, tariff?.allocation_basis, tariff?.allocationBasis)
      || (hasPerUnitPalletValue ? 'unit' : 'package'),
  };
};

/**
 * Разрешает вариант тарифа из структуры тарифов
 * @param {Object} tariffs - Структура тарифов
 * @param {string} mode - Режим выполнения
 * @param {string} packageMode - Режим упаковки
 * @param {string} palletType - Тип паллеты
 * @returns {Object|null} Найденный тариф или null
 */
const resolveTariffVariant = (tariffs, mode, packageMode, palletType) => {
  if (!isObject(tariffs)) return null;

  const modeTariffs = tariffs[mode];
  const packageTariffs = tariffs[packageMode];
  const modePackageKey = `${mode}_${packageMode}`;
  const lowerModePackageKey = `${mode.toLowerCase()}_${packageMode}`;
  const packageModeKey = `${packageMode}_${mode}`;
  const lowerPackageModeKey = `${packageMode}_${mode.toLowerCase()}`;
  const candidates = [
    modeTariffs?.[packageMode]?.[palletType],
    modeTariffs?.[packageMode],
    packageTariffs?.[mode]?.[palletType],
    packageTariffs?.[mode],
    tariffs[modePackageKey]?.[palletType],
    tariffs[modePackageKey],
    tariffs[lowerModePackageKey]?.[palletType],
    tariffs[lowerModePackageKey],
    tariffs[packageModeKey]?.[palletType],
    tariffs[packageModeKey],
    tariffs[lowerPackageModeKey]?.[palletType],
    tariffs[lowerPackageModeKey],
    modeTariffs,
  ];

  return candidates.find(isTariffLeaf) || null;
};

/**
 * Стандартные размеры европаллеты и плановая высота загруженной паллеты
 * @constant {Object}
 */
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

/**
 * Вычисляет объем товара в литрах
 * @param {Object} product - Данные товара
 * @returns {number} Объем в литрах
 */
export function getProductVolumeLiters(product = {}) {
  const length = toNumber(product.size_length_cm ?? product.sizeLengthCm);
  const width = toNumber(product.size_width_cm ?? product.sizeWidthCm);
  const height = toNumber(product.size_height_cm ?? product.sizeHeightCm);
  if (!length || !width || !height) return 0;
  return roundMoney((length * width * height) / 1000);
}

/**
 * Вычисляет оплачиваемый вес товара (максимум из физического и объемного)
 * @param {Object} product - Данные товара
 * @returns {number} Оплачиваемый вес в кг
 */
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
export function getTariffs(direction, mode, directoriesMap = {}, options = {}) {
  const normalizedMode = normalizeFulfillmentMode(mode);
  const optionBag = typeof options === 'object' && options
    ? /** @type {Record<string, any>} */ (options)
    : {};
  const packageMode = normalizePackageMode(
    typeof options === 'string'
      ? options
      : pickFirst(optionBag.packageMode, optionBag.package_mode, optionBag.wbTariffMode, optionBag.wb_tariff_mode),
  );
  const palletType = pickFirst(optionBag.palletType, optionBag.pallet_type, optionBag.wbPalletType, optionBag.wb_pallet_type);

  // Поиск в справочниках WB
  const wbDir = (directoriesMap.wildberries || []).find(
    d => d.direction_id === direction
  );
  const tariffVariant = resolveTariffVariant(wbDir?.tariffs, normalizedMode, packageMode, palletType);

  if (tariffVariant) {
    return normalizeTariff(tariffVariant, 'wildberries', packageMode);
  }

  const cacheKey = `${direction}_${normalizedMode}_${packageMode}_default`;
  if (TARIFF_CACHE[cacheKey]) {
    return TARIFF_CACHE[cacheKey];
  }

  // Fallback по умолчанию
  const defaults = {
    'FBO': { base: 45, per_kg: 1.5, storage: 8, source: 'default' },
    'FBS': { base: 30, per_kg: 0.8, storage: 5, source: 'default' }
  };

  const tariff = {
    ...(defaults[normalizedMode] || defaults['FBO']),
    packageMode,
  };
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
  const packageMode = normalizePackageMode(
    pickFirst(product?.package_mode, product?.packageMode, product?.wb_tariff_mode, product?.wbTariffMode),
  );
  const tariffs = getTariffs(direction, mode, directoriesMap, {
    packageMode,
    palletType: pickFirst(product?.wb_pallet_type, product?.wbPalletType),
  });

  const weightKg = toNumber(product?.weight_kg ?? product?.weightKg);
  const volumeLiters = getProductVolumeLiters(product);
  const billableWeightKg = getBillableWeightKg(product);
  const boxesPerPallet = packageMode === 'pallet'
    ? Math.max(1, Math.floor(toNumber(product?.wb_boxes_per_pallet ?? product?.wbBoxesPerPallet) || calculateBoxesPerPallet(product)))
    : 1;
  const tariffBillableWeightKg = packageMode === 'pallet'
    ? billableWeightKg * boxesPerPallet
    : billableWeightKg;
  const baseCost = tariffs.base;
  const weightCost = tariffs.per_liter > 0
    ? Math.max(volumeLiters - 1, 0) * tariffs.per_liter
    : Math.max(0, tariffBillableWeightKg - 0.05) * (tariffs.per_kg || 0); // первые 50г включены в базовую ставку
  const storageCost = tariffs.storage_base > 0 || tariffs.storage_per_liter > 0
    ? tariffs.storage_base + Math.max(volumeLiters - 1, 0) * tariffs.storage_per_liter
    : tariffs.storage;
  const allocationFactor = packageMode === 'pallet' && tariffs.allocation !== 'unit' ? boxesPerPallet : 1;

  return {
    base: roundMoney(baseCost / allocationFactor),
    weightKg,
    volumeLiters,
    billableWeightKg,
    tariffBillableWeightKg: roundMoney(tariffBillableWeightKg),
    boxesPerPallet: packageMode === 'pallet' ? boxesPerPallet : undefined,
    weight: roundMoney(weightCost / allocationFactor),
    total: roundMoney((baseCost + weightCost) / allocationFactor),
    storage: roundMoney((storageCost || 0) / allocationFactor),
    source: tariffs.source,
    packageMode: tariffs.packageMode || packageMode,
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
