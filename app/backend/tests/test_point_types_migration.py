import importlib.util
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
import pytest_asyncio
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine


TEST_DATABASE_URL = os.getenv("MIGRATION_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="Set MIGRATION_TEST_DATABASE_URL to an isolated PostgreSQL test database.",
)


def load_migration(filename: str):
    path = Path(__file__).parents[1] / "alembic" / "versions" / filename
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load migration at {path}")
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


historical_migration = load_migration("0006_historical_demo_catalog.py")
point_types_migration = load_migration("0007_point_types.py")


@pytest_asyncio.fixture
async def isolated_migration_connection():
    url = make_url(TEST_DATABASE_URL)
    if url.database == "map_points" or not (url.database or "").startswith("migration_test_"):
        pytest.fail(
            "MIGRATION_TEST_DATABASE_URL must target a dedicated migration_test_* database."
        )

    engine = create_async_engine(TEST_DATABASE_URL)
    schema = f"migration_test_{uuid4().hex}"
    async with engine.connect() as connection:
        transaction = await connection.begin()
        try:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            await connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            await connection.execute(text("""
                CREATE TABLE categories (
                    id integer PRIMARY KEY,
                    slug varchar(80) NOT NULL
                )
            """))
            await connection.execute(text("""
                CREATE TABLE points (
                    id integer PRIMARY KEY,
                    title varchar(200) NOT NULL,
                    event_at timestamptz NOT NULL,
                    created_at timestamptz NOT NULL,
                    is_active boolean NOT NULL
                )
            """))
            for table in (
                "point_requests",
                "moderators",
                "moderator_sessions",
                "moderator_audit_logs",
            ):
                await connection.execute(
                    text(f'CREATE TABLE "{table}" (id integer PRIMARY KEY)')
                )

            await connection.execute(
                text("INSERT INTO categories (id, slug) VALUES "
                     "(6, 'looking-for-you'), (7, 'mdps'), (8, 'where-is-fuel')")
            )
            now = datetime(2026, 11, 8, 10, 0, tzinfo=timezone.utc)
            await connection.execute(
                text("""
                    INSERT INTO points (id, title, event_at, created_at, is_active)
                    VALUES (:id, :title, :event_at, :created_at, TRUE)
                """),
                [
                    {
                        "id": point_id,
                        "title": f"Existing point {point_id}",
                        "event_at": now,
                        "created_at": now,
                    }
                    for point_id in range(1, 18)
                ],
            )
            for table in (
                "point_requests",
                "moderators",
                "moderator_sessions",
                "moderator_audit_logs",
            ):
                count = {
                    "point_requests": 3,
                    "moderators": 1,
                    "moderator_sessions": 4,
                    "moderator_audit_logs": 12,
                }[table]
                await connection.execute(
                    text(f'INSERT INTO "{table}" (id) SELECT generate_series(1, :count)'),
                    {"count": count},
                )
            yield connection
        finally:
            await transaction.rollback()
            await engine.dispose()


def run_revision(sync_connection, operation):
    context = MigrationContext.configure(sync_connection)
    with Operations.context(context):
        operation()


async def apply_revision(connection, operation):
    await connection.run_sync(lambda sync_connection: run_revision(sync_connection, operation))


async def row_counts(connection):
    counts = {}
    for table in (
        "categories",
        "points",
        "point_requests",
        "moderators",
        "moderator_sessions",
        "moderator_audit_logs",
    ):
        result = await connection.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
        counts[table] = result.scalar_one()
    return counts


async def existing_non_point_data(connection):
    snapshots = {}
    queries = {
        "categories": "SELECT id, slug FROM categories ORDER BY id",
        "point_requests": "SELECT id FROM point_requests ORDER BY id",
        "moderators": "SELECT id FROM moderators ORDER BY id",
        "moderator_sessions": "SELECT id FROM moderator_sessions ORDER BY id",
        "moderator_audit_logs": "SELECT id FROM moderator_audit_logs ORDER BY id",
    }
    for table, query in queries.items():
        snapshots[table] = (await connection.execute(text(query))).fetchall()
    return snapshots


async def point_type_schema(connection):
    column = await connection.execute(text("""
        SELECT is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'points'
          AND column_name = 'point_type'
    """))
    constraint = await connection.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'ck_points_type_event_at'
              AND connamespace = current_schema()::regnamespace
        )
    """))
    index = await connection.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'points'
              AND indexname = 'ix_points_type_active'
        )
    """))
    event_at = await connection.execute(text("""
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'points'
          AND column_name = 'event_at'
    """))
    return (
        column.fetchone(),
        constraint.scalar_one(),
        index.scalar_one(),
        event_at.scalar_one(),
    )


@pytest.mark.asyncio
async def test_upgrade_preserves_existing_data_and_historical_catalog(
    isolated_migration_connection,
):
    connection = isolated_migration_connection
    expected_counts = {
        "categories": 3,
        "points": 17,
        "point_requests": 3,
        "moderators": 1,
        "moderator_sessions": 4,
        "moderator_audit_logs": 12,
    }
    original_points = (
        await connection.execute(text("SELECT id, title, event_at FROM points ORDER BY id"))
    ).fetchall()
    original_non_point_data = await existing_non_point_data(connection)

    await apply_revision(connection, historical_migration.upgrade)
    assert await row_counts(connection) == expected_counts
    assert await existing_non_point_data(connection) == original_non_point_data
    assert (
        await connection.execute(text("SELECT id, title, event_at FROM points ORDER BY id"))
    ).fetchall() == original_points

    await apply_revision(connection, point_types_migration.upgrade)

    assert await row_counts(connection) == expected_counts
    assert await existing_non_point_data(connection) == original_non_point_data
    assert (
        await connection.execute(text("SELECT id, title, event_at FROM points ORDER BY id"))
    ).fetchall() == original_points
    event_point_count = await connection.execute(
        text("SELECT COUNT(*) FROM points WHERE point_type = 'event'")
    )
    assert event_point_count.scalar_one() == 17
    point_type_column, constraint_exists, index_exists, event_at_nullable = (
        await point_type_schema(connection)
    )
    assert point_type_column == ("NO", "'event'::character varying")
    assert constraint_exists
    assert index_exists
    assert event_at_nullable == "YES"

    await apply_revision(connection, point_types_migration.downgrade)

    assert await row_counts(connection) == expected_counts
    assert (
        await connection.execute(text("SELECT id, title, event_at FROM points ORDER BY id"))
    ).fetchall() == original_points
    assert await existing_non_point_data(connection) == original_non_point_data
    point_type_column, constraint_exists, index_exists, event_at_nullable = (
        await point_type_schema(connection)
    )
    assert point_type_column is None
    assert not constraint_exists
    assert not index_exists
    assert event_at_nullable == "NO"


@pytest.mark.asyncio
async def test_downgrade_refuses_permanent_points_without_changing_data_or_schema(
    isolated_migration_connection,
):
    connection = isolated_migration_connection
    await apply_revision(connection, point_types_migration.upgrade)
    await connection.execute(text("""
        UPDATE points
        SET point_type = 'permanent', event_at = NULL
        WHERE id = 1
    """))
    points_before = (
        await connection.execute(text("""
            SELECT id, title, event_at, point_type
            FROM points
            ORDER BY id
        """))
    ).fetchall()
    schema_before = await point_type_schema(connection)
    counts_before = await row_counts(connection)

    with pytest.raises(RuntimeError, match="non-event type"):
        await apply_revision(connection, point_types_migration.downgrade)

    assert (
        await connection.execute(text("""
            SELECT id, title, event_at, point_type
            FROM points
            ORDER BY id
        """))
    ).fetchall() == points_before
    assert await point_type_schema(connection) == schema_before
    assert await row_counts(connection) == counts_before
