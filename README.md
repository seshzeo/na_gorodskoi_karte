# Сервис «На городской карте» — Backend

Backend расположен в каталоге `app/backend`. Стек: FastAPI, SQLAlchemy 2 Async, PostgreSQL/PostGIS, GeoAlchemy2 и Alembic.

## Структура
```text
app/backend/
  core/          # настройки, DB session, moderator API-key
  models/        # SQLAlchemy models
  schemas/       # Pydantic request/response schemas
  repositories/  # SQL queries
  services/      # business logic
  routers/       # REST endpoints
  alembic/       # migrations
  main.py
  requirements.txt
  .env.example
```

## Установка (Windows PowerShell, из корня репозитория)
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r app/backend/requirements.txt
Copy-Item app/backend/.env.example app/backend/.env
```
Укажите в `app/backend/.env` корректный `DATABASE_URL`. Для доступа модератора задайте длинный случайный `MODERATOR_API_KEY`. Не коммитьте файл `.env`.

Создайте PostgreSQL БД `map_points`; миграция установит расширение PostGIS (пользователю БД нужны соответствующие права). Миграция `0002` добавит начальные категории: «События», «Места», «Услуги», «Объявления», «Другое». Вставка идемпотентна и не перезаписывает уже существующие категории.

## Миграции и запуск
```powershell
python -m alembic -c app/backend/alembic.ini upgrade head
python -m uvicorn app.backend.main:app --reload
```
Swagger: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/api/v1/health

## API contract

Base URL: `/api/v1`.

### Conventions

- JSON request/response bodies use UTF-8.
- Datetimes are ISO 8601 and **must include a timezone** in request parameters/bodies where specified.
- Coordinates use WGS84: `latitude` −90..90, `longitude` −180..180.
- `GET /points` and `GET /points/nearby` return only active points.
- Protected endpoints require `X-Moderator-Key: <MODERATOR_API_KEY>`.
- Errors have a stable top-level shape:

```json
{
  "code": "not_found",
  "detail": "Point not found"
}
```

For validation errors, `detail` is an array of Pydantic validation objects.

### Categories

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| GET | `/categories` | public | `Category[]` |
| POST | `/categories` | moderator | `Category` 201 |
| PATCH | `/categories/{id}` | moderator | `Category` |
| DELETE | `/categories/{id}` | moderator | 204 |

Category:
```json
{
  "id": 1,
  "name": "События",
  "slug": "events"
}
```

### Points

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| GET | `/points` | public | `Point[]` |
| GET | `/points/{id}` | public | `Point` |
| GET | `/points/nearby` | public | `PointNearby[]` |
| PATCH | `/points/{id}` | moderator | `Point` |
| DELETE | `/points/{id}` | moderator | 204 |
| POST | `/points/{id}/restore` | moderator | `Point` |

`GET /points` query:
- `bbox=min_lon,min_lat,max_lon,max_lat` — optional viewport filter.
- `category_id` — optional positive integer.
- `limit` — 1..500, default 100.
- `offset` — >=0, default 0.

`GET /points/nearby` query:
- `latitude`, `longitude` — required.
- `radius` — 1..50000 meters, default 1000.
- `limit` — 1..200, default 50.

Point:
```json
{
  "id": 1,
  "title": "Городской фестиваль",
  "description": "Описание события",
  "category_id": 1,
  "category_name": "События",
  "latitude": 51.533,
  "longitude": 46.034,
  "event_at": "2026-11-10T18:00:00+04:00",
  "author_name": "Иван",
  "created_at": "2026-11-05T08:00:00+04:00",
  "updated_at": "2026-11-05T08:00:00+04:00"
}
```

`PointNearby` содержит все поля `Point` плюс `distance_m`.

### Point requests

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| POST | `/point-requests` | public | `PointRequest` 201 |
| GET | `/point-requests` | moderator | `PointRequest[]` |
| GET | `/point-requests/{id}` | moderator | `PointRequest` |
| PATCH | `/point-requests/{id}` | moderator | `PointRequest` |
| POST | `/point-requests/{id}/approve` | moderator | `PointRequest` |
| POST | `/point-requests/{id}/reject` | moderator | `PointRequest` |

`GET /point-requests` query:
- `status`: `pending`, `approved`, `rejected`.
- `category_id`: positive integer.
- `created_after`, `created_before`: ISO 8601 with timezone.
- `limit`: 1..200, default 50.
- `offset`: >=0, default 0.

`POST /point-requests` body:
```json
{
  "author_name": "Иван",
  "title": "Новое событие",
  "description": "Описание",
  "category_id": 1,
  "latitude": 51.533,
  "longitude": 46.034,
  "event_at": "2026-11-10T18:00:00+04:00"
}
```

Approve is transactional: one pending request produces one Point and sets `point_id`. Repeated moderation of an already processed request returns 409.

### Error codes

| HTTP | code | Meaning |
|---:|---|---|
| 400 | `bad_request` | malformed request |
| 401 | `unauthorized` | missing/invalid moderator key |
| 403 | `forbidden` | forbidden operation |
| 404 | `not_found` | resource not found |
| 409 | `conflict` | business-rule conflict |
| 422 | `validation_error` | request validation failed |
| 503 | `service_unavailable` | moderator protection is not configured |

## REST API

### Публичные endpoints
- `GET /api/v1/health`
- `GET /api/v1/categories`
- `GET /api/v1/points?bbox=min_lon,min_lat,max_lon,max_lat&category_id=&limit=&offset=`
- `GET /api/v1/points/{id}`
- `GET /api/v1/points/nearby?latitude=&longitude=&radius=&limit=`
- `POST /api/v1/point-requests`

### Endpoints модератора
Передавайте заголовок `X-Moderator-Key: <MODERATOR_API_KEY>`.
- `POST /api/v1/categories` — создание категории (поля `name`, `slug`)
- `PATCH /api/v1/categories/{id}` — изменение названия или slug
- `DELETE /api/v1/categories/{id}` — удаление категории, если она не используется
- `GET /api/v1/point-requests?status=pending&category_id=1&created_after=2026-01-01T00:00:00Z&created_before=2026-12-31T23:59:59Z&limit=50&offset=0` — фильтрация очереди заявок по статусу, категории и диапазону даты создания
- `GET /api/v1/point-requests/{id}`
- `PATCH /api/v1/point-requests/{id}`
- `POST /api/v1/point-requests/{id}/approve`
- `POST /api/v1/point-requests/{id}/reject`
- `PATCH /api/v1/points/{id}`
- `DELETE /api/v1/points/{id}` — скрыть точку (soft delete)
- `POST /api/v1/points/{id}/restore` — восстановить скрытую точку

Если `MODERATOR_API_KEY` не задан, защищённые endpoints отвечают 503. Заданный ключ должен содержать не менее 32 символов. Неверный или отсутствующий ключ — 401. Это временная схема для разработки; перед production её нужно заменить на полноценную аутентификацию и роли JWT.\n\n### Формат ошибок\nHTTP-ошибки API возвращаются с единым верхнеуровневым полем `code` и полем `detail`: например, `{"code":"not_found","detail":"Point not found"}`. Ошибки валидации имеют `code: "validation_error"`, а в `detail` содержат список ошибок Pydantic. HTTP-статус ответа сохраняется.

## Правила
- `points.location` — `Geography(Point, 4326)`; порядок координат: долгота, широта.
- `bbox` валидируется по диапазонам координат и min/max; antimeridian пока не поддерживается.
- `nearby.radius` ограничен 50 000 метрами.
- Публичный список возвращает только активные точки; прошедшие события не отфильтровываются.
- Скрытие точки — soft delete; восстановление доступно только модератору. Повторное восстановление активной точки возвращает 409.
- Очередь заявок поддерживает фильтры по статусу, категории и временному диапазону создания; даты должны содержать timezone, нижняя граница не может быть позже верхней.
- Одобрение заявки выполняется в одной транзакции с `SELECT FOR UPDATE`; повторная модерация возвращает 409.
- `author_external_id` — справочное поле, не механизм аутентификации; оно не возвращается публично.
- Категории создаются миграцией `0002`; пользовательские категории управляются через защищённый API. Категорию, используемую точками или заявками, удалить нельзя.

## Текущий статус
Реализованы базовый REST API точек и заявок, модерация, управление категориями, восстановление скрытых точек, схемы, репозитории, сервисы, фильтры PostGIS и временная защита модераторских операций API-ключом. Ручные API-проверки выполняются в локальном окружении.
