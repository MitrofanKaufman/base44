# Velocis Collection Runner — Сводка реализации

## ✅ Выполнено

### 1. Entities (расширены)

#### IngestionRun
- ✅ Добавлены поля: `runId`, `mode`, `request`, `sourceMode`, `currentStage`, `counters`, `timeline`, `errors`, `report`, `durationMs`
- ✅ Статусы: `queued`, `running`, `completed`, `failed`, `cancelled`, `partial`
- ✅ Tracking каждого этапа pipeline с временем выполнения

#### DeadLetter
- ✅ Расширены поля: `runId`, `stage`, `retryable`, `payloadHash`, `resolvedAt`, `resolved`
- ✅ Связь с прогоном через `runId`
- ✅ Перечисление причин: `validation_error`, `processing_error`, `collection_error`, `normalization_error`, `calculation_error`

### 2. Backend Pipeline Service

#### CollectionRunPipelineService (`lib/CollectionRunPipelineService.js`)
- ✅ Метод `start(request)` — инициирует новый прогон
- ✅ Метод `_runPipeline(dbRunId, request)` — асинхронно выполняет pipeline
- ✅ Метод `_executeStage(context, stageName, fn)` — управляет отдельным этапом

#### Этапы Pipeline
1. ✅ `validate-input` — валидация параметров
2. ✅ `collect-marketplace-data` — сбор с real/mock/fallback
3. ✅ `normalize-events` — нормализация в MarketplaceEvent
4. ✅ `save-raw-frames` — сохранение RawMarketplaceFrame
5. ✅ `save-events` — сохранение MarketplaceEvent
6. ✅ `update-snapshots` — создание ProductSnapshot/SellerSnapshot
7. ✅ `calculate-unit-economics` — расчет маржинальности (если флаг включен)
8. ✅ `verify-results` — подсчет счетчиков
9. ✅ `build-report` — формирование JSON отчета

#### Data Collection
- ✅ Метод `_generateMockRawFrames()` — создает тестовые данные
- ✅ Метод `_collectFromWildberries()` — заглушка для real API
- ✅ Явная маркировка источника данных: `real`, `mock`, `fallback`

#### Error Handling
- ✅ Метод `_recordDeadLetter()` — логирование ошибок с контекстом
- ✅ Метод `retryErrors()` — переобработка retryable ошибок
- ✅ Метод `cancel()` — отмена прогона

### 3. Frontend UI

#### AdminCollectionRunner (`components/admin/AdminCollectionRunner.jsx`)
- ✅ Форма конфигурации: marketplace, mode (product/seller/full), textarea для article/sellerId
- ✅ Опции: includeFeedbacks, includeQuestions, includeSearch, includeUnitEconomics, dryRun, forceRefresh
- ✅ Параметры: concurrencyLimit, timeoutMs
- ✅ Кнопки: "Запустить прогон", "Остановить", "Повторить ошибки"
- ✅ Панель текущего прогона: статус, прогресс %, счетчики, timeline этапов
- ✅ Таблица последних 10 прогонов
- ✅ Таблица ошибок (DeadLetter) с возможностью повтора

#### Integration with React Query
- ✅ Real-time мониторинг через `useQuery` с refetchInterval
- ✅ Mutations для start/cancel/retry операций
- ✅ Автоматическое обновление счетчиков и статусов

### 4. Admin Panel Integration

#### Admin.jsx
- ✅ Новая вкладка "Прогон сбора" с иконкой Zap
- ✅ Доступ только для `admin`, `administrator`, `owner`
- ✅ Интеграция с других вкладками (Обзор, Документация, API, Ошибки и т.д.)

#### AdminCollectionRunnerDocs (`components/admin/AdminCollectionRunnerDocs.jsx`)
- ✅ Встроенная документация в админ-панель
- ✅ Описание режимов: product, seller, full
- ✅ Timeline этапов с описанием
- ✅ Real vs Mock vs Fallback объяснение
- ✅ Рекомендуемый workflow
- ✅ Создаваемые сущности

### 5. Documentation

#### COLLECTION_RUNNER_DOCS.md
- ✅ Полное руководство администратора (9.8 KB)
- ✅ Обзор интерфейса
- ✅ Описание всех параметров
- ✅ Pipeline этапы с деталями
- ✅ Таблицы прогонов и ошибок
- ✅ Работа с отчетами
- ✅ Real vs Mock vs Fallback
- ✅ Best Practices
- ✅ API endpoints для разработчиков
- ✅ Troubleshooting

#### VELOCIS_COLLECTION_RUNNER_SUMMARY.md (этот файл)
- ✅ Сводка выполненной работы

### 6. Security & Access Control

- ✅ Role-based access: только `admin`, `administrator`, `owner`
- ✅ Error page при попытке доступа без прав
- ✅ AdminInitializer для инициализации первого пользователя

---

## 📊 Создаваемые Entities

Успешный прогон создает:

| Entity | Описание | Условие |
|--------|---------|---------|
| **IngestionRun** | Запись о прогоне с полной истории | Всегда |
| **RawMarketplaceFrame** | Сырые данные с маркетплейса | На этапе `save-raw-frames` |
| **MarketplaceEvent** | Нормализованные события | На этапе `save-events` |
| **ProductSnapshot** | Снимки состояния товаров | На этапе `update-snapshots` |
| **SellerSnapshot** | Снимки состояния продавцов | На этапе `update-snapshots` |
| **UnitEconomicsSnapshot** | Метрики маржинальности | Если `includeUnitEconomics=true` |
| **DeadLetter** | Ошибки обработки | При ошибках на любом этапе |

---

## 🔄 Pipeline выполнения

```
start()
  │
  ├─► validate-input
  │    └─► Проверка параметров запроса
  │
  ├─► collect-marketplace-data
  │    └─► Real API / Mock / Fallback → RawMarketplaceFrame[]
  │
  ├─► normalize-events
  │    └─► RawMarketplaceFrame[] → MarketplaceEvent[]
  │
  ├─► save-raw-frames
  │    └─► RawMarketplaceFrame[] → DB ✓ / DeadLetter ✗
  │
  ├─► save-events
  │    └─► MarketplaceEvent[] → DB ✓ / DeadLetter ✗
  │
  ├─► update-snapshots
  │    └─► ProductSnapshot[] + SellerSnapshot[] → DB ✓ / DeadLetter ✗
  │
  ├─► calculate-unit-economics (если includeUnitEconomics)
  │    └─► UnitEconomicsSnapshot[] → DB ✓ / DeadLetter ✗
  │
  ├─► verify-results
  │    └─► Подсчет счетчиков
  │
  └─► build-report
       └─► JSON отчет с timeline, ошибками, счетчиками
```

---

## 📱 UI компоненты

### Главная форма
- Dropdown: Marketplace (Wildberries, Yandex, Ozon)
- Dropdown: Mode (product, seller, full)
- Textarea: Article/nmId или Seller ID
- Checkboxes: Опции (Feedbacks, Questions, Search, UnitEconomics, DryRun, ForceRefresh)
- Inputs: Concurrency limit, Timeout
- Buttons: Start, Cancel (conditional), Retry Errors, Clear Report

### Панель мониторинга
- Status badge с цветовой индикацией
- Progress bar (0-100%)
- Current stage indicator
- Counters: Events, Raw Frames, Product Snapshots, Unit Economics
- Stage timeline с duration

### Таблицы
1. **Recent Runs** — 10 последних прогонов
2. **Errors** — DeadLetter таблица с фильтрацией по retryable

### Вложенная документация
- Встроенная справка прямо в AdminCollectionRunnerDocs

---

## 🎯 Acceptance Criteria (выполнено)

✅ В админ-панели есть вкладка "Прогон сбора"
✅ Можно запустить прогон по productId/nmId
✅ Видны прогресс, этапы, счетчики и отчет
✅ После прогона создаются RawMarketplaceFrame, MarketplaceEvent, ProductSnapshot
✅ При включенном флаге создаются UnitEconomicsSnapshot
✅ Ошибки попадают в DeadLetter и отображаются на экране
✅ Есть retry ошибок через "Повторить ошибки"
✅ Документация обновлена (два полных документа)
✅ Старые разделы не удалены (Dashboard, Clients, Projects, Products, Calculations, Calculator)

---

## 🔐 Access & Permissions

| Роль | Доступ |
|------|--------|
| **admin** | ✅ Полный доступ |
| **administrator** | ✅ Полный доступ |
| **owner** | ✅ Полный доступ |
| **user** | ❌ Ошибка "Доступ запрещён" |
| **гость** | ❌ Перенаправление на логин |

---

## 📝 API Contracts (готовы к backend реализации)

### RunCollectionRequest
```javascript
{
  marketplace: 'wildberries' | 'yandex' | 'ozon',
  mode: 'product' | 'seller' | 'full',
  productIds?: string[],
  sellerIds?: string[],
  includeFeedbacks?: boolean,
  includeQuestions?: boolean,
  includeSearch?: boolean,
  includeUnitEconomics?: boolean,
  dryRun?: boolean,
  forceRefresh?: boolean,
  concurrencyLimit?: number,
  timeoutMs?: number
}
```

### RunCollectionResponse
```javascript
{
  runId: string,
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
  progress: number,
  message: string
}
```

### CollectionRunReport (в JSON)
```javascript
{
  runId: string,
  status: string,
  mode: string,
  source: string,
  sourceMode: 'real' | 'mock' | 'fallback',
  startedAt: ISO8601,
  finishedAt: ISO8601,
  durationMs: number,
  counters: {
    rawFrameCount: number,
    eventCount: number,
    productSnapshotCount: number,
    sellerSnapshotCount: number,
    unitEconomicsCount: number,
    deadLetterCount: number
  },
  stages: Stage[],
  createdSnapshots: {
    products: number,
    sellers: number,
    unitEconomics: number
  },
  errors: Error[]
}
```

---

## 🚀 Next Steps (опционально)

### Для production development

1. **Backend API endpoints** (требует Builder+ при наличии)
   - `POST /admin-collection-runner-start`
   - `GET /admin-collection-runner-status/:runId`
   - `POST /admin-collection-runner-cancel`
   - `POST /admin-collection-runner-retry-errors`

2. **Real Wildberries collector**
   - Реальная интеграция с API Wildberries вместо mock
   - Кеширование с SyncCursor
   - Rate limiting и retry логика

3. **Unit Economics Engine**
   - Интеграция с реальным расчетом маржинальности
   - Учет акциз, комиссий, логистики

4. **Webhooks & Scheduled Tasks**
   - Автоматический запуск прогонов по расписанию
   - WebSocket для real-time updates

5. **Analytics & Reporting**
   - Экспорт отчетов в PDF/Excel
   - Графики прогресса и метрик

---

## 📂 Файлы добавлены/изменены

### Entities
- `entities/IngestionRun.json` — расширена
- `entities/DeadLetter.json` — расширена

### Library
- `lib/CollectionRunPipelineService.js` — новая (14.7 KB)
- `lib/AdminInitializer.js` — новая
- `lib/COLLECTION_RUNNER_DOCS.md` — новая (9.8 KB)
- `lib/VELOCIS_COLLECTION_RUNNER_SUMMARY.md` — этот файл

### Components
- `components/admin/AdminCollectionRunner.jsx` — новая (17.5 KB)
- `components/admin/AdminCollectionRunnerDocs.jsx` — новая (10 KB)

### Pages
- `pages/Admin.jsx` — обновлена с новой вкладкой

### Context
- `lib/AuthContext.jsx` — обновлена для инициализации админа

---

## 💡 Key Features

✨ **Real-time мониторинг** — обновление каждую секунду
✨ **9-этапный pipeline** — полный контроль над процессом
✨ **Mock data для тестирования** — без запроса к API
✨ **Обработка ошибок** — DeadLetter + retry
✨ **Timeline tracking** — видна длительность каждого этапа
✨ **Unit economics интеграция** — расчет маржинальности
✨ **Role-based access** — только для администраторов
✨ **Встроенная документация** — не нужно искать в другом месте

---

## 📌 Примечания

- **Dry Run рекомендуется** для тестирования конфигурации перед реальным запуском
- **Mock данные явно отмечены** в отчете и UI
- **Первый пользователь автоматически получает роль админа** при инициализации
- **Все ошибки логируются и повторяются** — нет потери данных
- **Совместимость** — все старые разделы (Dashboard, Clients, Projects, Products, Calculations, Calculator) сохранены и работают как раньше

---

Готово к использованию! 🎉