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

## 5.1 Административная панель

Файлы:
- `src/pages/Admin.jsx` - главная страница админки
- `src/components/admin/AdminOverview.jsx` - обзорная панель с метриками
- `src/components/admin/AdminBroadcasts.jsx` - управление рассылками
- `src/components/admin/AdminCollectionRunner.jsx` - запуск pipeline сбора данных
- `src/components/admin/AdminDashboardGrid.jsx` - настраиваемая сетка виджетов

### Метрики системы (AdminOverview)
- Системные метрики: CPU, память, uptime процесса Node.js
- Метрики БД: пользователи, подписки, продукты, очередь заданий
- Статистика BullMQ: счётчики заданий (waiting, active, delayed, failed)
- Активность пользователей: онлайн (последние 5 минут), визиты за день
- Автоматическое обновление каждые 30 секунд через React Query

### Система рассылок (AdminBroadcasts)
- Создание broadcast с title, body, audience, category
- Аудитории: all, active_subscribers, paid_accounts, admins
- Немедленная отправка (send_now) или планирование
- Автоматические рассылки по расписанию (daily, weekly, subscription_expiring)
- Worker процесс проверяет due schedules каждую минуту
- Массовая вставка сообщений в user_messages для получателей

### Collection Runner (pipeline сбора данных)
Этапы pipeline:
1. `validate-input` - валидация конфигурации прогона
2. `collect-marketplace-data` - сбор данных из WB API или mock
3. `normalize-events` - нормализация событий
4. `save-raw-frames` - сохранение сырых данных в БД
5. `update-snapshots` - создание product snapshots
6. `calculate-unit-economics` - расчёт юнит-экономики
7. `verify-results` - верификация результатов
8. `build-report` - построение отчёта

### Отслеживание активности пользователей (heartbeat)
- Клиент отправляет heartbeat с session_id и path
- UPSERT активности в user_activity таблицу
- Подсчёт онлайн пользователей (last_seen_at за последние 5 минут)
- Статистика визитов за день (уникальные пользователи)

### Настраиваемая dashboard сетка (AdminDashboardGrid)
- Drag-and-drop компоновка блоков метрик
- Сохранение layout в localStorage
- Изменение размера блоков (span: 1 → 2 → 3 → full)
- Автоматическое сохранение изменений

## 5.2 Синхронизация данных Wildberries

Файлы:
- `backend/src/wildberries-routes.js` - API endpoints
- `backend/src/wildberries-public-api.js` - публичный API WB
- `backend/src/wildberries-seller-api.js` - Seller API WB
- `backend/src/wildberries-repository.js` - сохранение данных
- `src/lib/WildberriesSync.js` - клиентская синхронизация
- `src/lib/LogisticsService.js` - расчёт логистики
- `src/lib/CommissionService.js` - определение комиссии

### Синхронизация товара через API
- POST `/wildberries/products/:productId/sync` - точка входа
- Валидация прав пользователя на товар
- Сбор данных из трёх публичных endpoints WB:
  - card.json с basket hosts - детальная информация
  - cards-detail API - цены, остатки, варианты
  - search API - fallback при недоступности cards-detail
- Построение профиля товара с мержем данных
- Сохранение в БД: wb_raw, product_snapshots, price_history
- Обновление товара в products с новыми ценами и габаритами

### Синхронизация справочника логистики
- POST `/wildberries/clients/:clientId/logistics-directions/sync`
- Параллельные запросы к Seller API:
  - GET `/api/v3/offices` - ПВЗ маркетплейса
  - GET `/api/v3/warehouses` - склады
  - GET `/api/v2/supplies/warehouses` - склады поставок
- Нормализация данных в единый формат
- Upsert в logistics_directories таблицу
- Обновление существующих записей

### Синхронизация справочника комиссий
- POST `/wildberries/clients/:clientId/commission-directory/sync`
- GET `/api/v1/tariffs/commission` через Seller API
- Нормализация категорий и процентов комиссий
- Приоритет полей: kgvpMarketplace > kgvpSupplier > commission
- Upsert в marketplace_commission_directories таблицу

### BullMQ worker для фоновой обработки
- Worker обрабатывает задачи типа `wb:collect:product`
- UPDATE статуса задачи на 'running'
- Сбор данных из публичных API
- Сохранение результатов в БД
- UPDATE статуса на 'done' с progress = 100

### Клиентская фоновая синхронизация (BackgroundSyncService)
- Таймер синхронизации логистики: первый запуск через 30 сек, затем каждый час
- Таймер синхронизации товаров: первый запуск через 1 мин, затем каждые 15 мин
- Синхронизация каждого товара со статусом active
- Обновление товара в БД с новыми ценами и временем синхронизации
- Сохранение истории цен в price_history

### Клиентская синхронизация продаж и цен (SyncScheduler)
- Периодическая синхронизация (default 30 мин)
- Получение клиентов с wb_api_token
- Синхронизация продаж за последние 7 дней через WB Statistic API
- Параллельная загрузка актуальных цен и складских остатков
- Создание записей SalesData и PriceHistory

### Расчёт логистических затрат (LogisticsService)
- Получение тарифов из справочника по direction_id
- Расчёт оплачиваемого веса: max(физический вес, объёмный вес)
- Объёмный вес = литры / 5
- Первые 50г включены в базовую ставку
- Доплата за вес > 50г по тарифу per_kg
- Расчёт стоимости хранения

### Определение комиссии WB (CommissionService)
- Приоритет: справочник > product.wb_commission_pct > default
- Поиск в справочнике по category_id или category_name
- Выбор поля комиссии по режиму:
  - FBS → kgvpSupplier
  - FBO → kgvpMarketplace
- Извлечение комиссии: commission_by_model > commission_pct

## 5.3 Юнит-экономика

Файл: `src/lib/unitEconomics.js`

Ключевые расчеты:

- price net, налоги, комиссия, промо;
- себестоимость с учётом брака (cogsBase * (1 + wasteRate));
- переменные расходы: логистика FBO/FBS, маркетинг (CAC * paidShare);
- gross profit = revenue - variableCost;
- contribution = grossProfit - marketingCost;
- BEP (точка безубыточности) = fixedMonthly / contribution;
- налоговая база по системе УСН (Доходы vs Доходы-Расходы).

### Калькулятор юнит-экономики

Файл: `src/pages/Calculator.jsx`

Инициализация:
- Загрузка товаров, справочников логистики, комиссий, истории цен
- Выбор товара и построение seed-данных из снапшотов
- Определение комиссии WB из справочника
- Расчёт логистических затрат для seed-формы

Основной расчёт:
- Функция calculate() вызывает calculateDonorUnitEconomics()
- Нормализация входных данных (snake_case/camelCase)
- Расчёт себестоимости с браком
- Расчёт налогов по системе УСН
- Расчёт contribution margin
- Расчёт точки безубыточности

Синхронизация с WB API:
- Кнопка синхронизации в MarketplaceDataSync компоненте
- POST запрос на `/wildberries/products/:id/sync`
- Маппинг актуальной цены из ответа API
- Инвалидация кэша React Query
- Обновление формы калькулятора с новыми данными

Сохранение расчёта:
- Сбор form + product_id + project_id
- buildCalculationPayload объединяет данные и результаты расчёта
- Добавление метрик: contribution, gross_profit, bep_units
- base44.entities.Calculation.create() отправляет POST запрос
- Инвалидация кэша для обновления списка расчётов

### Система версионирования и черновиков

Файлы:
- `src/lib/calculatorDraftStorage.js`
- `src/components/calculator/VersionsPanel.jsx`

Функциональность:
- State для хранения множественных версий расчёта
- Создание новой версии сценария расчёта
- Автосохранение черновика в sessionStorage при изменениях
- Проверка наличия черновика при выборе товара
- Восстановление черновика через диалог
- Отображение contribution для каждой версии

### Визуализация структуры затрат и чувствительности

Файлы:
- `src/lib/calculatorViewModel.js`
- `src/components/calculator/CostBreakdownChart.jsx`
- `src/components/calculator/SensitivityChart.jsx`

CostBreakdownChart:
- buildCostBreakdown группирует затраты
- withPct вычисляет долю каждой статьи в общих затратах
- Recharts PieChart отображает структуру затрат

SensitivityChart:
- Генерация точек для анализа чувствительности
- Изменение параметра в диапазоне
- Множественные вызовы calculate для построения кривой
- Recharts LineChart показывает влияние параметра на прибыль

## 5.4 Collection Runner (админский pipeline)

Файл: `src/lib/CollectionRunPipelineService.js`

Этапы pipeline:

1. `validate-input` - валидация конфигурации прогона
2. `collect-marketplace-data` - сбор данных из WB API или mock
3. `normalize-events` - нормализация событий
4. `save-raw-frames` - сохранение сырых данных в БД
5. `save-events` - сохранение событий
6. `update-snapshots` - создание product snapshots
7. `calculate-unit-economics` - расчёт юнит-экономики
8. `verify-results` - верификация результатов
9. `build-report` - построение отчёта

Runner управляется через UI:

- `src/components/admin/AdminCollectionRunner.jsx`

## 5.5 Подписки и фичи

Файлы:

- `src/lib/subscriptionService.js`
- `src/lib/initSubscriptions.js`
- админские UI-компоненты в `src/components/admin/*Subscriptions*`

Реализованы тарифы:

- `basic`
- `standard`
- `standard_plus`
- `maximum`

## 6. Аутентификация и авторизация

Файлы:
- `backend/src/auth.js` - JWT функции и middleware
- `backend/src/auth-routes.js` - маршруты регистрации и входа
- `backend/src/entity-access.js` - контроль доступа к данным
- `backend/scripts/create-admin.js` - скрипт создания администратора
- `src/lib/AuthContext.jsx` - React контекст авторизации
- `src/api/base44Client.js` - API клиент с авторизацией

### JWT авторизация

- JWT токены с httpOnly cookies
- Секретный ключ: `JWT_SECRET`
- Время жизни токена: `JWT_EXPIRES_IN`
- Имя cookie: `AUTH_COOKIE_NAME`
- Payload токена: { sub: user.id, email: user.email, role: user.role }

### Хеширование паролей

- Используется bcryptjs с 10 раундами соли
- Хеширование при регистрации: `bcrypt.hash(password, 10)`
- Хеширование в admin скрипте: `bcrypt.hash(password, 10)`
- Сравнение при входе: `bcrypt.compare(password, hash)`

### Регистрация пользователя

- POST `/auth/register`
- Валидация email и пароля
- Хеширование пароля через bcrypt
- INSERT в app_users: email, full_name, role, password_hash, created_by
- Генерация JWT токена
- Установка httpOnly cookie
- Возврат токена и пользователя

### Вход пользователя

- POST `/auth/login`
- SELECT password_hash из app_users по email
- Сравнение пароля через bcrypt.compare
- При несовпадении: 401 error без деталей
- При успехе: генерация JWT токена
- Установка httpOnly cookie
- Возврат токена и пользователя

### Role-based access control

Роли пользователей:
- `admin` - полный доступ ко всем данным
- `user` - доступ только к своим данным (created_by = email)

Middleware:
- `requireAuth` - проверка JWT токена
- `requireRole(...roles)` - проверка роли пользователя

### Контроль доступа к данным

Фильтрация по владельцу:
- При создании записи: `created_by = email` пользователя
- При чтении записей: добавление `WHERE created_by = $N` для обычных пользователей
- Администраторы видят все записи без фильтрации
- Реализовано в `buildAccessClause` (entity-access.js)

Generic CRUD маршруты:
- `/entities/<EntityName>` - автоматическая фильтрация по владельцу
- Админы обходят фильтрацию через `isAdminAuth(auth)`

### Создание администратора

Скрипт: `backend/scripts/create-admin.js`
- Хеширование пароля через bcrypt
- INSERT/UPDATE app_users с role='admin'
- Используется для первоначальной настройки системы

## 7. Модель данных

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

