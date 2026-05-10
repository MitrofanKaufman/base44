import { base44 } from '@/api/base44Client';
import { CollectionRunPipelineService } from './CollectionRunPipelineService';

/**
 * Тестовый запуск Collection Runner для товара
 */
export async function testCollectionRunnerForProduct(productId) {
  try {
    console.log(`🚀 Запуск тестового прогона для товара ${productId}...`);
    
    const request = {
      marketplace: 'wildberries',
      mode: 'product',
      productIds: [String(productId)],
      includeFeedbacks: false,
      includeQuestions: false,
      includeSearch: false,
      includeUnitEconomics: true,
      dryRun: false,
      forceRefresh: true,
      concurrencyLimit: 1,
      timeoutMs: 30000,
    };

    // Запустить pipeline
    const runId = await CollectionRunPipelineService.start(request);
    console.log(`✅ Прогон запущен: ${runId}`);
    
    // Получить статус
    const run = await base44.entities.IngestionRun.list('created_date', 1);
    if (run.length > 0) {
      console.log('📊 Статус:', run[0]);
    }
    
    return runId;
  } catch (error) {
    console.error('❌ Ошибка при запуске прогона:', error.message);
    throw error;
  }
}

// Для конsolе — можно вызвать как:
// await testCollectionRunnerForProduct(286175495)