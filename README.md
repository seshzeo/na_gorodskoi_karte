# Map Points Backend — этап 1

Фундамент backend: FastAPI, async SQLAlchemy, PostgreSQL/PostGIS, GeoAlchemy2 и Alembic.
Реализованы базовая структура приложения, SQLAlchemy-модели и начальная миграция Alembic. REST API точек и заявок будет добавлен следующим этапом.

## 1. Подготовка

Требуется Python 3.11+ и PostgreSQL с возможностью установить расширение PostGIS.

Создайте базу данных `map_points`, затем установите PostGIS:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
(Миграция также выполняет `CREATE EXTENSION IF NOT EXISTS postgis`.)

## 2. Установка

Windows PowerShell:
```powershell
py -3.12 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Проверьте `DATABASE_URL` в `.env`.

## 3. Миграция

```powershell
alembic upgrade head
```

## 4. Запуск

```powershell
uvicorn app.main:app --reload
```

Документация: http://127.0.0.1:8000/docs  
Проверка API и БД: http://127.0.0.1:8000/api/v1/health

## Важные решения

- `points.location` — `Geography(Point, 4326)`. При создании геоточки порядок координат в WKT: `POINT(longitude latitude)`.
- `event_at` хранится с timezone.
- `point_requests.point_id` уникален: одна заявка может породить не более одной точки.
- `is_active` позволяет скрывать/удалять точки логически, не разрушая историю.
- `author_external_id` — идентификатор автора заявки, но не механизм аутентификации.
- Таблица `categories` включена, поскольку обе основные сущности ссылаются на категории.

## Текущий статус

Сейчас доступны только корневой endpoint и проверка подключения к БД (`GET /api/v1/health`). CRUD точек и заявок, модерация заявок, авторизация модератора и тесты пока не реализованы. Мутации данных не открыты без авторизации.

Следующий этап — Pydantic-схемы, сервисы и REST API для точек и заявок.
