# Чек-лист интеграции маркетплейс-ядра

## Pre-Launch

- [ ] **Upgrade to Builder+** — для создания backend function
- [ ] **Set HMAC Secret** → `INGESTION_SECRET` в env vars
- [ ] **Create backend function** `ingestion-receive.ts` (см. MARKETPLACE_CORE_README.md)
- [ ] **Test HMAC verification** через Admin Dashboard → Swagger tab
- [ ] **Verify all 8 entities** созданы и видны в Entity Manager

## Admin Dashboard

- [ ] **Access /admin** с администраторским аккаунтом
- [ ] **Overview tab** показывает статистику (может быть 0 событий)
- [ ] **Documentation tab** содержит 6 разделов
- [ ] **Swagger tab** выводит OpenAPI spec
- [ ] **Raw Frames tab** пуст (сработает после первого события)
- [ ] **Dead Letters tab** пуст (или показывает первые ошибки)
- [ ] **Snapshots tab** пуст до обработки product.update
- [ ] **Settings tab** показывает HMAC и синхронизацию

## Backend Function

- [ ] **Создана функция** `/functions/ingestion-receive`
- [ ] **Использует HmacSignatureVerifier** для проверки подписи
- [ ] **Использует WbPayloadHasher** для детерминированного хеша
- [ ] **Сохраняет RawMarketplaceFrame** с `processingStatus: 'processing'`
- [ ] **Нормализует через NormalizerFactory** в MarketplaceEvent
- [ ] **Обновляет ProductSnapshot** при product.update
- [ ] **Логирует в IngestionRun** время начала/конца
- [ ] **Обновляет SyncCursor** последним eventId
- [ ] **Создаёт DeadLetter** при ошибке

## Testing

- [ ] **Test successful request** через curl/Postman с валидной подписью
  - Expected: `200 { status: 'ok', payloadHash, traceId }`
- [ ] **Test invalid signature** без подписи или с неправильной
  - Expected: `401 Unauthorized`
- [ ] **Test schema mismatch** с неподдерживаемым stream
  - Expected: `422 Unprocessable Entity`
- [ ] **Test raw frame** → проверь в Admin Dashboard → Raw Frames tab
- [ ] **Test event processing** → проверь MarketplaceEvent в Admin Dashboard → Events tab
- [ ] **Test product snapshot** → отправь product.update → проверь Snapshots tab
- [ ] **Test error handling** → отправь невалидный payload → проверь Dead Letters tab

## Production

- [ ] **HTTPS enabled** для `/functions/ingestion-receive`
- [ ] **HMAC secret rotated** (не default значение)
- [ ] **Rate limiting configured** на API Gateway
- [ ] **Logging enabled** для всех ошибок
- [ ] **Backup strategy** для DeadLetters
- [ ] **Monitoring setup** для ingestion-receive latency
- [ ] **Alert на критические ошибки** (signature_invalid, processing_error)
- [ ] **Documentation shared** с маркетплейсами (endpoint, contract, signature format)

## Marketplace Integration

### Wildberries
- [ ] **API endpoint URL** настроена в WB Seller Account
- [ ] **Webhook secret** совпадает с `INGESTION_SECRET`
- [ ] **Event streams** активированы (product.updates, seller.updates, orders)
- [ ] **Test webhook** из WB панели

### Яндекс.Маркет
- [ ] **Партнёрский ID** настроен
- [ ] **API ключ** добавлен в переменные окружения
- [ ] **YandexProductNormalizer** создан (если расширяешь)

### Ozon
- [ ] **Seller ID** настроен
- [ ] **API token** добавлен в переменные окружения
- [ ] **OzonProductNormalizer** создан (если расширяешь)

## Documentation

- [ ] **README скопирована** в свою вики/документацию
- [ ] **OpenAPI spec** экспортирована (из Admin Dashboard → Swagger)
- [ ] **Dead Letter reasons** задокументированы в error handling docs
- [ ] **Sync cursor strategy** объяснена для команды devops
- [ ] **Rollback procedure** написана на случай сбоя

## Go-Live

- [ ] **Dry run** успешно завершён
- [ ] **UAT testing** пройдено с маркетплейсами
- [ ] **Performance baseline** установлен (< 1sec ingestion latency)
- [ ] **Incident response plan** готов
- [ ] **Team trained** на использование Admin Dashboard
- [ ] **Greenlight** получено от архитекторов/PO

---

## Notes

- Чек-лист базируется на версии 1.0 маркетплейс-ядра
- Для расширения (batch events, WebSocket, GraphQL) см. MARKETPLACE_CORE_README.md
- Все события хранятся — можешь переобработать DeadLetters вручную
- SyncCursor позволяет возобновить обработку с последней позиции при падении