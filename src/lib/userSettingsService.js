const STORAGE_PREFIX = 'velocis_user_settings';
const SCHEMA_VERSION = 1;

export const DEFAULT_USER_SETTINGS = {
  schemaVersion: SCHEMA_VERSION,
  notifications: {
    weeklyReports: true,
    marginAlerts: true,
    syncFailures: true,
    taskDigest: false,
  },
  ui: {
    compactMode: false,
    denseTables: true,
    showHints: true,
  },
  dashboard: {
    defaultPeriod: '30d',
    showDemoData: false,
  },
  updatedAt: null,
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || 'anonymous'}`;
}

function mergeSettings(settings) {
  return {
    ...DEFAULT_USER_SETTINGS,
    ...settings,
    notifications: {
      ...DEFAULT_USER_SETTINGS.notifications,
      ...(settings?.notifications || {}),
    },
    ui: {
      ...DEFAULT_USER_SETTINGS.ui,
      ...(settings?.ui || {}),
    },
    dashboard: {
      ...DEFAULT_USER_SETTINGS.dashboard,
      ...(settings?.dashboard || {}),
    },
  };
}

export function loadUserSettings(userId) {
  if (!canUseStorage()) {
    return DEFAULT_USER_SETTINGS;
  }

  const key = storageKey(userId);
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw);
    return mergeSettings(parsed);
  } catch (_error) {
    window.localStorage.removeItem(key);
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(userId, patch) {
  const nextSettings = mergeSettings({
    ...loadUserSettings(userId),
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(nextSettings));
  }

  return nextSettings;
}

