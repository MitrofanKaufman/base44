# Velocis - Аналитическая платформа Wildberries

Проект для юнит-экономики и аналитики Wildberries, созданный на React + Vite.

## Стек технологий

- **Frontend**: React 18, Vite
- **UI**: Tailwind CSS, Radix UI, Lucide Icons
- **State Management**: TanStack Query
- **Routing**: React Router
- **Backend**: Base44 Platform

## Структура проекта

```
src/
├── pages/          # Страницы приложения
│   ├── Dashboard.jsx
│   ├── Clients.jsx
│   ├── Projects.jsx
│   ├── Products.jsx
│   └── Calculations.jsx
├── components/      # UI компоненты
├── lib/            # Утилиты и хелперы
├── api/            # API клиенты
├── hooks/          # Кастомные хуки
└── utils/          # Вспомогательные функции
```

## Основные функции

- **Дашборд**: Обзор ключевых метрик
- **Клиенты**: Управление клиентской базой
- **Проекты**: Отслеживание проектов
- **Товары**: Каталог товаров Wildberries
- **Расчёты**: Юнит-экономика и аналитика

## Установка и запуск

```bash
npm install
npm run dev
```

## Особенности дизайна

- Тёплая палитра в стиле SaaS-кабинета
- Адаптивный дизайн с sidebar навигацией
- Мягкие тени и скругления
- Терракотовый акцент (#9a3412)

## Лицензия

Приватный проект