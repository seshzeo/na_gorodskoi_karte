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

Создайте PostgreSQL БД `map_points`; миграция установит расширение PostGIS (пользователю БД нужны соответствующие права).

## Миграции и запуск
```powershell
alembic -c app/backend/alembic.ini upgrade head
uvicorn app.backend.main:app --reload
```
Swagger: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/api/v1/health

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
- `GET /api/v1/point-requests?status=pending`
- `GET /api/v1/point-requests/{id}`
- `PATCH /api/v1/point-requests/{id}`
- `POST /api/v1/point-requests/{id}/approve`
- `POST /api/v1/point-requests/{id}/reject`
- `PATCH /api/v1/points/{id}`
- `DELETE /api/v1/points/{id}` (soft delete)

Если `MODERATOR_API_KEY` не задан, защищённые endpoints отвечают 503. Неверный или отсутствующий ключ — 401. Это временная схема для разработки; перед production её нужно заменить на полноценную аутентификацию и роли JWT.

## Правила
- `points.location` — `Geography(Point, 4326)`; порядок координат: долгота, широта.
- `bbox` валидируется по диапазонам координат и min/max; antimeridian пока не поддерживается.
- `nearby.radius` ограничен 50 000 метрами.
- Публичный список возвращает только активные точки; прошедшие события не отфильтровываются.
- Одобрение заявки выполняется в одной транзакции с `SELECT FOR UPDATE`; повторная модерация возвращает 409.
- `author_external_id` — справочное поле, не механизм аутентификации; оно не возвращается публично.
- Категории должны быть созданы в таблице `categories` перед отправкой заявок.

## Текущий статус
Реализованы базовый REST API, схемы, репозитории, сервисы, фильтры PostGIS и временная защита модераторских операций API-ключом. Реальное подключение к PostgreSQL/PostGIS и ручные API-проверки выполняются в локальном окружении.
