# «На городской карте»

Интерактивная городская карта событий и постоянных мест. Пользователи просматривают точки на карте и отправляют предложения, а модераторы проверяют заявки и управляют опубликованными точками.

> **Состояние проекта:** frontend, backend API, модерация, автоматические тесты и installable PWA реализованы. Production-деплой на VPS и подключение публичного домена/HTTPS ещё нужно выполнить отдельно.

## Возможности

- Интерактивная карта на OpenLayers с загрузкой точек в пределах текущей области карты.
- Фильтрация точек по категориям и времени событий.
- Карточки точек с описанием и информацией о событии/месте.
- Публичная отправка заявок на добавление точки.
- Сессионная авторизация модератора с CSRF-защитой.
- Очередь заявок: просмотр, редактирование, одобрение и отклонение.
- Управление опубликованными точками: редактирование, архивация и восстановление.
- Управление категориями и журнал административных действий.
- Светлая, тёмная и системная темы; адаптивная навигация.
- PWA: Web App Manifest, иконки и Service Worker для precache статической оболочки.

## Технологический стек

| Часть | Технологии |
|---|---|
| Frontend | React 19, TypeScript, Vite 7 |
| Карта | OpenLayers |
| Клиентские данные | TanStack Query, Zustand |
| PWA | vite-plugin-pwa, Workbox |
| Backend | Python, FastAPI, Pydantic |
| ORM и БД | SQLAlchemy 2 Async, PostgreSQL, PostGIS, asyncpg, GeoAlchemy2 |
| Миграции | Alembic |
| Авторизация | Серверные сессии, HttpOnly cookie, CSRF-токены, Argon2id |
| Тесты | pytest, Vitest, Testing Library, coverage-v8 |
| CI | GitHub Actions |

## Структура репозитория

```text
.
├── app/
│   ├── backend/       # FastAPI, модели, API, сервисы, миграции и тесты
│   └── frontend/      # React-приложение и PWA
├── docs/              # Проектная документация и backlog
├── .github/workflows/ # CI
└── README.md
```

Подробные инструкции:
- [Backend: установка, конфигурация, API и безопасность](app/backend/README.md)
- [Frontend: архитектура, запуск, тестирование и PWA](app/frontend/README.md)

## Локальный запуск

### Требования

- Python 3.12 (рекомендуемая версия для текущего backend-окружения).
- Node.js и npm (актуальная LTS-версия).
- PostgreSQL с расширением PostGIS.
- Git.

### 1. Backend

Из корня репозитория в PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r app/backend/requirements.txt
Copy-Item app/backend/.env.example app/backend/.env
```

Откройте `app/backend/.env` и укажите корректный `DATABASE_URL`, а также разрешённые `CORS_ORIGINS`. Создайте отдельную PostgreSQL-базу с PostGIS. Затем примените миграции:

```powershell
python -m alembic -c app/backend/alembic.ini upgrade head
```

Запуск API:

```powershell
python -m uvicorn app.backend.main:app --reload
```

Адреса:
- API: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/v1/health

Создание первой учётной записи модератора:

```powershell
python -m app.backend.create_moderator
```

Команда интерактивно запросит логин и пароль. Используйте уникальный пароль длиной не менее 12 символов.

### 2. Frontend

В отдельном терминале PowerShell:

```powershell
cd app/frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Frontend: http://127.0.0.1:5173

В локальной разработке Vite проксирует запросы `/api` на backend `http://127.0.0.1:8000`. Для другой конфигурации API используйте `VITE_API_URL` в `app/frontend/.env`.

## Проверки

Из корня репозитория:

```powershell
# Backend tests
python -m pip install -r app/backend/requirements-dev.txt
python -m pytest app/backend/tests -q

# Frontend tests
Push-Location app/frontend
npm ci
npm run test:coverage
npm run build
Pop-Location
```

Migration integration tests в CI выполняются только на отдельной временной PostgreSQL/PostGIS базе и защищены дополнительными safety checks. Не запускайте destructive migration tests на пользовательской или production-базе.

GitHub Actions workflow: `.github/workflows/ci.yml`.

## PWA и offline-поведение

Production-сборка frontend содержит manifest и Service Worker. Service Worker кеширует собранные статические ресурсы интерфейса, чтобы оболочка приложения могла открываться после первой загрузки.

**Ограничения текущего offline-режима:**
- данные карты и API-запросы не кешируются;
- внешние картографические тайлы не кешируются;
- создание заявок, модерация и другие операции требуют сети.

Для установки PWA на Android и iOS нужен production-сайт по HTTPS (localhost является исключением для разработки). На iPhone установка выполняется через Safari → «Поделиться» → «На экран Домой». На Android Chrome должен распознать manifest и Service Worker; доступность пункта установки зависит также от браузера и условий установки.

## Deployment

Production-развёртывание ещё не описано как готовая автоматизированная процедура и не должно считаться настроенным только на основании локального запуска.

Целевая схема размещения:
- Nginx как reverse proxy и HTTPS termination;
- frontend production build;
- FastAPI/Uvicorn за reverse proxy;
- PostgreSQL с PostGIS;
- домен и TLS-сертификат;
- резервное копирование БД и проверенная процедура восстановления.

Перед production:
1. Подготовить отдельную базу и проверить резервное копирование/восстановление.
2. Настроить секреты окружения вне Git.
3. Установить `SESSION_COOKIE_SECURE=true`, HTTPS и точные `CORS_ORIGINS`.
4. Проверить cookie/SameSite/CSRF на реальном домене.
5. Применять миграции только после backup и проверки целевой БД.
6. Проверить health endpoint, логи, перезапуск процессов и обновление PWA.

**Важно:** не копируйте локальный `.env` в репозиторий и не помещайте секретные ключи в переменные frontend с префиксом `VITE_` — они попадут в браузерную сборку.

## Безопасность и данные

- Не храните пароли, токены, приватные ключи и реальные `.env` в Git.
- Для production используйте HTTPS и secure cookies.
- Не используйте `CORS_ORIGINS=*` при включённых credentials.
- Пользовательскую базу данных нельзя использовать для экспериментов с destructive миграциями.
- Перед миграциями production-базы обязательно создавайте и проверяйте backup.

## Лицензия

Лицензия в репозитории пока не указана.
