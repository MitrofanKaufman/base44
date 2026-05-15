# Правила и инструкции для агента Devin

## Общая информация о проекте

Base44-app - это full-stack приложение для управления бизнес-процессами с интеграцией Wildberries API.

### Технологический стек

**Frontend:**
- React 18.2.0 + Vite 6.1.0
- Tailwind CSS для стилизации
- Radix UI компоненты (@radix-ui/*)
- React Router для маршрутизации
- TanStack Query для управления состоянием
- React Hook Form + Zod для форм и валидации
- TypeScript для проверки типов (сheckJs: true)

**Backend:**
- Node.js (ES modules)
- Кастомный Express-like сервер
- PostgreSQL + Redis через Docker
- Интеграция с Wildberries API
- JWT авторизация

### Структура проекта

```
├── src/                    # Frontend код
│   ├── components/         # React компоненты
│   │   ├── admin/         # Админ-панель компоненты
│   │   └── ui/            # UI компоненты (Radix)
│   ├── pages/             # Страницы приложения
│   ├── api/               # API клиенты
│   ├── lib/               # Утилиты и хелперы
│   └── types/             # TypeScript типы
├── backend/               # Backend код
│   └── src/               # Исходный код бэкенда
│       ├── admin-service.js
│       ├── entity-access.js
│       ├── wildberries-*.js
│       └── server.js
└── .devin/               # Конфигурация Devin
```

## Команды для разработки

### Запуск проекта
```bash
# Запуск frontend
npm run dev

# Запуск backend (в отдельном терминале)
cd backend && npm run dev

# Запуск зависимостей (Docker)
docker compose up -d postgres redis
```

### Сборка и проверка
```bash
npm run build           # Сборка проекта
npm run lint           # Проверка линтером
npm run lint:fix       # Исправление линтером
npm run typecheck      # Проверка типов
```

### Тестирование
```bash
# Все тесты
npm run test:unit-economics
npm run test:backend-access
npm run test:wb-logistics
npm run test:wb-collector
```

## Правила кодирования

### Frontend
1. Используйте JSX расширения (.jsx) для компонентов
2. Следуйте структуре папок: components/[feature]/ComponentName.jsx
3. Используйте named exports для компонентов
4. Применяйте алиасы импортов: `@/` для src, `@/components/ui/*` для UI компонентов
5. Используйте React Query для API запросов
6. Применяйте Radix UI компоненты из @radix-ui/react-*
7. Используйте tailwind-merge и clsx для объединения классов

### Backend
1. Используйте ES modules (.mjs для тестов)
2. Разделяйте маршруты, сервисы и репозитории
3. Следуйте структуре: backend/src/[feature]-*.js
4. Используйте async/await для асинхронных операций
5. Обрабатывайте ошибки корректно
6. Добавляйте тесты для новых функций

### Общие правила
1. Сохраняйте существующий стиль кодирования
2. Не добавляйте избыточные комментарии
3. Используйте JSDoc для сложных функций
4. Следуйте принципу единой ответственности
5. Избегайте циклических зависимостей

## Работа с окружением

### Обязательные переменные окружения
- `VITE_API_BASE_URL` - базовый URL API
- `VITE_API_PROXY_TARGET` - target для proxy
- `VITE_BASE44_APP_ID` - ID приложения
- `VITE_BASE44_APP_BASE_URL` - базовый URL приложения

### Docker сервисы
- PostgreSQL: база данных
- Redis: кэширование и очереди

## Интеграции

### Wildberries API
- Public API: wildberries-public-api.js
- Seller API: wildberries-seller-api.js
- Directory Service: wildberries-directory-service.js
- Repository: wildberries-repository.js

### Base44 SDK
- Основной SDK: @base44/sdk
- Vite плагин: @base44/vite-plugin
- Legacy импорты: @/integrations, @/entities (если BASE44_LEGACY_SDK_IMPORTS=true)

## Админ-панель

Админ-панель находится в `src/components/admin/` и включает:
- AdminDashboardGrid - дашборд
- AdminOverview - обзор системы
- AdminEvents - события
- AdminScheduledTasks - запланированные задачи
- AdminSnapshots - снепшоты
- AdminSettings - настройки
- AdminSwagger - документация API

## Тестирование

### Unit тесты
- Фронтенд логика: src/lib/unitEconomics.test.mjs
- Бэкенд сервисы: backend/src/*.test.mjs

### Запуск тестов
```bash
# Unit economics
npm run test:unit-economics

# Backend access
npm run test:backend-access

# Wildberries логистика
npm run test:wb-logistics

# Wildberries коллектор
npm run test:wb-collector
```

## Git рабочий процесс

1. Основная ветка: `main`
2. Текущая ветка: `unit-econ-donor-parity`
3. Формат коммитов: `[type]: description`
4. Типы: feat, fix, refactor, chore, docs, test

## Важные замечания

1. Проект использует checkJs: true, но основной код на JavaScript
2. UI компоненты из Radix UI имеют специфические паттерны использования
3. Backend использует кастомный маршрутизатор, не Express
4. Wildberries API требует внимательной обработки ошибок
5. Админ-панель имеет специальные права доступа
6. Docker контейнеры должны быть запущены для полноценной разработки

## Частые задачи

### Добавление нового компонента
1. Создать файл в src/components/[category]/ComponentName.jsx
2. Использовать существующие компоненты как пример
3. Следовать паттернам Radix UI если это UI компонент
4. Добавить экспорт в index файл если нужен

### Добавление нового API endpoint
1. Создать маршрут в backend/src/[feature]-routes.js
2. Добавить логику в соответствующий сервис
3. Добавить тесты
4. Обновить swagger документацию

### Изменение стилей
1. Использовать Tailwind CSS классы
2. Применять tailwind-merge для объединения классов
3. Следовать существующей цветовой схеме
4. Использовать Radix UI компоненты для сложных UI элементов

## Диагностика проблем

### Frontend не собирается
- Проверьте npm install
- Проверьте типы: npm run typecheck
- Проверьте импорты и алиасы

### Backend не запускается
- Проверьте Docker контейнеры: docker compose ps
- Проверьте переменные окружения в .env
- Проверьте подключение к PostgreSQL и Redis

### Тесты падают
- Убедитесь что Docker контейнеры запущены
- Проверьте миграции базы данных
- Проверьте переменные окружения для тестов