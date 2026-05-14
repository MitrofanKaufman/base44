Техническая документация приложения base44

Дата фиксации: 2026-05-14
Каталог проекта: d:\WORK\base44

<!-- begin:toc -->
Содержание

Для удобства навигации приведено оглавление с ссылками на основные разделы:

Назначение приложения
Технологический стек
Структура репозитория
Архитектура приложения
Основные бизнес‑модули
Аутентификация и авторизация
Модель данных
Конфигурация и переменные окружения
Локальный запуск
API и контракты
Известные расхождения и риски
Рекомендации по стабилизации

Меню:
Стек
 • Архитектура
 • Бизнес‑модули
 • Юнит‑экономика
 • Pipeline
 • Конфигурация
 • API

<!-- end:toc -->
1. Назначение приложения <a name="section-1"></a>

base44 — веб-приложение для управления юнит-экономикой и аналитикой товаров (фокус на Wildberries) с модулями:

клиенты, проекты, товары, расчеты;
калькулятор юнит-экономики;
аналитика и алерты;
административная панель (прогоны сбора, snapshots, ошибки, подписки).
2. Технологический стек <a name="section-2"></a>
Frontend
React 18 + Vite 6
react-router-dom 6
@tanstack/react-query
Tailwind CSS + компоненты на Radix UI
Recharts для графиков
@base44/sdk + @base44/vite-plugin
Backend (локальный API)
Node.js + Express
PostgreSQL (pg)
Redis + BullMQ (очереди/воркер)
JWT авторизация (jsonwebtoken)
Swagger UI + генерация OpenAPI из схем сущностей
Инфраструктура
Docker + Docker Compose
Nginx reverse proxy
3. Структура репозитория <a name="section-3"></a>
backend/        # локальный API + worker
db/init/        # SQL-инициализация БД
src/            # React-приложение
entities/       # JSON-схемы сущностей (Base44)
docs/           # документация
4. Архитектура приложения <a name="section-4"></a>
4.1 Frontend

Точка входа:

src/main.jsx
src/App.jsx

Маршруты приложения:

/ — Dashboard
/clients — Клиенты
/projects — Проекты
/products — Товары
/calculations — Сохраненные расчеты
/calculator — Калькулятор юнит-экономики
/analysis — Анализ (ABC + конкуренты)
/analytics — Аналитика прогонов
/admin — Админка
/settings — Профиль пользователя

Авторизация:

контекст src/lib/AuthContext.jsx;
проверка пользователя через base44.auth.me();
при успешном входе запускаются:
инициализация администратора (AdminInitializer);
инициализация подписок (initSubscriptions);
фоновые задачи (BackgroundSyncService).

Доступ к данным:

основной путь — base44.entities.* (CRUD по сущностям через Base44 SDK);
часть функций вызывает base44.integrations.Core.InvokeLLM(...) для enrichment и синхронизации данных.
4.2 Backend (локальный API)

Точка входа:

backend/src/server.js

Основные возможности:

Health-check: GET /healthz
Auth:
POST /auth/register
POST /auth/login
POST /auth/logout
GET /auth/me
Queue:
POST /queue/enqueue
OpenAPI:
GET /openapi.json
GET /docs
Generic CRUD:
/entities/<EntityName> (список, создание, bulk, update-many, удаление, read/update/delete by id)

Все entity-маршруты защищены requireAuth (JWT Bearer или cookie).

4.3 Фоновые процессы
В браузере (frontend runtime)
BackgroundSyncService:
синхронизация логистических справочников (первый запуск через 30 сек, затем каждый час);
синхронизация активных товаров (первый запуск через 1 мин, затем каждые 15 мин);
запуск SyncScheduler.
SyncScheduler:
периодическая синхронизация (default 30 мин);
получение клиентов с wb_api_token;
синхронизация продаж за последние 7 дней через WB Statistic API;
параллельная загрузка актуальных цен и складских остатков;
хранит логи в localStorage.
На сервере
backend/src/worker.js обрабатывает BullMQ очередь base44-jobs.
Реализованные обработчики:
wb:collect:product - сбор данных товара с WB API;
sync-client - синхронизация клиента;
sync-project - синхронизация проекта;
sync-product - синхронизация товара.
Broadcast scheduler:
проверка due broadcast schedules каждую минуту;
выполнение автоматических рассылок (daily, weekly, subscription_expiring);
обновление next_run_at для следующей итерации.
Схема архитектуры

Приведенная ниже диаграмма иллюстрирует общую архитектуру приложения: взаимодействие пользователя с фронтендом, связь фронтенда и API, использование базы данных и очереди, а также работу фонового воркера.

5. Основные бизнес‑модули <a name="section-5"></a>
5.1 Административная панель

Файлы:

src/pages/Admin.jsx - главная страница админки
src/components/admin/AdminOverview.jsx - обзорная панель с метриками
src/components/admin/AdminBroadcasts.jsx - управление рассылками
src/components/admin/AdminCollectionRunner.jsx - запуск pipeline сбора данных
src/components/admin/AdminDashboardGrid.jsx - настраиваемая сетка виджетов
Метрики системы (AdminOverview)
Системные метрики: CPU, память, uptime процесса Node.js
Метрики БД: пользователи, подписки, продукты, очередь заданий
Статистика BullMQ: счётчики заданий (waiting, active, delayed, failed)
Активность пользователей: онлайн (последние 5 минут), визиты за день
Автоматическое обновление каждые 30 секунд через React Query
Система рассылок (AdminBroadcasts)
Создание broadcast с title, body, audience, category
Аудитории: all, active_subscribers, paid_accounts, admins
Немедленная отправка (send_now) или планирование
Автоматические рассылки по расписанию (daily, weekly, subscription_expiring)
Worker процесс проверяет due schedules каждую минуту
Массовая вставка сообщений в user_messages для получателей
Collection Runner (pipeline сбора данных)

Этапы pipeline:

validate-input - валидация конфигурации прогона
collect-marketplace-data - сбор данных из WB API или mock
normalize-events - нормализация событий
save-raw-frames - сохранение сырых данных в БД
update-snapshots - создание product snapshots
calculate-unit-economics - расчёт юнит-экономики
verify-results - верификация результатов
build-report - построение отчёта
Отслеживание активности пользователей (heartbeat)
Клиент отправляет heartbeat с session_id и path
UPSERT активности в user_activity таблицу
Подсчёт онлайн пользователей (last_seen_at за последние 5 минут)
Статистика визитов за день (уникальные пользователи)
Настраиваемая dashboard сетка (AdminDashboardGrid)
Drag-and-drop компоновка блоков метрик
Сохранение layout в localStorage
Изменение размера блоков (span: 1 → 2 → 3 → full)
Автоматическое сохранение изменений
5.2 Синхронизация данных Wildberries

Примечание: Для понимания расчётов логистики и комиссий, которые используются при синхронизации, см. также раздел Юнит‑экономика
.

Файлы:

backend/src/wildberries-routes.js - API endpoints
backend/src/wildberries-public-api.js - публичный API WB
backend/src/wildberries-seller-api.js - Seller API WB
backend/src/wildberries-repository.js - сохранение данных
src/lib/WildberriesSync.js - клиентская синхронизация
src/lib/LogisticsService.js - расчёт логистики
src/lib/CommissionService.js - определение комиссии
Синхронизация товара через API
POST /wildberries/products/:productId/sync - точка входа
Валидация прав пользователя на товар
Сбор данных из трёх публичных endpoints WB:
card.json с basket hosts - детальная информация
cards-detail API - цены, остатки, варианты
search API - fallback при недоступности cards-detail
Построение профиля товара с мержем данных
Сохранение в БД: wb_raw, product_snapshots, price_history
Обновление товара в products с новыми ценами и габаритами
Синхронизация справочника логистики
POST /wildberries/clients/:clientId/logistics-directions/sync
Параллельные запросы к Seller API:
GET /api/v3/offices - ПВЗ маркетплейса
GET /api/v3/warehouses - склады
GET /api/v2/supplies/warehouses - склады поставок
Нормализация данных в единый формат
Upsert в logistics_directories таблицу
Обновление существующих записей
Синхронизация справочника комиссий
POST /wildberries/clients/:clientId/commission-directory/sync
GET /api/v1/tariffs/commission через Seller API
Нормализация категорий и процентов комиссий
Приоритет полей: kgvpMarketplace > kgvpSupplier > commission
Upsert в marketplace_commission_directories таблицу
BullMQ worker для фоновой обработки
Worker обрабатывает задачи типа wb:collect:product
UPDATE статуса задачи на 'running'
Сбор данных из публичных API
Сохранение результатов в БД
UPDATE статуса на 'done' с progress = 100
Клиентская фоновая синхронизация (BackgroundSyncService)
Таймер синхронизации логистики: первый запуск через 30 сек, затем каждый час
Таймер синхронизации товаров: первый запуск через 1 мин, затем каждые 15 мин
Синхронизация каждого товара со статусом active
Обновление товара в БД с новыми ценами и временем синхронизации
Сохранение истории цен в price_history
Клиентская синхронизация продаж и цен (SyncScheduler)
Периодическая синхронизация (default 30 мин)
Получение клиентов с wb_api_token
Синхронизация продаж за последние 7 дней через WB Statistic API
Параллельная загрузка актуальных цен и складских остатков
Создание записей SalesData и PriceHistory
Расчёт логистических затрат (LogisticsService)
Получение тарифов из справочника по direction_id
Расчёт оплачиваемого веса: max(физический вес, объёмный вес)
Объёмный вес = литры / 5
Первые 50г включены в базовую ставку
Доплата за вес > 50г по тарифу per_kg
Расчёт стоимости хранения
Определение комиссии WB (CommissionService)
Приоритет: справочник > product.wb_commission_pct > default
Поиск в справочнике по category_id или category_name
Выбор поля комиссии по режиму:
FBS → kgvpSupplier
FBO → kgvpMarketplace
Извлечение комиссии: commission_by_model > commission_pct
5.3 Юнит‑экономика <a name="section-5-3"></a>

Файл: src/lib/unitEconomics.js

Ключевые расчеты:

price net, налоги, комиссия, промо;
себестоимость с учётом брака (cogsBase * (1 + wasteRate));
переменные расходы: логистика FBO/FBS, маркетинг (CAC * paidShare);
gross profit = revenue - variableCost;
contribution = grossProfit - marketingCost;
BEP (точка безубыточности) = fixedMonthly / contribution;
налоговая база по системе УСН (Доходы vs Доходы-Расходы).
Калькулятор юнит-экономики

Файл: src/pages/Calculator.jsx

Инициализация:

Загрузка товаров, справочников логистики, комиссий, истории цен
Выбор товара и построение seed-данных из снапшотов
Определение комиссии WB из справочника
Расчёт логистических затрат для seed-формы

Основной расчёт:

Функция calculate() вызывает calculateDonorUnitEconomics()
Нормализация входных данных (snake_case/camelCase)
Расчёт себестоимости с браком
Расчёт налогов по системе УСН
Расчёт contribution margin
Расчёт точки безубыточности

Синхронизация с WB API:

Кнопка синхронизации в MarketplaceDataSync компоненте
POST запрос на /wildberries/products/:id/sync
Маппинг актуальной цены из ответа API
Инвалидация кэша React Query
Обновление формы калькулятора с новыми данными

Сохранение расчёта:

Сбор form + product_id + project_id
buildCalculationPayload объединяет данные и результаты расчёта
Добавление метрик: contribution, gross_profit, bep_units
base44.entities.Calculation.create() отправляет POST запрос
Инвалидация кэша для обновления списка расчётов
Система версионирования и черновиков

Файлы:

src/lib/calculatorDraftStorage.js
src/components/calculator/VersionsPanel.jsx

Функциональность:

State для хранения множественных версий расчёта
Создание новой версии сценария расчёта
Автосохранение черновика в sessionStorage при изменениях
Проверка наличия черновика при выборе товара
Восстановление черновика через диалог
Отображение contribution для каждой версии
Визуализация структуры затрат и чувствительности

Файлы:

src/lib/calculatorViewModel.js
src/components/calculator/CostBreakdownChart.jsx
src/components/calculator/SensitivityChart.jsx

CostBreakdownChart:

buildCostBreakdown группирует затраты
withPct вычисляет долю каждой статьи в общих затратах
Recharts PieChart отображает структуру затрат

SensitivityChart:

Генерация точек для анализа чувствительности
Изменение параметра в диапазоне
Множественные вызовы calculate для построения кривой
Recharts LineChart показывает влияние параметра на прибыль
5.4 Collection Runner (админский pipeline) <a name="section-5-4"></a>

Файл: src/lib/CollectionRunPipelineService.js

Этапы pipeline:

validate-input - валидация конфигурации прогона
collect-marketplace-data - сбор данных из WB API или mock
normalize-events - нормализация событий
save-raw-frames - сохранение сырых данных в БД
save-events - сохранение событий
update-snapshots - создание product snapshots
calculate-unit-economics - расчёт юнит-экономики
verify-results - верификация результатов
build-report - построение отчёта
Схема pipeline

Следующая блок‑схема показывает последовательность этапов pipeline:

Runner управляется через UI:

src/components/admin/AdminCollectionRunner.jsx
5.5 Подписки и фичи

Файлы:

src/lib/subscriptionService.js
src/lib/initSubscriptions.js
админские UI-компоненты в src/components/admin/*Subscriptions*

Реализованы тарифы:

basic
standard
standard_plus
maximum
Сводная таблица модулей
Модуль	Ключевые файлы	Назначение
Административная панель	Admin.jsx, AdminOverview.jsx, AdminBroadcasts.jsx, AdminCollectionRunner.jsx, AdminDashboardGrid.jsx	Управление системой: метрики, рассылки, запуск сбора данных и настраиваемая сетка виджетов
Синхронизация Wildberries	wildberries-routes.js, wildberries-public-api.js, wildberries-seller-api.js, wildberries-repository.js, WildberriesSync.js, LogisticsService.js, CommissionService.js	Сбор и обновление данных о товарах, логистических направлениях и комиссиях через API Wildberries
Юнит‑экономика	unitEconomics.js, Calculator.jsx	Расчёт себестоимости, налогов, валовой прибыли, contribution margin и точки безубыточности
Collection Runner	CollectionRunPipelineService.js	Реализация ETL‑pipeline ingestion и расчётов (см. схему выше)
Подписки и фичи	subscriptionService.js, initSubscriptions.js	Управление тарифами, подписками и дополнительными возможностями пользователей

Каждая из этих групп подробно описана в соответствующих подразделах раздела 5.

6. Аутентификация и авторизация <a name="section-6"></a>

Файлы:

backend/src/auth.js - JWT функции и middleware
backend/src/auth-routes.js - маршруты регистрации и входа
backend/src/entity-access.js - контроль доступа к данным
backend/scripts/create-admin.js - скрипт создания администратора
src/lib/AuthContext.jsx - React контекст авторизации
src/api/base44Client.js - API клиент с авторизацией
JWT авторизация
JWT токены с httpOnly cookies
Секретный ключ: JWT_SECRET
Время жизни токена: JWT_EXPIRES_IN
Имя cookie: AUTH_COOKIE_NAME
Payload токена: { sub: user.id, email: user.email, role: user.role }
Хеширование паролей
Используется bcryptjs с 10 раундами соли
Хеширование при регистрации: bcrypt.hash(password, 10)
Хеширование в admin скрипте: bcrypt.hash(password, 10)
Сравнение при входе: bcrypt.compare(password, hash)
Регистрация пользователя
POST /auth/register
Валидация email и пароля
Хеширование пароля через bcrypt
INSERT в app_users: email, full_name, role, password_hash, created_by
Генерация JWT токена
Установка httpOnly cookie
Возврат токена и пользователя
Вход пользователя
POST /auth/login
SELECT password_hash из app_users по email
Сравнение пароля через bcrypt.compare
При несовпадении: 401 error без деталей
При успехе: генерация JWT токена
Установка httpOnly cookie
Возврат токена и пользователя
Role-based access control

Роли пользователей:

admin - полный доступ ко всем данным
user - доступ только к своим данным (created_by = email)

Middleware:

requireAuth - проверка JWT токена
requireRole(...roles) - проверка роли пользователя
Контроль доступа к данным

Фильтрация по владельцу:

При создании записи: created_by = email пользователя
При чтении записей: добавление WHERE created_by = $N для обычных пользователей
Администраторы видят все записи без фильтрации
Реализовано в buildAccessClause (entity-access.js)

Generic CRUD маршруты:

/entities/<EntityName> - автоматическая фильтрация по владельцу
Админы обходят фильтрацию через isAdminAuth(auth)
Создание администратора

Скрипт: backend/scripts/create-admin.js

Хеширование пароля через bcrypt
INSERT/UPDATE app_users с role='admin'
Используется для первоначальной настройки системы
7. Модель данных <a name="section-7"></a>

Сущности (папка entities/ + backend definitions):

Client, Project, Product, Calculation
RawMarketplaceFrame, MarketplaceEvent
ProductSnapshot, SellerSnapshot, UnitEconomicsSnapshot
IngestionRun, DeadLetter, SyncCursor
SalesData, PriceHistory, LogisticsDirectory
LogisticsDirectory - справочники логистики (ПВЗ, склады, тарифы)
MarketplaceCommissionDirectory - справочники комиссий по категориям
Subscription, Feature, UserSubscription
User (описан в backend schema)
app_users - таблица пользователей с полями: id, email, full_name, role, password_hash, created_date, updated_date
user_activity - отслеживание активности пользователей (session_id, path, last_seen_at)
admin_broadcasts - рассылки пользователям (title, body, audience, category, status)
broadcast_schedules - расписания автоматических рассылок (cadence, next_run_at, last_run_at)
user_messages - сообщения пользователей в inbox
admin_metric_snapshots - снапшоты системных метрик (cpu_load_pct, memory_used_bytes)
wb_jobs - задачи BullMQ для синхронизации WB (status, progress, result)

Группы данных:

Core business: клиенты/проекты/товары/расчеты
Ingestion/ETL: raw frames, events, runs, dead letters, cursors
Analytics snapshots: product/seller/unit snapshots
Commerce support: sales/price/logistics/commission directories
Access/billing: users/subscriptions/features
Admin: broadcasts, schedules, user messages, metric snapshots
Activity: user_activity для отслеживания онлайн пользователей
Jobs: wb_jobs для BullMQ очереди
8. Конфигурация и переменные окружения <a name="section-8"></a>
8.1 Frontend (.env.local)
VITE_BASE44_APP_ID
VITE_BASE44_APP_BASE_URL
VITE_BASE44_FUNCTIONS_VERSION (опционально)
BASE44_LEGACY_SDK_IMPORTS (true|false)
VITE_CACHE_DIR (опционально, для Vite)
8.2 Backend
PORT (default 3000)
DATABASE_URL (или POSTGRES_*)
REDIS_URL
JWT_SECRET
JWT_EXPIRES_IN
AUTH_COOKIE_NAME
CORS_ORIGIN
ALLOW_ROLE_OVERRIDE
NODE_ENV
WB_SELLER_API_TIMEOUT_MS (default 15000)
BROADCAST_SCHEDULER_INTERVAL_MS (default 60000)
Таблица переменных окружения
Категория	Переменная	Описание
Frontend	VITE_BASE44_APP_ID	Идентификатор приложения
Frontend	VITE_BASE44_APP_BASE_URL	Базовый URL для фронтенда
Frontend	VITE_BASE44_FUNCTIONS_VERSION	Версия функций (опционально)
Frontend	BASE44_LEGACY_SDK_IMPORTS	Разрешить импорт устаревшего SDK (true/false)
Frontend	VITE_CACHE_DIR	Каталог кэша для Vite (опционально)
Backend	PORT	Порт API сервера (по умолчанию 3000)
Backend	DATABASE_URL / POSTGRES_*	Параметры подключения к PostgreSQL
Backend	REDIS_URL	URL сервера Redis
Backend	JWT_SECRET	Секретный ключ для подписи JWT
Backend	JWT_EXPIRES_IN	Время жизни токена
Backend	AUTH_COOKIE_NAME	Имя cookie для авторизации
Backend	CORS_ORIGIN	Разрешённые источники CORS
Backend	ALLOW_ROLE_OVERRIDE	Возможность переопределения роли
Backend	NODE_ENV	Среда запуска (production/development)
Backend	WB_SELLER_API_TIMEOUT_MS	Таймаут для Seller API (мс)
Backend	BROADCAST_SCHEDULER_INTERVAL_MS	Интервал планировщика рассылок (мс)

Эта таблица дублирует информацию из списков выше в компактном виде и помогает быстрее найти нужную переменную.

9. Локальный запуск <a name="section-9"></a>
9.1 Frontend
npm install
npm run dev
9.2 Backend
cd backend
npm install
npm run dev
9.3 Полный стек через Docker
docker compose up --build

Сервисы в docker-compose.yml:

app (frontend image)
api (Express)
worker (BullMQ worker)
postgres
redis
nginx
10. API и контракты <a name="section-10"></a>

Локальный backend публикует:

OpenAPI JSON: /api/openapi.json (через nginx-прокси)
Swagger UI: /api/docs

Entity API типовой:

GET /entities/<Entity>
POST /entities/<Entity>
POST /entities/<Entity>/bulk
PATCH /entities/<Entity>/update-many
GET /entities/<Entity>/:id
PUT /entities/<Entity>/:id
DELETE /entities/<Entity>/:id

Wildberries API endpoints:

POST /wildberries/products/:productId/sync - синхронизация товара
POST /wildberries/clients/:clientId/logistics-directions/sync - синхронизация справочника логистики
POST /wildberries/clients/:clientId/commission-directory/sync - синхронизация справочника комиссий

Admin API endpoints:

GET /admin/metrics - получение системных метрик
POST /activity/heartbeat - отправка heartbeat активности пользователя
POST /admin/broadcasts - создание рассылки
11. Известные расхождения и риски <a name="section-11"></a>

Ниже перечислены фактические несоответствия, обнаруженные в кодовой базе:

Админские разделы AdminDocumentation / AdminSwagger ссылаются на legacy endpoint /functions/ingestion-receive, но локальный backend реализует /api/* и не содержит /functions/*.
CollectionRunPipelineService считает durationMs через context.startedAt, который не инициализируется в контексте (риск некорректной длительности).
В CollectionRunPipelineService используется import { v4 as uuidv4 } from 'uuid', но пакет uuid не объявлен явно в корневом package.json (риск окружений с иным hoisting).
AdminOverview ожидает поля eventsProcessed/eventsError в корне IngestionRun, тогда как фактические счетчики хранятся в run.counters.
AdminScheduledTasks отображает cron-like задачи в UI, но реальный серверный scheduler для этих задач в backend отсутствует.
SyncScheduler и часть background-логики используют localStorage, то есть состояние живет на клиенте браузера, а не на сервере.
В коде frontend часть функций синхронизации получает внешние данные через InvokeLLM (не deterministic источник), это нужно учитывать для production-процессов.
Система heartbeat использует клиентскую отправку данных, что может быть подвержено манипуляциям и не отражает реальную активность при закрытом браузере.
Broadcast scheduler работает в worker процессе, но не имеет механизма обработки ошибок и retry логики для неудачных рассылок.
Справочники логистики и комиссий синхронизируются через Seller API, но нет механизма автоматического обновления при изменении тарифов WB.
12. Рекомендации по стабилизации <a name="section-12"></a>
Унифицировать ingestion API: выбрать один контракт (/api/... или /functions/...) и привести админ-документацию/UI к нему.
Перенести критические планировщики из браузера в backend worker/scheduler.
Исправить модель IngestionRun в UI (единое чтение counters и timeline).
Явно добавить uuid в зависимости frontend, если Collection Runner используется в runtime.
Разделить в документации и UI:
production pipeline с реальными интеграциями;
demo/mock сценарии.
Реализовать серверную систему heartbeat с валидацией session_id для более точного отслеживания активности.
Добавить механизм retry и обработки ошибок для broadcast scheduler.
Реализовать автоматическое обновление справочников логистики и комиссий по расписанию или при изменении тарифов WB.
Добавить мониторинг и алерты для BullMQ очереди и worker процессов.
Реализовать централизованное хранение логов синхронизации на сервере вместо localStorage.