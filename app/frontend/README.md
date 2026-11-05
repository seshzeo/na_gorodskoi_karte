# Frontend — «На городской карте»

React + TypeScript + Vite + TanStack Query + Zustand + OpenLayers.

## Архитектура

```
src/
  pages/                 # маршруты
  widgets/               # крупные UI-блоки
  features/              # пользовательские действия
  entities/              # доменные данные и query hooks
  shared/                # API, общие UI/lib/config
```

## Текущий foundation

- Vite + React + TypeScript
- BrowserRouter
- TanStack Query
- API client с единым ApiError
- OpenLayers
- bbox-загрузка точек
- кеш категорий 5 мин / 30 мин GC
- кеш точек 30 сек / 5 мин GC
- Vite proxy /api -> FastAPI
- публичная конфигурация отделена от секретов
- мобильный базовый layout
- публичная форма PointRequest
- placeholder маршрута /moderator

## Кеширование

Стратегия зафиксирована отдельно от UI: Browser HTTP Cache + TanStack Query + CDN/Edge Cache. Публичные GET допускают короткий CDN TTL; mutation и moderator API публично не кешируются. Hashed Vite assets в production должны отдаваться с immutable cache.

## Карта

Сейчас для foundation используется OSM через OpenLayers. Перед production выбираем конкретного провайдера карт и отдельно реализуем его правила attribution, tile caching и безопасной работы с ключами. Секретные ключи не помещаются в VITE_*.

## Запуск

```powershell
cd app/frontend
npm install
npm run dev
```

Frontend: http://127.0.0.1:5173
