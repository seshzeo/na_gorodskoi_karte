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
- `VITE_MAP_TILE_URL` — необязательный URL шаблона растровых тайлов вида `https://.../{z}/{x}/{y}.png`.
- `VITE_MAP_TILE_ATTRIBUTION` — необязательная строка атрибуции для пользовательского источника тайлов; укажите требуемую провайдером атрибуцию.
- `VITE_MAP_STYLE_URL` — необязательный URL векторного стиля Mapbox/MapTiler (`style.json`); рендерится через `ol-mapbox-style` и имеет приоритет над `VITE_MAP_TILE_URL`. Если обе переменные пусты или стиль не загрузился, используется стандартный слой OpenStreetMap.
- `VITE_MAP_STYLE_URL_DARK` — необязательный URL тёмного векторного стиля; применяется автоматически при активной тёмной теме интерфейса. Если не задан, в тёмной теме используется `VITE_MAP_STYLE_URL`.
- `VITE_MAPTILER_API_KEY` — публичный ключ браузера, используемый локальными стилями MapTiler. Он виден в клиентском bundle и сетевых запросах: ограничьте его разрешёнными доменами и квотами; не используйте секретные ключи.

`VITE_MAP_STYLE_URL` и `VITE_MAP_STYLE_URL_DARK` могут указывать как на внешний `style.json` (MapTiler/Mapbox), так и на локальный файл в `app/frontend/public/` (например, `/styles/map-light.json`) — локальные файлы раздаются приложением и не требуют внешнего хостинга. В локальных стилях ключ заменяется на `VITE_MAPTILER_API_KEY` при загрузке.

### Стили карты и архивация

Тема карты генерируется локальным скриптом `tools/generate-map-light-theme.mjs` из любого `style.json`: скрипт десатурирует и приводит цвета к единой мягкой гамме (сохраняя оттенки) и возвращает дорогам и зданиям контраст. Поддерживаются два режима — светлый и тёмный (режим `dark`), построенные по одному «рецепту», поэтому темы стилистически едины.

```
node tools/generate-map-light-theme.mjs <url-style.json> <выходной.json> [dark]
```

Скрипт сохраняет ключи в ссылках на сервисы как плейсхолдеры; задайте публичный ключ локально в `app/frontend/.env.local` через `VITE_MAPTILER_API_KEY`.

Текущие темы — локальные файлы:
- светлая: `public/styles/map-light.json` (`VITE_MAP_STYLE_URL=/styles/map-light.json`)
- тёмная: `public/styles/map-dark.json` (`VITE_MAP_STYLE_URL_DARK=/styles/map-dark.json`)

Архив прежних тем (для быстрого возврата строкой в `.env`):

```
VITE_MAP_STYLE_URL=https://api.maptiler.com/maps/01a1e4c1-d311-74c5-bf73-db673973f426/style.json?key=<MAPTILER_KEY>
VITE_MAP_STYLE_URL_DARK=https://api.maptiler.com/maps/streets-v2-dark/style.json?key=<MAPTILER_KEY>
```

## Production build и cache

`npm run build` запускает TypeScript project build и Vite production build. Для production рекомендуется отдавать hashed assets с длительным immutable cache, а `index.html` и manifest обновлять с коротким cache/revalidation. Конкретные HTTP cache headers задаются web server/CDN, а не этим README.

## Связанные документы

- [Общий README проекта](../../README.md)
- [Backend README](../backend/README.md)
