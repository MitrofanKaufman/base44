import { base44 } from '@/api/base44Client';

const WB_API_STATISTIC_URL = 'https://api.wb.ru/api/v1/supplier';
const WB_API_CONTENT_URL = 'https://api.wb.ru/api/v1/upload/basket';
const WB_API_CARDS_URL = 'https://api.common.wildberries.ru/api/v4';

/**
 * Сервис синхронизации данных из Wildberries
 */
export class WildberriesSync {
  /**
   * Получить все активные клиенты с WB токенами
   */
  static async getClientsWithWBTokens() {
    try {
      const clients = await base44.entities.Client.list();
      return clients.filter(c => c.wb_api_token && c.status === 'active');
    } catch (error) {
      console.error('❌ Ошибка при получении клиентов:', error);
      return [];
    }
  }

  /**
   * Синхронизировать данные по продажам для клиента
   */
  static async syncSalesData(client) {
    if (!client.wb_api_token) {
      console.warn(`⚠️ Клиент ${client.name} не имеет WB токена`);
      return { success: false, count: 0 };
    }

    try {
      const projects = await base44.entities.Project.filter({ client_id: client.id });
      let totalInserted = 0;

      for (const project of projects) {
        const products = await base44.entities.Product.filter({
          project_id: project.id,
          status: 'active',
        });

        for (const product of products) {
          const salesData = await this.fetchSalesForSKU(
            client.wb_api_token,
            product.wb_sku,
            7 // последние 7 дней
          );

          if (salesData) {
            try {
              await base44.entities.SalesData.create({
                product_id: product.id,
                period_start: salesData.period_start,
                period_end: salesData.period_end,
                units_sold: salesData.units_sold,
                revenue: salesData.revenue,
                cogs: salesData.cogs,
                profit: salesData.profit,
                margin_pct: salesData.margin_pct,
                avg_price: salesData.avg_price,
                source: 'wildberries',
              });
              totalInserted++;
            } catch (createError) {
              console.error(`Ошибка создания SalesData для ${product.wb_sku}:`, createError);
            }
          }
        }
      }

      console.log(`✅ Синхронизировано ${totalInserted} записей продаж для ${client.name}`);
      return { success: true, count: totalInserted };
    } catch (error) {
      console.error(`❌ Ошибка синхронизации продаж для ${client.name}:`, error);
      return { success: false, count: 0, error };
    }
  }

  /**
   * Синхронизировать цены и остатки
   */
  static async syncPricesAndStocks(client) {
    if (!client.wb_api_token) {
      console.warn(`⚠️ Клиент ${client.name} не имеет WB токена`);
      return { success: false, count: 0 };
    }

    try {
      const projects = await base44.entities.Project.filter({ client_id: client.id });
      let totalUpdated = 0;

      for (const project of projects) {
        const products = await base44.entities.Product.filter({
          project_id: project.id,
          status: 'active',
        });

        for (const product of products) {
          const priceData = await this.fetchPriceAndStock(
            client.wb_api_token,
            product.wb_sku
          );

          if (priceData) {
            try {
              // Обновляем товар
              await base44.entities.Product.update(product.id, {
                price: priceData.price,
                sale_price: priceData.sale_price,
                discount_pct: priceData.discount_pct,
              });

              // Сохраняем историю цен
              await base44.entities.PriceHistory.create({
                product_id: product.id,
                date: new Date().toISOString(),
                our_price: priceData.price,
                cost: product.cost || 0,
                margin_pct: product.cost
                  ? ((priceData.price - product.cost) / priceData.price) * 100
                  : 0,
                competitors: priceData.competitors || [],
              });

              totalUpdated++;
            } catch (updateError) {
              console.error(`Ошибка обновления цены для ${product.wb_sku}:`, updateError);
            }
          }
        }
      }

      console.log(`✅ Обновлены цены и остатки для ${totalUpdated} товаров (${client.name})`);
      return { success: true, count: totalUpdated };
    } catch (error) {
      console.error(`❌ Ошибка синхронизации цен для ${client.name}:`, error);
      return { success: false, count: 0, error };
    }
  }

  /**
   * Получить данные по продажам SKU из WB
   * @param {string} apiToken - WB API токен
   * @param {string} sku - WB SKU / vendorCode
   * @param {number} days - Количество дней назад
   */
  static async fetchSalesForSKU(apiToken, sku, days = 7) {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const response = await fetch(
        `${WB_API_STATISTIC_URL}/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`WB API ошибка (${response.status}):`, response.statusText);
        return null;
      }

      const data = await response.json();
      const sales = data.data?.records || [];

      // Фильтруем по SKU
      const skuSales = sales.filter(s => s.vendorCode === sku || s.nmId?.toString() === sku);

      if (skuSales.length === 0) {
        return null;
      }

      // Агрегируем данные
      const totalUnits = skuSales.reduce((s, item) => s + (item.quantityFinal || 0), 0);
      const totalRevenue = skuSales.reduce((s, item) => s + (item.priceProduct || 0) * (item.quantityFinal || 0), 0);
      const avgPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;

      return {
        period_start: new Date(dateFrom).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        units_sold: totalUnits,
        revenue: totalRevenue,
        cogs: 0, // Заполняется отдельно
        profit: totalRevenue,
        margin_pct: 0,
        avg_price: avgPrice,
      };
    } catch (error) {
      console.error(`Ошибка fetch sales для ${sku}:`, error);
      return null;
    }
  }

  /**
   * Получить текущую цену и остатки SKU
   */
  static async fetchPriceAndStock(apiToken, sku) {
    try {
      // Используем cards API для получения информации о товаре
      const response = await fetch(
        `${WB_API_CARDS_URL}/cards/list?search=${sku}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`WB Cards API ошибка (${response.status}):`, response.statusText);
        return null;
      }

      const data = await response.json();
      const card = data.data?.cards?.[0];

      if (!card) {
        return null;
      }

      const price = card.sizes?.[0]?.price?.basic / 100 || 0; // WB возвращает цену в копейках
      const salePrice = card.sizes?.[0]?.price?.product / 100 || price;
      const discountPct = price > 0 ? ((price - salePrice) / price) * 100 : 0;

      return {
        price,
        sale_price: salePrice,
        discount_pct: discountPct,
        stock: card.sizes?.[0]?.stocks?.present || 0,
        competitors: [], // WB API не предоставляет прямые данные конкурентов
      };
    } catch (error) {
      console.error(`Ошибка fetch price для ${sku}:`, error);
      return null;
    }
  }

  /**
   * Запустить полную синхронизацию всех данных
   */
  static async syncAll() {
    console.log('🔄 Запуск полной синхронизации WB данных...');

    try {
      const clients = await this.getClientsWithWBTokens();

      if (clients.length === 0) {
        console.log('⚠️ Нет клиентов с WB токенами для синхронизации');
        return { total_clients: 0, total_sales: 0, total_prices: 0 };
      }

      let totalSales = 0;
      let totalPrices = 0;

      for (const client of clients) {
        const salesResult = await this.syncSalesData(client);
        const pricesResult = await this.syncPricesAndStocks(client);

        totalSales += salesResult.count || 0;
        totalPrices += pricesResult.count || 0;
      }

      console.log(
        `✅ Синхронизация завершена: ${totalSales} продаж, ${totalPrices} цен для ${clients.length} клиентов`
      );

      return {
        total_clients: clients.length,
        total_sales: totalSales,
        total_prices: totalPrices,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Критическая ошибка синхронизации:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Проверить статус синхронизации
   */
  static async getStatus() {
    try {
      const clients = await this.getClientsWithWBTokens();
      return {
        status: 'ok',
        clients_with_tokens: clients.length,
        last_check: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}

export default WildberriesSync;