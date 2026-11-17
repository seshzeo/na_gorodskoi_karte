import asyncio
import json
from pathlib import Path
from sqlalchemy import text
from app.backend.core.database import engine

QUERIES = {
    "categories": """
        SELECT id, name, slug, is_active, is_builtin
        FROM categories ORDER BY id
    """,
    "moderators": """
        SELECT id, username, password_hash, is_active,
               created_at, updated_at
        FROM moderators ORDER BY id
    """,
    "points": """
        SELECT id, title, description, category_id,
               ST_AsText(location::geometry) AS location_wkt,
               event_at, author_name, is_active,
               created_at, updated_at, point_type
        FROM points ORDER BY id
    """,
    "point_requests": """
        SELECT id, author_external_id, author_name, title,
               description, category_id, latitude, longitude,
               event_at, status::text AS status,
               rejection_reason, moderated_by, moderated_at,
               point_id, created_at
        FROM point_requests ORDER BY id
    """,
    "moderator_audit_logs": """
        SELECT id, moderator_id, action, object_type,
               object_id, details, created_at
        FROM moderator_audit_logs ORDER BY id
    """,
}

def serialize(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise TypeError(f"Unsupported type: {type(value)}")

async def main():
    data = {}

    async with engine.connect() as conn:
        for table, query in QUERIES.items():
            result = await conn.execute(text(query))
            data[table] = [dict(row) for row in result.mappings()]

    await engine.dispose()

    output = Path("tools/local_db_transfer.json")
    output.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=serialize),
        encoding="utf-8"
    )

    print("========== EXPORT COMPLETE ==========")
    for table, rows in data.items():
        print(f"{table}: {len(rows)}")
    print(f"File: {output.resolve()}")
    print(f"Size: {output.stat().st_size:,} bytes")

asyncio.run(main())
