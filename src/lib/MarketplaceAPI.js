import { base44 } from '@/api/base44Client';

/**
 * Получить данные товара с маркетплейса
 */
export async function fetchProductDataFromMarketplace(productId, marketplace = 'wildberries') {
  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Get current marketplace data for product. Return JSON with: current_price (float), stock (int), commission_pct (float), minimal_price (float).
      
Product ID: ${productId}
Marketplace: ${marketplace}

Return ONLY valid JSON object, no other text.`,
      response_json_schema: {
        type: 'object',
        properties: {
          current_price: { type: 'number', description: 'Текущая цена на маркетплейсе' },
          stock: { type: 'integer', description: 'Остаток товара' },
          commission_pct: { type: 'number', description: 'Комиссия маркетплейса в %' },
          minimal_price: { type: 'number', description: 'Минимальная рекомендуемая цена' }
        }
      },
      add_context_from_internet: true,
      model: 'gemini_3_flash'
    });
    
    return response;
  } catch (error) {
    console.error('Error fetching marketplace data:', error);
    throw error;
  }
}

/**
 * Получить информацию о товаре из базы данных
 */
export async function fetchProductFromDB(productId) {
  try {
    const product = await base44.entities.Product.read(productId);
    return product;
  } catch (error) {
    console.error('Error fetching product from DB:', error);
    return null;
  }
}

/**
 * Обновить данные товара с маркетплейса
 */
export async function updateProductWithMarketplaceData(productId) {
  const product = await fetchProductFromDB(productId);
  if (!product) throw new Error('Product not found');

  const marketplaceData = await fetchProductDataFromMarketplace(productId, 'wildberries');
  
  // Обновляем товар с новыми данными
  const updated = await base44.entities.Product.update(productId, {
    price: marketplaceData.current_price,
    wb_commission_pct: marketplaceData.commission_pct
  });

  // Сохраняем историю цены
  try {
    await base44.entities.PriceHistory.create({
      product_id: productId,
      date: new Date().toISOString(),
      our_price: marketplaceData.current_price,
      margin_pct: product.margin_pct || 0,
      cost: product.cogs_purchase || 0,
      competitors: []
    });
  } catch (e) {
    console.error('Error saving price history:', e);
  }

  return updated;
}

/**
 * Получить данные логистики для направления
 */
export async function fetchLogisticsData(marketplace = 'wildberries', direction = 'moscow') {
  try {
    const directories = await base44.entities.LogisticsDirectory.filter({
      source: marketplace,
      direction_id: direction
    });
    
    return directories.length > 0 ? directories[0] : null;
  } catch (error) {
    console.error('Error fetching logistics data:', error);
    return null;
  }
}

/**
 * Синхронизировать справочник логистики
 */
export async function syncLogisticsDirectory(marketplace = 'wildberries') {
  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Get current marketplace logistics tariffs and directions for ${marketplace}. Return JSON with array of directions.
      
Each direction object should have:
- direction_id (string): unique identifier
- direction_name (string): region name
- tariffs: { FBO: { base, per_kg, storage }, FBS: { base, per_kg, storage } }

Return ONLY valid JSON object with 'directions' array, no other text.`,
      response_json_schema: {
        type: 'object',
        properties: {
          directions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                direction_id: { type: 'string' },
                direction_name: { type: 'string' },
                tariffs: { type: 'object' }
              }
            }
          }
        }
      },
      add_context_from_internet: true,
      model: 'gemini_3_flash'
    });

    // Сохраняем в БД
    for (const dir of response.directions) {
      try {
        // Проверяем есть ли уже такое направление
        const existing = await base44.entities.LogisticsDirectory.filter({
          source: marketplace,
          direction_id: dir.direction_id
        });
        
        if (existing.length > 0) {
          await base44.entities.LogisticsDirectory.update(existing[0].id, {
            tariffs: dir.tariffs,
            synced_at: new Date().toISOString()
          });
        } else {
          await base44.entities.LogisticsDirectory.create({
            source: marketplace,
            direction_id: dir.direction_id,
            direction_name: dir.direction_name,
            tariffs: dir.tariffs,
            raw_data: dir,
            synced_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error(`Error saving direction ${dir.direction_id}:`, e);
      }
    }

    return response.directions;
  } catch (error) {
    console.error('Error syncing logistics directory:', error);
    throw error;
  }
}