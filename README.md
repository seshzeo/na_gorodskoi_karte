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
