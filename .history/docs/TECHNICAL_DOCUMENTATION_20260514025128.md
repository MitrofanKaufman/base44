# Техническая документация приложения `base44`

Дата фиксации: `2026-05-14`  
Каталог проекта: `d:\WORK\base44`

## 1. Назначение приложения

`base44` — веб-приложение для управления юнит-экономикой и аналитикой товаров (фокус на Wildberries) с модулями:

- клиенты, проекты, товары, расчеты;
- калькулятор юнит-экономики;
- аналитика и алерты;
- административная панель (прогоны сбора, snapshots, ошибки, подписки).

## 2. Технологический стек

### Frontend

- `React 18` + `Vite 6`
- `react-router-dom 6`
- `@tanstack/react-query`
- `Tailwind CSS` + компоненты на `Radix UI`
- `Recharts` для графиков
- `@base44/sdk` + `@base44/vite-plugin`

### Backend (локальный API)

- `Node.js` + `Express`
- `PostgreSQL` (`pg`)
- `Redis` + `BullMQ` (очереди/воркер)
- `JWT` авторизация (`jsonwebtoken`)
- `Swagger UI` + генерация OpenAPI из схем сущностей

### Инфраструктура

- Docker + Docker Compose
- Nginx reverse proxy

## 3. Структура репозитория

```text
backend/        # локальный API + worker
db/init/        # SQL-инициализация БД
src/            # React-приложение
entities/       # JSON-схемы сущностей (Base44)
docs/           # документация
```

## 4. Архитектура приложения

## 4.1 Frontend

Точка входа:

- `src/main.jsx`
- `src/App.jsx`

Маршруты приложения:

- `/` — Dashboard
- `/clients` — Клиенты
- `/projects` — Проекты
- `/products` — Товары
- `/calculations` — Сохраненные расчеты
- `/calculator` — Калькулятор юнит-экономики
- `/analysis` — Анализ (ABC + конкуренты)
- `/analytics` — Аналитика прогонов
- `/admin` — Админка
- `/settings` — Профиль пользователя

Авторизация:

- контекст `src/lib/AuthContext.jsx`;
- проверка пользователя через `base44.auth.me()`;
- при успешном входе запускаются:
  - инициализация администратора (`AdminInitializer`);
  - инициализация подписок (`initSubscriptions`);
  - фоновые задачи (`BackgroundSyncService`).

Доступ к данным:

- основной путь — `base44.entities.*` (CRUD по сущностям через Base44 SDK);
- часть функций вызывает `base44.integrations.Core.InvokeLLM(...)` для enrichment и синхронизации данных.

## 4.2 Backend (локальный API)

Точка входа:

- `backend/src/server.js`

Основные возможности:

- Health-check: `GET /healthz`
- Auth:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/logout`
  - `GET /auth/me`
- Queue:
  - `POST /queue/enqueue`
- OpenAPI:
  - `GET /openapi.json`
  - `GET /docs`
- Generic CRUD:
  - `/entities/<EntityName>` (список, создание, bulk, update-many, удаление, read/update/delete by id)

Все entity-маршруты защищены `requireAuth` (JWT Bearer или cookie).

## 4.3 Фоновые процессы

### В браузере (frontend runtime)

- `BackgroundSyncService`:
  - синхронизация логистических справочников;
  - синхронизация активных товаров;
  - запуск `SyncScheduler`.
- `SyncScheduler`:
  - периодический вызов `WildberriesSync.syncAll()`;
  - хранит логи в `localStorage`.

### На сервере

- `backend/src/worker.js` обрабатывает BullMQ очередь `base44-jobs`.
- Реализованы stub-обработчики: `sync-client`, `sync-project`, `sync-product`.

## 5. Основные бизнес-модули

## 5.1 Юнит-экономика

Файл: `src/lib/unitEconomics.js`

Ключевые расчеты:

- price net, налоги, комиссия, промо;
- себестоимость и переменные расходы;
- gross profit, gross margin;
- contribution, contribution %;
- BEP (точка безубыточности).

## 5.2 Collection Runner (админский pipeline)

Файл: `src/lib/CollectionRunPipelineService.js`

Этапы pipeline:

1. `validate-input`
2. `collect-marketplace-data`
3. `normalize-events`
4. `save-raw-frames`
5. `save-events`
6. `update-snapshots`
7. `calculate-unit-economics`
8. `verify-results`
9. `build-report`

Runner управляется через UI:

- `src/components/admin/AdminCollectionRunner.jsx`

## 5.3 Подписки и фичи

Файлы:

- `src/lib/subscriptionService.js`
- `src/lib/initSubscriptions.js`
- админские UI-компоненты в `src/components/admin/*Subscriptions*`

Реализованы тарифы:

- `basic`
- `standard`
- `standard_plus`
- `maximum`

## 6. Модель данных

Сущности (папка `entities/` + backend definitions):

- `Client`, `Project`, `Product`, `Calculation`
- `RawMarketplaceFrame`, `MarketplaceEvent`
- `ProductSnapshot`, `SellerSnapshot`, `UnitEconomicsSnapshot`
- `IngestionRun`, `DeadLetter`, `SyncCursor`
- `SalesData`, `PriceHistory`, `LogisticsDirectory`
- `Subscription`, `Feature`, `UserSubscription`
- `User` (описан в backend schema)

Группы данных:

- Core business: клиенты/проекты/товары/расчеты
- Ingestion/ETL: raw frames, events, runs, dead letters, cursors
- Analytics snapshots: product/seller/unit snapshots
- Commerce support: sales/price/logistics
- Access/billing: users/subscriptions/features

## 7. Конфигурация и переменные окружения

## 7.1 Frontend (`.env.local`)

- `VITE_BASE44_APP_ID`
- `VITE_BASE44_APP_BASE_URL`
- `VITE_BASE44_FUNCTIONS_VERSION` (опционально)
- `BASE44_LEGACY_SDK_IMPORTS` (`true|false`)
- `VITE_CACHE_DIR` (опционально, для Vite)

## 7.2 Backend

- `PORT` (default `3000`)
- `DATABASE_URL` (или `POSTGRES_*`)
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `AUTH_COOKIE_NAME`
- `CORS_ORIGIN`
- `ALLOW_ROLE_OVERRIDE`
- `NODE_ENV`

## 8. Локальный запуск

## 8.1 Frontend

```bash
npm install
npm run dev
```

## 8.2 Backend

```bash
cd backend
npm install
npm run dev
```

## 8.3 Полный стек через Docker

```bash
docker compose up --build
```

Сервисы в `docker-compose.yml`:

- `app` (frontend image)
- `api` (Express)
- `worker` (BullMQ worker)
- `postgres`
- `redis`
- `nginx`

## 9. API и контракты

Локальный backend публикует:

- OpenAPI JSON: `/api/openapi.json` (через nginx-прокси)
- Swagger UI: `/api/docs`

Entity API типовой:

- `GET /entities/<Entity>`
- `POST /entities/<Entity>`
- `POST /entities/<Entity>/bulk`
- `PATCH /entities/<Entity>/update-many`
- `GET /entities/<Entity>/:id`
- `PUT /entities/<Entity>/:id`
- `DELETE /entities/<Entity>/:id`

## 10. Известные расхождения и риски

Ниже перечислены фактические несоответствия, обнаруженные в кодовой базе:

1. Админские разделы `AdminDocumentation` / `AdminSwagger` ссылаются на legacy endpoint `/functions/ingestion-receive`, но локальный backend реализует `/api/*` и не содержит `/functions/*`.
2. `CollectionRunPipelineService` считает `durationMs` через `context.startedAt`, который не инициализируется в контексте (риск некорректной длительности).
3. В `CollectionRunPipelineService` используется `import { v4 as uuidv4 } from 'uuid'`, но пакет `uuid` не объявлен явно в корневом `package.json` (риск окружений с иным hoisting).
4. `AdminOverview` ожидает поля `eventsProcessed`/`eventsError` в корне `IngestionRun`, тогда как фактические счетчики хранятся в `run.counters`.
5. `AdminScheduledTasks` отображает cron-like задачи в UI, но реальный серверный scheduler для этих задач в backend отсутствует.
6. `SyncScheduler` и часть background-логики используют `localStorage`, то есть состояние живет на клиенте браузера, а не на сервере.
7. В коде frontend часть функций синхронизации получает внешние данные через `InvokeLLM` (не deterministic источник), это нужно учитывать для production-процессов.

## 11. Рекомендации по стабилизации

1. Унифицировать ingestion API: выбрать один контракт (`/api/...` или `/functions/...`) и привести админ-документацию/UI к нему.
2. Перенести критические планировщики из браузера в backend worker/scheduler.
3. Исправить модель `IngestionRun` в UI (единое чтение `counters` и timeline).
4. Явно добавить `uuid` в зависимости frontend, если Collection Runner используется в runtime.
5. Разделить в документации и UI:
   - production pipeline с реальными интеграциями;
   - demo/mock сценарии.

