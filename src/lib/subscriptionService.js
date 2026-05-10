import { base44 } from '@/api/base44Client';

// Предопределённые пакеты
export const DEFAULT_SUBSCRIPTIONS = [
  {
    name: 'Базовый',
    slug: 'basic',
    description: 'Только свои товары',
    price_monthly: 0,
    price_annual: 0,
    is_default: true,
    is_locked: true,
    features: ['own_products', 'unit_economics', 'basic_analytics'],
    limits: {
      products_count: 50,
      projects_count: 3,
      calculations_per_month: 100,
      api_calls_per_day: 100,
      manual_price_updates_per_day: 50,
      competitors_per_product: 0
    },
    position: 1
  },
  {
    name: 'Стандарт',
    slug: 'standard',
    description: 'Свои товары + анализ конкурентов',
    price_monthly: 2990,
    price_annual: 29900,
    is_default: false,
    is_locked: false,
    features: [
      'own_products',
      'competitor_products',
      'unit_economics',
      'basic_analytics',
      'price_history',
      'competitor_comparison',
      'abc_analysis'
    ],
    limits: {
      products_count: 200,
      projects_count: 10,
      calculations_per_month: 500,
      api_calls_per_day: 500,
      manual_price_updates_per_day: 200,
      competitors_per_product: 5
    },
    position: 2
  },
  {
    name: 'Стандарт+',
    slug: 'standard_plus',
    description: 'Стандарт + автоматизация и уведомления',
    price_monthly: 4990,
    price_annual: 49900,
    is_default: false,
    is_locked: false,
    features: [
      'own_products',
      'competitor_products',
      'unit_economics',
      'basic_analytics',
      'price_history',
      'competitor_comparison',
      'abc_analysis',
      'automated_price_updates',
      'scheduled_tasks',
      'alerts_notifications',
      'margin_monitoring'
    ],
    limits: {
      products_count: 500,
      projects_count: 25,
      calculations_per_month: 2000,
      api_calls_per_day: 2000,
      manual_price_updates_per_day: 500,
      competitors_per_product: 10
    },
    position: 3
  },
  {
    name: 'Максимум',
    slug: 'maximum',
    description: 'Все функции (кроме администрирования)',
    price_monthly: 9990,
    price_annual: 99900,
    is_default: false,
    is_locked: false,
    features: [
      'own_products',
      'competitor_products',
      'unit_economics',
      'advanced_analytics',
      'price_history',
      'competitor_comparison',
      'abc_analysis',
      'automated_price_updates',
      'scheduled_tasks',
      'alerts_notifications',
      'margin_monitoring',
      'marketplace_sync',
      'custom_reports',
      'api_access',
      'ai_recommendations'
    ],
    limits: {
      products_count: 10000,
      projects_count: 100,
      calculations_per_month: 10000,
      api_calls_per_day: 10000,
      manual_price_updates_per_day: 2000,
      competitors_per_product: 50
    },
    position: 4
  }
];

// Предопределённые функции
export const DEFAULT_FEATURES = [
  // Products category
  {
    name: 'Управление своими товарами',
    slug: 'own_products',
    category: 'products',
    description: 'Добавление и управление товарами на собственных маркетплейсах',
    requires_subscription: true,
    position: 1
  },
  {
    name: 'Анализ конкурентных товаров',
    slug: 'competitor_products',
    category: 'products',
    description: 'Импорт и отслеживание товаров конкурентов',
    requires_subscription: true,
    position: 2
  },
  
  // Analytics category
  {
    name: 'Юнит-экономика',
    slug: 'unit_economics',
    category: 'analytics',
    description: 'Расчёт себестоимости, маржи и прибыльности товаров',
    requires_subscription: true,
    position: 1
  },
  {
    name: 'Базовая аналитика',
    slug: 'basic_analytics',
    category: 'analytics',
    description: 'Основные метрики и графики продаж',
    requires_subscription: true,
    position: 2
  },
  {
    name: 'Продвинутая аналитика',
    slug: 'advanced_analytics',
    category: 'analytics',
    description: 'Детальный анализ, тренды, прогнозы',
    requires_subscription: true,
    is_premium: true,
    position: 3
  },
  {
    name: 'История цен',
    slug: 'price_history',
    category: 'analytics',
    description: 'Отслеживание изменения цен во времени',
    requires_subscription: true,
    position: 4
  },
  {
    name: 'Сравнение с конкурентами',
    slug: 'competitor_comparison',
    category: 'analytics',
    description: 'Сравнение цен, маржи и метрик с конкурентами',
    requires_subscription: true,
    position: 5
  },
  {
    name: 'ABC-анализ',
    slug: 'abc_analysis',
    category: 'analytics',
    description: 'Классификация товаров по важности (ABC)',
    requires_subscription: true,
    position: 6
  },
  {
    name: 'Пользовательские отчёты',
    slug: 'custom_reports',
    category: 'analytics',
    description: 'Создание и экспорт собственных отчётов',
    requires_subscription: true,
    is_premium: true,
    position: 7
  },

  // Automation category
  {
    name: 'Автоматизация обновления цен',
    slug: 'automated_price_updates',
    category: 'automation',
    description: 'Автоматическое обновление цен на основе правил',
    requires_subscription: true,
    position: 1
  },
  {
    name: 'Запланированные задачи',
    slug: 'scheduled_tasks',
    category: 'automation',
    description: 'Создание и управление автоматизированными задачами',
    requires_subscription: true,
    position: 2
  },
  {
    name: 'Уведомления и алерты',
    slug: 'alerts_notifications',
    category: 'automation',
    description: 'Оповещение об изменениях маржи, цен, конкурентов',
    requires_subscription: true,
    position: 3
  },
  {
    name: 'Мониторинг маржинальности',
    slug: 'margin_monitoring',
    category: 'automation',
    description: 'Отслеживание падения маржи и автоматические действия',
    requires_subscription: true,
    position: 4
  },

  // Integrations category
  {
    name: 'Синхронизация маркетплейсов',
    slug: 'marketplace_sync',
    category: 'integrations',
    description: 'Синхронизация данных с Wildberries, Ozon, Яндекс',
    requires_subscription: true,
    is_premium: true,
    position: 1
  },
  {
    name: 'API доступ',
    slug: 'api_access',
    category: 'integrations',
    description: 'Доступ к REST API для интеграции с внешними системами',
    requires_subscription: true,
    is_premium: true,
    position: 2
  },

  // Admin category (не включены в пакеты)
  {
    name: 'Администрирование приложения',
    slug: 'admin_panel',
    category: 'admin',
    description: 'Доступ к администраторской панели',
    requires_subscription: false,
    position: 1
  },
  {
    name: 'AI рекомендации',
    slug: 'ai_recommendations',
    category: 'admin',
    description: 'AI-помощь в принятии решений по ценообразованию',
    requires_subscription: true,
    is_premium: true,
    position: 2
  }
];

/**
 * Инициализирует стандартные пакеты подписок
 */
export async function initializeDefaultSubscriptions() {
  try {
    const existing = await base44.entities.Subscription.list();
    
    // Если подписки уже созданы, не создаём их повторно
    if (existing.length > 0) {
      return existing;
    }

    const created = await base44.entities.Subscription.bulkCreate(DEFAULT_SUBSCRIPTIONS);
    console.log('✅ Инициализированы пакеты подписок:', created.length);
    return created;
  } catch (error) {
    console.error('❌ Ошибка инициализации подписок:', error);
  }
}

/**
 * Инициализирует стандартные функции
 */
export async function initializeDefaultFeatures() {
  try {
    const existing = await base44.entities.Feature.list();
    
    if (existing.length > 0) {
      return existing;
    }

    const created = await base44.entities.Feature.bulkCreate(DEFAULT_FEATURES);
    console.log('✅ Инициализированы функции:', created.length);
    return created;
  } catch (error) {
    console.error('❌ Ошибка инициализации функций:', error);
  }
}

/**
 * Получает активную подписку пользователя
 */
export async function getUserSubscription(userEmail) {
  try {
    const userSubs = await base44.entities.UserSubscription.filter({
      user_email: userEmail,
      status: 'active'
    });

    if (userSubs.length === 0) {
      // Возвращаем базовый пакет по умолчанию
      const basicSub = await base44.entities.Subscription.filter({ slug: 'basic' });
      return basicSub[0];
    }

    const subscription = await base44.entities.Subscription.list();
    return subscription.find(s => s.id === userSubs[0].subscription_id);
  } catch (error) {
    console.error('❌ Ошибка получения подписки:', error);
    return null;
  }
}

/**
 * Проверяет доступ к функции
 */
export async function hasFeatureAccess(userEmail, featureSlug) {
  try {
    const subscription = await getUserSubscription(userEmail);
    if (!subscription) return featureSlug === 'admin_panel'; // Only admins have access

    return subscription.features?.includes(featureSlug) ?? false;
  } catch (error) {
    console.error('❌ Ошибка проверки доступа:', error);
    return false;
  }
}

/**
 * Проверяет лимит действия
 */
export async function checkActionLimit(userEmail, limitKey, currentUsage) {
  try {
    const subscription = await getUserSubscription(userEmail);
    if (!subscription) return false;

    const limit = subscription.limits?.[limitKey];
    return currentUsage < limit;
  } catch (error) {
    console.error('❌ Ошибка проверки лимита:', error);
    return false;
  }
}

/**
 * Получает оставшуюся квоту
 */
export async function getRemainingQuota(userEmail, limitKey, currentUsage) {
  try {
    const subscription = await getUserSubscription(userEmail);
    if (!subscription) return 0;

    const limit = subscription.limits?.[limitKey] ?? 0;
    return Math.max(0, limit - currentUsage);
  } catch (error) {
    console.error('❌ Ошибка получения квоты:', error);
    return 0;
  }
}