import { base44 } from '@/api/base44Client';
import { SyncScheduler } from './SyncScheduler';
import { fetchProductDataFromMarketplace, syncLogisticsDirectory } from '@/lib/MarketplaceAPI';

/**
 * Фоновая синхронизация данных маркетплейсов
 * Запускается при инициализации приложения
 */
export class BackgroundSyncService {
  static instance = null;
  static syncIntervals = {};

  static getInstance() {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  /**
   * Запустить фоновую синхронизацию
   */
  static start() {
    const instance = BackgroundSyncService.getInstance();
    instance.startLogisticsSyncInterval();
    instance.startProductSyncInterval();
    instance.startWildberriesSyncInterval();
  }

  /**
   * Синхронизировать логистику каждый час
   */
  static startLogisticsSyncInterval() {
    // Первая синхронизация через 30 сек
    setTimeout(() => {
      BackgroundSyncService.syncLogistics();
    }, 30000);

    // Затем каждый час
    const interval = setInterval(() => {
      BackgroundSyncService.syncLogistics();
    }, 3600000);

    BackgroundSyncService.syncIntervals.logistics = interval;
  }

  /**
   * Синхронизировать товары каждые 15 минут
   */
  static startProductSyncInterval() {
    // Первая синхронизация через 1 минуту
    setTimeout(() => {
      BackgroundSyncService.syncActiveProducts();
    }, 60000);

    // Затем каждые 15 минут
    const interval = setInterval(() => {
      BackgroundSyncService.syncActiveProducts();
    }, 900000);

    BackgroundSyncService.syncIntervals.products = interval;
  }

  /**
   * Синхронизировать логистику для всех маркетплейсов
   */
  static async syncLogistics() {
    try {
      const marketplaces = ['wildberries', 'yandex', 'ozon'];
      
      for (const marketplace of marketplaces) {
        try {
          await syncLogisticsDirectory(marketplace);
          console.log(`✓ Logistics synced for ${marketplace}`);
        } catch (e) {
          console.error(`✗ Failed to sync ${marketplace} logistics:`, e);
        }
      }
    } catch (error) {
      console.error('Logistics sync failed:', error);
    }
  }

  /**
   * Синхронизировать активные товары
   */
  static async syncActiveProducts() {
    try {
      const products = await base44.entities.Product.filter({ status: 'active' }, '-updated_date', 50);
      
      if (!products.length) return;

      console.log(`Syncing ${products.length} products...`);

      for (const product of products) {
        try {
          const marketplaceData = await fetchProductDataFromMarketplace(product.id, 'wildberries');
          
          // Обновляем цену и комиссию
          await base44.entities.Product.update(product.id, {
            price: marketplaceData.current_price,
            wb_commission_pct: marketplaceData.commission_pct,
            last_synced_at: new Date().toISOString()
          });

          // Сохраняем историю цены
          try {
            await base44.entities.PriceHistory.create({
              product_id: product.id,
              date: new Date().toISOString(),
              our_price: marketplaceData.current_price,
              margin_pct: ((marketplaceData.current_price - (product.cogs_purchase || 0)) / marketplaceData.current_price * 100) || 0,
              cost: product.cogs_purchase || 0,
              competitors: []
            });
          } catch (e) {
            // Ошибка при сохранении истории не критична
          }

          console.log(`✓ Synced ${product.name}`);
        } catch (e) {
          console.error(`✗ Failed to sync ${product.name}:`, e.message);
        }

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('Product sync completed');
    } catch (error) {
      console.error('Product sync failed:', error);
    }
  }

  /**
   * Синхронизировать данные Wildberries API каждые 30 минут
   */
  static startWildberriesSyncInterval() {
    // Инициализируем SyncScheduler с интервалом 30 минут
    SyncScheduler.init(30);
  }

  /**
   * Остановить все интервалы
   */
  static stop() {
    Object.values(BackgroundSyncService.syncIntervals).forEach(interval => {
      clearInterval(interval);
    });
    BackgroundSyncService.syncIntervals = {};
    SyncScheduler.stop();
  }
}