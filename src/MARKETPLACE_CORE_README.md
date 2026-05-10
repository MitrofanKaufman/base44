# Маркетплейс-ядро (Marketplace Core Layer)

## Обзор

**Маркетплейс-ядро** — встроенная система обработки событий от маркетплейсов (Wildberries, Яндекс.Маркет, Ozon) с нормализацией, кэшированием и анализом юнит-экономики.

### Ключевые возможности

✅ **Intake Layer** — безопасный HTTP endpoint с HMAC-SHA256 верификацией  
✅ **Processing Layer** — детерминированное хеширование, нормализация по stream-типам  
✅ **Storage Layer** — 8 сущностей для raw-данных, событий, снимков, ошибок  
✅ **Sync Layer** — отслеживание позиции в потоке через SyncCursor  
✅ **Admin Dashboard** — встроенное администрирование с документацией и API viewer  
✅ **Unit Economics** — расчёты маржи и ROI по ProductSnapshot  

---

## Архитектура

### Data Flow

```
[Маркетплейс] 
  ↓
[POST /functions/ingestion-receive]
  ↓ (HMAC-SHA256 verification)
[WbPayloadHasher → payloadHash SHA-256]
  ↓
[RawMarketplaceFrame сохранение]
  ↓
[NormalizerFactory выбирает нормализатор по stream]
  ↓
[MarketplaceEvent + ProductSnapshot/SellerSnapshot обновление]
  ↓
[SyncCursor + IngestionRun логирование]
  ↓ (успех)
[200 OK + {status: 'ok', payloadHash, traceId}]
  
Или при ошибке:
  ↓
[DeadLetter запись + 500/422 response]
```

### Компоненты

| Компонент | Назначение |
|-----------|-----------|
| **Core Layer** (`lib/core/`) | Бизнес-логика, контракты, хеширование |
| **Entities** (`entities/`) | 8 JSON-схем для хранения данных |
| **Admin Dashboard** (`pages/Admin.jsx`) | UI для управления и мониторинга |
| **AdminComponents** (`components/admin/`) | 8 вкладок: Overview, Docs, Swagger, Events, Frames, Errors, Snapshots, Settings |

---

## Сущности (Entities)

### 1. RawMarketplaceFrame
**Назначение:** Сохранение сырого payload от маркетплейса без изменений.

```json
{
  "source": "wildberries",
  "stream": "product.updates",
  "sourceEventId": "evt_12345",
  "payloadHash": "sha256-hex",
  "emittedAt": "2024-05-06T10:30:00Z",
  "receivedAt": "2024-05-06T10:30:01Z",
  "payload": { /* маркетплейс payload */ },
  "processingStatus": "processed"
}
```

**Ключевые поля:**
- `payloadHash` — детерминированный SHA-256 для дедупликации
- `traceId` — для корреляции с другими записями
- `processingStatus` — received → processing → processed/failed

---

### 2. MarketplaceEvent
**Назначение:** Нормализованное событие (product.update, seller.update и т.д.).

```json
{
  "type": "product.update",
  "source": "wildberries",
  "sourceEventId": "evt_12345",
  "traceId": "trace-uuid",
  "data": {
    "productId": "123",
    "name": "Товар",
    "sku": "ABC123",
    "price": 1500,
    "/* ... */": "normalized fields"
  }
}
```

---

### 3. ProductSnapshot
**Назначение:** Кэш-снимок товара с полной информацией.

```json
{
  "productId": "prod_123",
  "source": "wildberries",
  "externalId": "WB_ID_123",
  "name": "Товар",
  "sku": "SKU_ABC",
  "price": 1500,
  "data": { /* полный объект товара */ },
  "updatedAt": "2024-05-06T10:30:00Z"
}
```

---

### 4. SellerSnapshot
**Назначение:** Кэш-снимок продавца (рейтинг, название, статус).

### 5. UnitEconomicsSnapshot
**Назначение:** Расчётные метрики товара (маржа, ROI, прибыльность).

```json
{
  "itemId": "SKU_ABC",
  "source": "wildberries",
  "price": 1500,
  "cost": 800,
  "margin": 700,
  "marginPct": 46.7,
  "metrics": {
    "isProfitable": true,
    "roi": 87.5,
    /* ... */
  }
}
```

---

### 6. IngestionRun
**Назначение:** Логирование batch-обработки события.

```json
{
  "source": "wildberries",
  "stream": "product.updates",
  "startedAt": "2024-05-06T10:30:00Z",
  "finishedAt": "2024-05-06T10:30:05Z",
  "status": "completed",
  "eventsProcessed": 42,
  "eventsError": 1,
  "notes": "Batch processing completed with 1 error"
}
```

---

### 7. SyncCursor
**Назначение:** Отслеживание последнего обработанного события в потоке.

```json
{
  "stream": "product.updates",
  "source": "wildberries",
  "lastEventId": "evt_12345",
  "lastTimestamp": "2024-05-06T10:30:00Z",
  "updatedAt": "2024-05-06T10:30:01Z"
}
```

---

### 8. DeadLetter
**Назначение:** Регистрация ошибок обработки для отладки и анализа.

```json
{
  "reason": "validation_error",
  "message": "Field 'price' is required",
  "sourceEventId": "evt_12345",
  "traceId": "trace-uuid",
  "payload": { /* failed payload */ },
  "stackTrace": "...",
  "createdAt": "2024-05-06T10:30:00Z",
  "resolved": false
}
```

---

## Core Layer (`lib/core/`)

### contracts.ts
Интерфейсы для IngestionEnvelope, RawFrameRecord и т.д.

### hashers.ts
- `WbPayloadHasher.hash(payload)` — SHA-256 хеш
- `WbPayloadHasher.verify(payload, hash)` — проверка хеша
- `HmacSignatureVerifier.verify(payload, signature, secret)` — HMAC-SHA256 верификация

### normalizers.ts
- `WbProductNormalizer` — нормализация product payload
- `WbSellerNormalizer` — нормализация seller payload
- `NormalizerFactory.getNormalizer(stream)` — выбор нормализатора

### logger.ts
Структурированный логгер с методами: `info()`, `error()`, `warn()`, `debug()`.

### unit-economics.ts
`UnitEconomicsCore.calculate(input)` → {price, cost, margin, marginPct, contribution, roi, isProfitable}

---

## API Endpoint

### POST /functions/ingestion-receive

**Request:**
```bash
curl -X POST /functions/ingestion-receive \
  -H "Content-Type: application/json" \
  -H "x-signature: <hmac-sha256-hex>" \
  -H "x-trace-id: <optional-uuid>" \
  -d '{...payload...}'
```

**Request Body (IngestionEnvelope):**
```json
{
  "schemaVersion": "1.0",
  "source": "wildberries",
  "stream": "product.updates",
  "sourceEventId": "evt_12345",
  "emittedAt": "2024-05-06T10:30:00Z",
  "payload": { /* маркетплейс payload */ },
  "traceId": "optional-trace-id"
}
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "payloadHash": "sha256-hex-string",
  "eventCount": 1,
  "traceId": "trace-or-generated-uuid"
}
```

**Status Codes:**
- `200` — OK
- `400` — Bad Request (JSON невалиден)
- `401` — Unauthorized (подпись HMAC неверна)
- `422` — Unprocessable Entity (schema mismatch)
- `500` — Internal Server Error (запись в DeadLetter)

---

## Admin Dashboard

**Путь:** `/admin` (только для администраторов)

### Вкладки

1. **Обзор ядра** — статистика событий, последний run, KPI
2. **Документация** — встроенная GitBook-style документация (6 разделов)
3. **API / Swagger** — OpenAPI 3.1 spec с примерами
4. **События** — список MarketplaceEvent с фильтрацией
5. **Raw Frames** — список RawMarketplaceFrame с payload preview
6. **Ошибки** — список DeadLetter с stack trace
7. **Снимки** — ProductSnapshot, SellerSnapshot, UnitEconomicsSnapshot
8. **Настройки** — статус безопасности, синхронизация, конфигурация

---

## Безопасность

### HMAC-SHA256 Signature
Каждый запрос должен быть подписан:

```javascript
const crypto = require('crypto');
const payload = JSON.stringify(data);
const signature = crypto
  .createHmac('sha256', SECRET)
  .update(payload)
  .digest('hex');
```

**Header:** `x-signature: <hmac-hex>`

### Role-Based Access
- Админ-раздел доступен только пользователям с ролью `admin`, `administrator`, `owner`
- Проверка на уровне React (AuthContext) и должна быть на backend

### Защита секретов
- HMAC секрет хранится в переменных окружения
- Никогда не отображается в UI
- Все ошибки логируются без sensitive данных

---

## Интеграция

### Добавить endpoint в Backend Function

1. **Создай backend function** `ingestion-receive.ts`:

```typescript
import { WbPayloadHasher, HmacSignatureVerifier } from '@/lib/core/hashers';
import { NormalizerFactory } from '@/lib/core/normalizers';
import { base44 } from '@/api/base44Client';

export default async function ingestEvent(req) {
  // 1. Verify HMAC
  const signature = req.headers['x-signature'];
  const secret = process.env.INGESTION_SECRET;
  
  if (!HmacSignatureVerifier.verify(JSON.stringify(req.body), signature, secret)) {
    return { status: 'error', message: 'Invalid signature' };
  }

  // 2. Hash payload
  const payloadHash = WbPayloadHasher.hash(req.body.payload);

  // 3. Save RawMarketplaceFrame
  const rawFrame = await base44.entities.RawMarketplaceFrame.create({
    source: req.body.source,
    stream: req.body.stream,
    sourceEventId: req.body.sourceEventId,
    payloadHash,
    emittedAt: req.body.emittedAt,
    receivedAt: new Date().toISOString(),
    traceId: req.body.traceId || crypto.randomUUID(),
    payload: req.body.payload,
    processingStatus: 'processing'
  });

  // 4. Normalize and save MarketplaceEvent
  const Normalizer = NormalizerFactory.getNormalizer(req.body.stream);
  if (!Normalizer) {
    return { status: 'error', message: 'Unsupported stream' };
  }

  const normalized = Normalizer.normalize(req.body, req.body.payload);
  await base44.entities.MarketplaceEvent.create(normalized);

  // 5. Update ProductSnapshot if needed
  if (normalized.type === 'product.update') {
    await base44.entities.ProductSnapshot.create({
      productId: normalized.data.productId,
      source: req.body.source,
      externalId: normalized.data.externalId,
      name: normalized.data.name,
      sku: normalized.data.sku,
      price: normalized.data.price,
      data: normalized.data,
      updatedAt: new Date().toISOString()
    });
  }

  return {
    status: 'ok',
    payloadHash,
    eventCount: 1,
    traceId: rawFrame.traceId
  };
}
```

2. **Установи переменную окружения:**
```bash
INGESTION_SECRET=your-secure-secret-here
```

3. **Тестируй через Admin Dashboard** → Swagger tab → Copy example curl command

---

## Примеры использования

### Client-side (Node.js)

```javascript
const crypto = require('crypto');

async function sendEvent() {
  const payload = {
    schemaVersion: '1.0',
    source: 'wildberries',
    stream: 'product.updates',
    sourceEventId: 'evt_' + Date.now(),
    emittedAt: new Date().toISOString(),
    payload: {
      id: 'prod_123',
      name: 'Товар',
      price: 1500
    }
  };

  const serialized = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', 'secret')
    .update(serialized)
    .digest('hex');

  const response = await fetch('/functions/ingestion-receive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
      'x-trace-id': crypto.randomUUID()
    },
    body: serialized
  });

  return response.json();
}
```

### Client-side (Python)

```python
import requests
import hmac
import hashlib
import json
from uuid import uuid4
from datetime import datetime

payload = {
    'schemaVersion': '1.0',
    'source': 'wildberries',
    'stream': 'product.updates',
    'sourceEventId': f'evt_{int(datetime.now().timestamp() * 1000)}',
    'emittedAt': datetime.utcnow().isoformat() + 'Z',
    'payload': {
        'id': 'prod_123',
        'name': 'Товар',
        'price': 1500
    }
}

serialized = json.dumps(payload, separators=(',', ':'))
signature = hmac.new(b'secret', serialized.encode(), hashlib.sha256).hexdigest()

response = requests.post(
    'http://localhost:3000/functions/ingestion-receive',
    json=payload,
    headers={
        'x-signature': signature,
        'x-trace-id': str(uuid4())
    }
)

print(response.json())
```

---

## Дальнейшие шаги

### Builder+ требования
**Функция `/ingestion-receive` требует подписки Builder+**

Если у тебя её нет:
1. Обновись до Builder+ в настройках
2. Создай backend function с кодом выше
3. Привязь функцию к endpoint

### Расширение
- ✅ Добавь поддержку Яндекс.Маркета через `YandexProductNormalizer`
- ✅ Добавь поддержку Ozon через `OzonProductNormalizer`
- ✅ Реализуй WebSocket subscription для real-time событий
- ✅ Добавь GraphQL API для сложных запросов к снимкам
- ✅ Интегрируй с BI-системой для аналитики

---

## FAQ

**Q: Как проверить подпись?**  
A: Используй `HmacSignatureVerifier.verify(payload, signature, secret)` из `lib/core/hashers.ts`.

**Q: Что делать если событие не обработалось?**  
A: Проверь раздел "Ошибки" в Admin Dashboard — там будет DeadLetter с описанием.

**Q: Как отследить событие через систему?**  
A: Используй `traceId` — он есть во всех сущностях и в логах.

**Q: Можно ли обработать batch событий одним запросом?**  
A: Текущий дизайн — один запрос = одно событие. Для batch добавь цикл на клиентской стороне.

---

## Лицензия & Поддержка

Маркетплейс-ядро — встроенная система Base44. Для вопросов см. документацию в Admin Dashboard.

---

**Версия:** 1.0  
**Дата:** 2024-05-06  
**Статус:** Production-ready (требует backend function на Builder+)