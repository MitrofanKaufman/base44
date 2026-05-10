import { base44 } from '@/api/base44Client';
import { DEFAULT_SUBSCRIPTIONS, DEFAULT_FEATURES } from '@/lib/subscriptionService';

/**
 * Инициализирует пакеты подписок и функции при первом запуске
 */
export async function initializeSubscriptions() {
  try {
    console.log('🔄 Инициализация системы подписок...');

    // Проверяем существующие подписки
    const existingSubs = await base44.entities.Subscription.list();
    
    if (existingSubs.length === 0) {
      console.log('📦 Создание пакетов подписок...');
      await base44.entities.Subscription.bulkCreate(DEFAULT_SUBSCRIPTIONS);
      console.log('✅ Пакеты подписок созданы');
    } else {
      console.log(`✅ Пакеты подписок уже существуют (${existingSubs.length})`);
    }

    // Проверяем существующие функции
    const existingFeatures = await base44.entities.Feature.list();
    
    if (existingFeatures.length === 0) {
      console.log('🎯 Создание функций...');
      await base44.entities.Feature.bulkCreate(DEFAULT_FEATURES);
      console.log('✅ Функции созданы');
    } else {
      console.log(`✅ Функции уже существуют (${existingFeatures.length})`);
    }

    // Удаляем старые UserSubscription таблицы если пусты
    const existingUserSubs = await base44.entities.UserSubscription.list();
    console.log(`📊 Активных подписок пользователей: ${existingUserSubs.length}`);

  } catch (error) {
    console.error('❌ Ошибка инициализации подписок:', error);
  }
}