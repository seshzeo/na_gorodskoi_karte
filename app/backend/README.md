# Backend — «На городской карте»

REST API сервиса городской карты. Реализован на FastAPI с асинхронным доступом к PostgreSQL/PostGIS.

## Стек

- Python 3.12
- FastAPI + Uvicorn
- Pydantic 2 + pydantic-settings
- SQLAlchemy 2 Async + asyncpg
- GeoAlchemy2 + PostgreSQL/PostGIS
- Alembic
- Argon2id для хеширования паролей

## Установка (Windows PowerShell)

Команды выполняются из корня репозитория:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r app/backend/requirements.txt
Copy-Item app/backend/.env.example app/backend/.env
```

Создайте отдельную PostgreSQL-базу с установленным PostGIS. Настройте `DATABASE_URL` и `CORS_ORIGINS` в `app/backend/.env`. Не коммитьте этот файл.

Пример URL для asyncpg:

```text
postgresql+asyncpg://USER:PASSWORD@HOST:5432/DATABASE
```

## Миграции и запуск

```powershell
python -m alembic -c app/backend/alembic.ini upgrade head
python -m uvicorn app.backend.main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- OpenAPI: http://127.0.0.1:8000/openapi.json
- Health: http://127.0.0.1:8000/api/v1/health

Создание первой учётной записи модератора:

```powershell
python -m app.backend.create_moderator
```

Команда интерактивно запросит логин и пароль. Минимальная длина пароля — 12 символов. Публичной регистрации модераторов нет.

## Конфигурация

Шаблон переменных: `.env.example`.

| Переменная | Назначение |
|---|---|
| `APP_NAME` | Имя API |
| `APP_ENV` | Окружение |
| `API_V1_PREFIX` | Префикс API, по умолчанию `/api/v1` |
| `DATABASE_URL` | SQLAlchemy async URL PostgreSQL |
| `SESSION_COOKIE_NAME` | Имя cookie сессии |
| `SESSION_IDLE_TIMEOUT_SECONDS` | Таймаут бездействия, по умолчанию 86400 секунд |
| `SESSION_COOKIE_SECURE` | Для production за HTTPS установить `true` |
| `SESSION_COOKIE_SAMESITE` | SameSite policy cookie |
| `CORS_ORIGINS` | Список разрешённых origins через запятую |

Не используйте `CORS_ORIGINS=*` вместе с credentials. Для same-site deployment frontend и API удобнее публиковать под одним доменом через reverse proxy. При разнесении на разные домены отдельно проверьте CORS, SameSite, Secure и CSRF.

## API

Base URL: `/api/v1`.

### Служебные и публичные маршруты

| Метод | Endpoint | Назначение |
|---|---|---|
| GET | `/health` | Состояние API и БД |
| GET | `/categories` | Активные категории |
| GET | `/points` | Активные точки |
| GET | `/points/{id}` | Активная точка |
| GET | `/points/nearby` | Точки в радиусе координат |
| POST | `/point-requests` | Публичная отправка заявки |

`GET /points` поддерживает:
- `bbox=min_lon,min_lat,max_lon,max_lat` — область карты;
- повторяющиеся `category_id` — выбранные категории объединяются через OR;
- `event_after` и `event_before` — временные границы событий;
- `limit` — 1..500, по умолчанию 100;
- `offset` — неотрицательное смещение.

Даты передаются в ISO 8601 с часовым поясом. Прошедшие события автоматически не скрываются.

Ответ списка:

```json
{"items":[],"total":0,"limit":100,"offset":0}
```

Поле `total` отражает количество результатов после фильтрации, но до пагинации.

`GET /points/nearby` требует `latitude` и `longitude` (WGS84); `radius` — 1..50000 метров, по умолчанию 1000; `limit` — 1..200, по умолчанию 50.

### Заявки

| Метод | Endpoint | Доступ |
|---|---|---|
| POST | `/point-requests` | Публичный |
| GET | `/point-requests` | Модератор |
| GET | `/point-requests/{id}` | Модератор |
| PATCH | `/point-requests/{id}` | Модератор |
| POST | `/point-requests/{id}/approve` | Модератор |
| POST | `/point-requests/{id}/reject` | Модератор |

Список заявок поддерживает `status=pending|approved|rejected`, `category_id`, `created_after`, `created_before`, `limit` (1..200, default 50) и `offset`.

Одобрение выполняется транзакционно: ожидающая заявка создаёт точку и получает `point_id`; повторная обработка заявки возвращает конфликт.

### Управление точками модератором

| Метод | Endpoint | Назначение |
|---|---|---|
| GET | `/moderator/points` | Список точек |
| GET | `/moderator/points/{id}` | Просмотр, включая архивные |
| PATCH | `/moderator/points/{id}` | Редактирование |
| DELETE | `/moderator/points/{id}` | Архивация |
| POST | `/moderator/points/{id}/restore` | Восстановление |

Фильтры списка: `status=active|archived|all` (default active), `category_id`, `event_after`, `event_before`, `limit` (1..200, default 50), `offset`.

### Категории

| Метод | Endpoint | Назначение |
|---|---|---|
| GET | `/moderator/categories` | Все категории, включая неактивные |
| POST | `/categories` | Создание категории |
| PATCH | `/categories/{id}` | Изменение имени, slug и активности |
| DELETE | `/categories/{id}` | Удаление пользовательской категории |

Встроенные категории (`is_builtin=true`) можно переименовывать и деактивировать, но нельзя удалять. Категории, на которые ссылаются точки или заявки, нельзя удалять; используемые категории также нельзя деактивировать в запрещённых бизнес-правилами случаях.

### Аудит

`GET /moderator/audit-logs` возвращает историю административных изменений. Доступ требует сессии модератора. Фильтры: `action`, `object_type=point|point_request|category`, `limit` (1..200, default 50), `offset`.

Запись аудита создаётся в той же транзакции, что и действие модератора.

## Авторизация и CSRF

Используются серверные сессии PostgreSQL. Браузер получает случайный токен в HttpOnly cookie `moderator_session`, в БД хранится SHA-256-хеш токена. Пароли хешируются Argon2id.

Сессия истекает после 24 часов бездействия; успешные защищённые запросы продлевают срок действия.

Основной flow:
1. `GET /api/v1/auth/csrf` — получить CSRF-токен.
2. `POST /api/v1/auth/login` с JSON `username/password` и заголовком `X-CSRF-Token`.
3. `GET /api/v1/auth/me` — проверить сессию.
4. Для изменяющих состояние защищённых запросов передавать актуальный `X-CSRF-Token`.
5. `POST /api/v1/auth/logout` — завершить сессию.

Маршруты auth: `GET /auth/csrf`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`.

## Ошибки

Единый формат:

```json
{"code":"not_found","detail":"Point not found"}
```

Основные статусы: 401 — нет сессии; 403 — CSRF/доступ запрещён; 404 — объект не найден; 409 — конфликт бизнес-правил; 422 — ошибка валидации.

## Тестирование

Из корня репозитория:

```powershell
python -m pip install -r app/backend/requirements-dev.txt
python -m pytest app/backend/tests -q
```

Миграционные integration tests требуют отдельной disposable PostgreSQL/PostGIS базы и opt-in переменной `ALLOW_DESTRUCTIVE_MIGRATION_TESTS=true`. Safety guard проверяет параметры подключения и имя тестовой базы. **Не запускайте их на локальной рабочей, общей или production-базе.**

## Важные правила данных и миграций

- Координаты — WGS84; PostGIS POINT задаётся в порядке долгота, широта.
- `points.location` использует `Geography(Point, 4326)`.
- Публичный API возвращает только активные точки.
- Удаление точки модератором — архивация (soft delete), доступно восстановление.
- Прошедшие события автоматически не скрываются.
- Перед применением миграций к любой базе проверьте адрес подключения и создайте backup.
- Не выполняйте destructive migration tests на пользовательской БД. Для них допустима только специально созданная временная тестовая БД.

## Production

Для production необходимы HTTPS, `SESSION_COOKIE_SECURE=true`, точный список `CORS_ORIGINS`, защищённые переменные окружения и резервное копирование PostgreSQL. Не публикуйте напрямую Uvicorn без reverse proxy и TLS. Не помещайте секреты в frontend env с префиксом `VITE_`.

## Связанные документы

- [Общий README проекта](../../README.md)
- [Frontend README](../frontend/README.md)
