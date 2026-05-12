import { apiRequest, base44 } from '@/api/base44Client';

/**
 * Получить данные товара с маркетплейса
 */
export async function fetchProductDataFromMarketplace(productId, marketplace = 'wildberries') {
  if (marketplace !== 'wildberries') {
    throw new Error(`Unsupported marketplace: ${marketplace}`);
  }

  const response = await apiRequest(`/wildberries/products/${encodeURIComponent(productId)}/sync`, {
    method: 'POST',
  });
  const mapped = response.mapped || {};

  return {
    ...mapped,
    current_price: mapped.current_price ?? mapped.sale_price ?? mapped.price ?? 0,
    stock: mapped.stock ?? response.product?.stock ?? 0,
    commission_pct: mapped.commission_pct,
    minimal_price: mapped.minimal_price ?? mapped.current_price ?? mapped.sale_price ?? mapped.price ?? 0,
    collection: response,
    persistence: response.persistence,
  };
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

  const response = await apiRequest(`/wildberries/products/${encodeURIComponent(productId)}/sync`, {
    method: 'POST',
  });

  return response.persistence?.product || {
    ...product,
    ...(response.mapped || {}),
  };
}

export async function fetchWbProductPreview(article, options = {}) {
  const normalized = String(article || '').trim();
  if (!normalized) throw new Error('WB article is required');
  const query = options.query
    ? `?query=${encodeURIComponent(options.query)}`
    : '';
  return apiRequest(`/wildberries/products/${encodeURIComponent(normalized)}/preview${query}`);
}

export async function enqueueWbProductCollection(payload) {
  return apiRequest('/wildberries/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listWbProductCollectionJobs(limit = 100) {
  return apiRequest(`/wildberries/jobs?limit=${encodeURIComponent(limit)}`);
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

export async function getWbSellerTokenMeta(clientId) {
  if (!clientId) return { hasToken: false };
  return apiRequest(`/wildberries/clients/${encodeURIComponent(clientId)}/seller-token`);
}

export async function setWbSellerToken(clientId, token) {
  if (!clientId) throw new Error('Client ID is required');
  return apiRequest(`/wildberries/clients/${encodeURIComponent(clientId)}/seller-token`, {
    method: 'PUT',
    body: JSON.stringify({ token }),
  });
}

/**
 * Синхронизировать справочник ПВЗ / складов WB через официальный Seller API.
 */
export async function syncLogisticsDirectory(marketplace = 'wildberries', options = {}) {
  if (marketplace !== 'wildberries') {
    throw new Error(`Unsupported logistics source: ${marketplace}`);
  }

  const clientId = options.clientId;
  if (!clientId) {
    throw new Error('Для синхронизации ПВЗ нужен клиент с WB Seller API token');
  }

  const response = await apiRequest(
    `/wildberries/clients/${encodeURIComponent(clientId)}/logistics-directions/sync`,
    { method: 'POST' },
  );

  return response.directions || [];
}

export async function syncWbCommissionDirectory(clientId) {
  if (!clientId) {
    throw new Error('Для синхронизации комиссий нужен клиент с WB Seller API token');
  }
  const response = await apiRequest(
    `/wildberries/clients/${encodeURIComponent(clientId)}/commission-directory/sync`,
    { method: 'POST' },
  );
  return response.items || [];
}
