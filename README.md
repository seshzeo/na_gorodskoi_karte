# Сервис «На городской карте» — Backend

Backend расположен в каталоге `app/backend`. Стек: FastAPI, SQLAlchemy 2 Async, PostgreSQL/PostGIS, GeoAlchemy2 и Alembic.

## Структура
```text
app/
  __init__.py
  backend/
    __init__.py
    main.py
    core/
    models/
    routers/
    alembic/
    alembic.ini
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
Отредактируйте `app/backend/.env`, указав `DATABASE_URL`. Создайте БД `map_points`; миграция установит PostGIS extension (пользователю БД нужны соответствующие права).

## Миграции
```powershell
alembic -c app/backend/alembic.ini upgrade head
```

## Запуск
```powershell
uvicorn app.backend.main:app --reload
```
Swagger: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/api/v1/health

## Статус
Реализованы каркас FastAPI, SQLAlchemy-модели, начальная миграция и health endpoint. CRUD точек и заявок, модерация и авторизация будут добавлены следующими этапами. Мутации пока не реализованы.

## Решения модели
- `points.location` — `Geography(Point, 4326)`; порядок координат: долгота, широта.
- `event_at` хранится с timezone.
- `point_requests.point_id` уникален.
- `is_active` позволяет скрывать точки без физического удаления.
- `author_external_id` не является механизмом аутентификации.
