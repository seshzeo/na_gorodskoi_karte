# Сервис «На городской карте» — Backend

Backend расположен в каталоге `app/backend`. Стек: FastAPI, SQLAlchemy 2 Async, PostgreSQL/PostGIS, GeoAlchemy2 и Alembic.

## Установка (Windows PowerShell, из корня репозитория)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r app/backend/requirements.txt
Copy-Item app/backend/.env.example app/backend/.env
```

Укажите корректный `DATABASE_URL` и `CORS_ORIGINS` в `app/backend/.env`. Не коммитьте `.env`.

Создайте PostgreSQL БД `map_points`; миграции установят расширение PostGIS и создадут таблицы. Миграции `0002`–`0004` добавляют категории, признак встроенных категорий, учётные записи модераторов и серверные сессии.

## Миграции и запуск

```powershell
python -m alembic -c app/backend/alembic.ini upgrade head
python -m uvicorn app.backend.main:app --reload
```

Создание первой учётной записи модератора:

```powershell
python -m app.backend.create_moderator
```

Команда запросит логин и пароль в терминале. Минимальная длина пароля — 12 символов. Регистрация через API отсутствует.

Swagger: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/api/v1/health

## Проверки

Установить зависимости разработки и запустить unit-тесты:

```powershell
pip install -r app/backend/requirements-dev.txt
pytest app/backend/tests -q
```

Тесты покрывают базовые проверки CSRF и валидацию входных схем. Для полной приёмки дополнительно необходимы интеграционные проверки с PostgreSQL/PostGIS и HTTP-клиентом.

## Авторизация модератора

Авторизация использует серверные сессии PostgreSQL. В браузере хранится только случайный токен в cookie `moderator_session` с атрибутом HttpOnly. В базе хранится SHA-256-хеш токена.

Срок сессии — 24 часа бездействия. Каждый успешный запрос к защищённому endpoint продлевает срок действия. При активности сервер также обновляет cookie.

Перед входом frontend получает CSRF-токен:

```http
GET /api/v1/auth/csrf
```

Затем отправляет его в заголовке `X-CSRF-Token` при входе:

```http
POST /api/v1/auth/login
Content-Type: application/json
X-CSRF-Token: <csrf_token>

{"username":"moderator","password":"..."}
```

После входа API возвращает профиль модератора и новый CSRF-токен. Все изменяющие состояние запросы к защищённым маршрутам должны передавать этот токен в `X-CSRF-Token`.

Основные маршруты:

| Метод | Endpoint | Назначение |
|---|---|---|
| GET | `/auth/csrf` | Получить CSRF-токен |
| POST | `/auth/login` | Войти |
| GET | `/auth/me` | Проверить сессию |
| POST | `/auth/logout` | Завершить сессию |

Cookie-параметры задаются через `SESSION_COOKIE_*`. Для production обязательно HTTPS и `SESSION_COOKIE_SECURE=true`. Не используйте `CORS_ORIGINS=*` вместе с credentials. Для cross-site deployment нужно отдельно проверить SameSite=None; Secure и домены frontend/backend.

## Публичный API

Base URL: `/api/v1`.

- `GET /health` — состояние API и БД.
- `GET /categories` — активные категории.
- `GET /points` — активные точки карты.
- `GET /points/{id}` — активная точка.
- `GET /points/nearby` — точки рядом с координатами.
- `POST /point-requests` — публичная отправка заявки.

### Список точек

`GET /points` принимает:

- `bbox=min_lon,min_lat,max_lon,max_lat` — необязательная область карты.
- повторяющийся `category_id` — например `?category_id=1&category_id=2`; несколько категорий объединяются через OR.
- `event_after` — включительная нижняя граница времени события.
- `event_before` — исключительная верхняя граница времени события.
- `limit` — 1..500, по умолчанию 100.
- `offset` — неотрицательное смещение.

Даты должны быть ISO 8601 с часовым поясом. Прошедшие события автоматически не скрываются.

Ответ:

```json
{
  "items": [],
  "total": 0,
  "limit": 100,
  "offset": 0
}
```

`total` учитывает все фильтры до применения пагинации.

### Nearby

`GET /points/nearby`:

- `latitude`, `longitude` — обязательные координаты WGS84.
- `radius` — 1..50000 метров, по умолчанию 1000.
- `limit` — 1..200, по умолчанию 50.

## Заявки

| Метод | Endpoint | Доступ |
|---|---|---|
| POST | `/point-requests` | публичный |
| GET | `/point-requests` | модератор |
| GET | `/point-requests/{id}` | модератор |
| PATCH | `/point-requests/{id}` | модератор |
| POST | `/point-requests/{id}/approve` | модератор |
| POST | `/point-requests/{id}/reject` | модератор |

Approve выполняется транзакционно: одна ожидающая заявка создаёт одну точку и получает `point_id`. В `moderated_by` записывается ID действующего модератора. Повторная обработка возвращает 409.

Список заявок поддерживает фильтры:
- `status=pending|approved|rejected`.
- `category_id`.
- `created_after` и `created_before` — границы даты создания с часовым поясом.
- `limit` — 1..200, по умолчанию 50.
- `offset` — неотрицательное смещение.

Ответ списка заявок использует общий формат пагинации `items + total + limit + offset`. Поле `total` отражает количество записей после фильтрации, но до пагинации.

## Административный API

Все маршруты требуют действующую сессию модератора. Для POST/PATCH/DELETE обязателен `X-CSRF-Token`.

### Точки

| Метод | Endpoint | Назначение |
|---|---|---|
| GET | `/moderator/points` | Список точек |
| GET | `/moderator/points/{id}` | Карточка, включая архивные |
| PATCH | `/moderator/points/{id}` | Редактирование |
| DELETE | `/moderator/points/{id}` | Архивация |
| POST | `/moderator/points/{id}/restore` | Восстановление |

Параметры списка:

- `status=active|archived|all`, по умолчанию `active`.
- `category_id`.
- `event_after`, `event_before`.
- `limit` — 1..200, по умолчанию 50.
- `offset`.

Формат ответа: `items + total + limit + offset`.

### Категории

| Метод | Endpoint | Назначение |
|---|---|---|
| GET | `/moderator/categories` | Все категории, включая неактивные |
| POST | `/categories` | Создание пользовательской категории |
| PATCH | `/categories/{id}` | Изменение имени, slug, активности |
| DELETE | `/categories/{id}` | Удаление пользовательской категории |

Встроенные категории имеют `is_builtin=true`: их можно переименовывать и деактивировать, но нельзя удалять. Пользовательские категории получают `is_builtin=false`. Нельзя деактивировать категорию, используемую активными точками или ожидающими заявками. Нельзя удалять категорию, на которую ссылаются точки или заявки.

## Формат ошибок

Ошибки возвращаются с единым форматом:

```json
{"code":"not_found","detail":"Point not found"}
```

HTTP-статусы: 401 — нет сессии, 403 — CSRF/доступ запрещён, 404 — объект не найден, 409 — конфликт бизнес-правил, 422 — ошибка валидации.

## Безопасность и deployment

- Пароли хранятся в Argon2id-хешах.
- Сессионные токены и CSRF-токены хранятся в БД только в виде SHA-256-хешей.
- Секреты не передаются в frontend bundle.
- `X-Moderator-Key` больше не используется.
- Cookie HttpOnly, SameSite задаётся конфигурацией; Secure должен быть включён в production.
- CORS ограничен списком доверенных frontend origins.
- CSRF проверяется на защищённых изменяющих состояние запросах.

## Технические правила

- Координаты — WGS84; в PostGIS порядок POINT: долгота, широта.
- `points.location` — `Geography(Point, 4326)`.
- Публичная выдача содержит только активные точки.
- Архивация — soft delete.
- Прошедшие события не скрываются автоматически.
- Категории, используемые точками или заявками, не удаляются физически.
