const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'base44:calculator:draft:v1:';

const hasStorage = () => (
  typeof window !== 'undefined'
  && window.sessionStorage
  && typeof window.sessionStorage.getItem === 'function'
);

const storageKey = (productId) => `${STORAGE_PREFIX}${productId}`;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeVersions = (versions) => {
  if (!Array.isArray(versions)) return [];
  return versions
    .filter(version => isPlainObject(version) && isPlainObject(version.form))
    .map((version, index) => ({
      name: typeof version.name === 'string' && version.name.trim()
        ? version.name
        : `Версия ${index + 1}`,
      form: { ...version.form },
    }));
};

export function loadCalculatorDraft(productId) {
  if (!productId || !hasStorage()) return null;

  const key = storageKey(productId);
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.version !== STORAGE_VERSION || parsed.productId !== productId) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    const versions = normalizeVersions(parsed.versions);
    if (versions.length === 0) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    const activeIdx = Number.isInteger(parsed.activeIdx)
      ? Math.min(Math.max(parsed.activeIdx, 0), versions.length - 1)
      : 0;

    return {
      productId,
      activeIdx,
      versions,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
    };
  } catch (_error) {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

/**
 * @param {string} productId
 * @param {{ versions?: Array<{ name?: string, form?: Record<string, any> }>, activeIdx?: number }} [state]
 */
export function saveCalculatorDraft(productId, { versions = [], activeIdx = 0 } = {}) {
  if (!productId || !hasStorage()) return;

  const normalizedVersions = normalizeVersions(versions);
  if (normalizedVersions.length === 0) return;

  const payload = {
    version: STORAGE_VERSION,
    productId,
    activeIdx: Math.min(Math.max(activeIdx, 0), normalizedVersions.length - 1),
    versions: normalizedVersions,
    savedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(storageKey(productId), JSON.stringify(payload));
  } catch (_error) {
    // Черновик не критичен для расчета: при переполненном хранилище продолжаем работу без сохранения.
  }
}

export function removeCalculatorDraft(productId) {
  if (!productId || !hasStorage()) return;
  window.sessionStorage.removeItem(storageKey(productId));
}
