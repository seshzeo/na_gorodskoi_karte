# Frontend — «На городской карте»

Клиентское приложение городской карты на React, TypeScript и Vite. Frontend включает адаптивный интерфейс, карту OpenLayers, кабинет модератора и PWA-оболочку.

## Стек

- React 19 + TypeScript
- Vite 7
- OpenLayers 10
- TanStack Query 5
- Zustand 5
- React Router 7
- Vitest + Testing Library + coverage-v8
- vite-plugin-pwa (Workbox)

## Архитектура

```text
src/
  pages/       # страницы карты и модератора
  widgets/     # AppLayout, MapWidget и крупные UI-блоки
  features/    # пользовательские сценарии и действия
  entities/    # доменные сущности и query hooks
  shared/      # API-клиент, тема, стили и общие утилиты
  test/        # unit/component tests
public/
  manifest.webmanifest
  pwa-192x192.png
  pwa-512x512.png
```

## Реализованный интерфейс

- Интерактивная карта с загрузкой точек по текущему bbox.
- Фильтр категорий и выбор точки с отображением карточки.
- Публичная форма отправки заявки на добавление точки.
- Адаптивная навигация и боковая панель.
- Light / Dark / System темы; выбранный режим сохраняется в localStorage.
- Кабинет модератора: очередь заявок и управление опубликованными точками.
- Обработка ошибок API в пользовательских сценариях.

## Design System

Визуальное направление: минимализм, сдержанный glassmorphism для навигации и адаптивная компоновка.

- Семантические CSS-переменные и дизайн-токены находятся в `src/shared/styles/tokens.css` и `themes.css`.
- Переключение Light / Dark / System реализовано через ThemeProvider.
- На мобильных устройствах навигация адаптируется под компактный экран.
- Внешний вид картографических тайлов зависит от выбранного tile provider; текущую конфигурацию нужно оценивать отдельно от темы интерфейса.

## Локальный запуск

Требуются Node.js и npm. Из корня репозитория:

```powershell
cd app/frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Vite dev server: http://127.0.0.1:5173

По умолчанию `VITE_API_URL=/api/v1`. Dev server проксирует `/api` на `http://127.0.0.1:8000`. Backend должен быть запущен отдельно. Для другой конфигурации задайте `VITE_API_URL` в локальном `.env`.

## Команды

```powershell
npm run dev           # dev server
npm run test          # однократный запуск тестов
npm run test:watch    # тесты в watch-режиме
npm run test:coverage # тесты и coverage
npm run build         # TypeScript check + production build
npm run preview       # локальный просмотр production build
```

## PWA

PWA настраивается через `vite-plugin-pwa`, manifest хранится в `public/manifest.webmanifest`, иконки — в `public/pwa-192x192.png` и `public/pwa-512x512.png`.

- Service Worker регистрируется автоматически и использует стратегию обновления `autoUpdate`.
- Workbox precache-ит статические ресурсы production-сборки.
- Navigation fallback направляет клиентские маршруты на `index.html`, но исключает `/api`.
- Runtime caching не настроен: API и внешние картографические тайлы не сохраняются.

Следовательно, после первой загрузки может открыться статическая оболочка интерфейса, но карта без сети, данные и операции недоступны. Это не полноценный offline-first режим.

### Установка

Для установки с телефона откройте production-сайт через HTTPS.

- Android: Chrome → меню браузера → «Установить приложение» (или аналогичный пункт).
- iOS: Safari → «Поделиться» → «На экран Домой».

Локальный адрес по HTTP через LAN IP (например, `http://192.168.x.x:5173`) не является secure context и не подходит для полноценной проверки Service Worker/PWA installability. Для тестирования на телефоне используйте HTTPS staging или production deployment. `localhost` — специальное исключение только на самом устройстве.

## Конфигурация

Пример переменных находится в `.env.example`:

- `VITE_API_URL` — базовый URL API, по умолчанию `/api/v1`.
- `VITE_MAP_TILE_URL` — необязательный URL шаблона картографических тайлов.

Не помещайте секретные ключи в `VITE_*`: такие значения встраиваются в клиентский bundle и доступны пользователям.

## Production build и cache

`npm run build` запускает TypeScript project build и Vite production build. Для production рекомендуется отдавать hashed assets с длительным immutable cache, а `index.html` и manifest обновлять с коротким cache/revalidation. Конкретные HTTP cache headers задаются web server/CDN, а не этим README.

## Связанные документы

- [Общий README проекта](../../README.md)
- [Backend README](../backend/README.md)
