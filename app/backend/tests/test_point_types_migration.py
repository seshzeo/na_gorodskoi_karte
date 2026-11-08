import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.main import app
from app.backend.tests.migration_test_safety import (
    validated_engine_url,
    validated_test_url,
)


TEST_DATABASE_URL = os.getenv("MIGRATION_TEST_DATABASE_URL")
requires_migration_database = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="Set MIGRATION_TEST_DATABASE_URL to a dedicated migration_test_* PostgreSQL database.",
)

ROOT = Path(__file__).parents[3]
ALEMBIC_CONFIG = ROOT / "app" / "backend" / "alembic.ini"
MIGRATION_HEAD = "0007_point_types"
EXPECTED_COUNTS = {
    "categories": 3,
    "points": 17,
    "point_requests": 3,
    "moderators": 1,
    "moderator_sessions": 4,
    "moderator_audit_logs": 12,
}
CATEGORY_SLUGS = ("looking-for-you", "mdps", "where-is-fuel")
EVENT_TIME = datetime(2026, 11, 8, 10, 0, tzinfo=timezone.utc)


def redact_database_credentials(output: str, database_url) -> str:
    raw_url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if raw_url:
        output = output.replace(
            raw_url,
            database_url.render_as_string(hide_password=True),
        )
    for credential in (database_url.username, database_url.password):
        if credential:
            output = output.replace(credential, "[redacted]")
            output = output.replace(quote(credential, safe=""), "[redacted]")
    return output


def run_alembic(*arguments: str, expect_success: bool = True) -> subprocess.CompletedProcess[str]:
    database_url = validated_test_url()
    environment = os.environ.copy()
    environment["DATABASE_URL"] = database_url.render_as_string(hide_password=False)
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(ALEMBIC_CONFIG),
            *arguments,
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    stdout = redact_database_credentials(result.stdout, database_url)
    stderr = redact_database_credentials(result.stderr, database_url)
    if expect_success and result.returncode != 0:
        pytest.fail(f"Alembic command failed ({arguments!r}):\n{stdout}{stderr}")
    return subprocess.CompletedProcess(result.args, result.returncode, stdout, stderr)


async def clear_test_schema(engine) -> None:
    validated_engine_url(engine)
    async with engine.begin() as connection:
        await connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await connection.execute(text("CREATE SCHEMA public"))


async def reset_database(engine) -> None:
    await clear_test_schema(engine)
    run_alembic("upgrade", "0005_moderator_audit_log")
    await seed_pre_0006_data(engine)


async def seed_pre_0006_data(engine) -> None:
    validated_engine_url(engine)
    async with engine.begin() as connection:
        await connection.execute(text("DELETE FROM point_requests"))
        await connection.execute(text("DELETE FROM points"))
        await connection.execute(text("DELETE FROM categories"))
        await connection.execute(text("""
            INSERT INTO categories (id, name, slug, is_active, is_builtin) VALUES
                (6, 'Looking for you', 'looking-for-you', TRUE, TRUE),
                (7, 'MDPS', 'mdps', TRUE, TRUE),
                (8, 'Where is fuel', 'where-is-fuel', TRUE, TRUE);
        """))
        await connection.execute(text("""
            SELECT setval(pg_get_serial_sequence('categories', 'id'), 8)
        """))
        await connection.execute(text("""
            INSERT INTO points (
                id, title, description, category_id, location, event_at,
                author_name, is_active
            )
            SELECT
                point_id,
                'Existing point ' || point_id,
                'Existing point description',
                6 + ((point_id - 1) % 3),
                ST_SetSRID(ST_MakePoint(46.0, 51.5), 4326)::geography,
                :event_at,
                'Test author',
                TRUE
            FROM generate_series(1, 17) AS point_id
        """), {"event_at": EVENT_TIME})
        await connection.execute(text("""
            SELECT setval(pg_get_serial_sequence('points', 'id'), 17)
        """))
        await connection.execute(text("""
            INSERT INTO moderators (
                id, username, password_hash, is_active, created_at, updated_at
            ) VALUES (
                'moderator-test', 'migration-test', 'test-hash', TRUE, now(), now()
            )
        """))
        await connection.execute(text("""
            INSERT INTO moderator_sessions (
                id, moderator_id, token_hash, csrf_token_hash,
                created_at, last_activity_at, expires_at
            )
            SELECT
                'session-' || session_id,
                'moderator-test',
                lpad(session_id::text, 64, '0'),
                lpad((session_id + 10)::text, 64, '0'),
                now(), now(), now() + interval '1 day'
            FROM generate_series(1, 4) AS session_id
        """))
        await connection.execute(text("""
            INSERT INTO point_requests (
                id, author_external_id, author_name, title, description,
                category_id, latitude, longitude, event_at, status, created_at
            )
            SELECT
                request_id, 'external-' || request_id, 'Request author',
                'Request ' || request_id, 'Request description',
                6, 51.5, 46.0, :event_at, 'pending', now()
            FROM generate_series(1, 3) AS request_id
        """), {"event_at": EVENT_TIME})
        await connection.execute(text("""
            SELECT setval(pg_get_serial_sequence('point_requests', 'id'), 3)
        """))
        await connection.execute(text("""
            INSERT INTO moderator_audit_logs (
                moderator_id, action, object_type, object_id, details, created_at
            )
            SELECT
                'moderator-test', 'test.action', 'point', point_id::text,
                '{}'::json, now()
            FROM generate_series(1, 12) AS point_id
        """))
        await connection.execute(text("""
            SELECT setval(
                pg_get_serial_sequence('moderator_audit_logs', 'id'),
                (SELECT max(id) FROM moderator_audit_logs)
            )
        """))


@pytest_asyncio.fixture
async def migration_database():
    database_url = validated_test_url()
    engine = create_async_engine(database_url)
    try:
        await reset_database(engine)
        yield engine
    finally:
        try:
            await clear_test_schema(engine)
        finally:
            await engine.dispose()


@pytest_asyncio.fixture
async def moderator_client(migration_database):
    session_factory = async_sessionmaker(
        migration_database, class_=AsyncSession, expire_on_commit=False
    )

    async def override_db():
        async with session_factory() as session:
            yield session

    original_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_moderator] = lambda: "moderator-test"
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)


async def row_counts(engine) -> dict[str, int]:
    async with engine.connect() as connection:
        counts = {}
        for table in EXPECTED_COUNTS:
            result = await connection.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
            counts[table] = result.scalar_one()
        return counts


async def database_revision(engine) -> str:
    async with engine.connect() as connection:
        result = await connection.execute(text("SELECT version_num FROM alembic_version"))
        return result.scalar_one()


async def point_type_schema(engine):
    async with engine.connect() as connection:
        point_type = await connection.execute(text("""
            SELECT is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'points'
              AND column_name = 'point_type'
        """))
        event_at = await connection.execute(text("""
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'points'
              AND column_name = 'event_at'
        """))
        constraint = await connection.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_points_type_event_at'
                  AND conrelid = 'public.points'::regclass
            )
        """))
        index = await connection.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'points'
                  AND indexname = 'ix_points_type_active'
            )
        """))
        return (
            point_type.fetchone(),
            event_at.scalar_one(),
            constraint.scalar_one(),
            index.scalar_one(),
        )


async def point_rows(engine, *, include_type: bool):
    query = (
        "SELECT id, title, event_at, point_type FROM points ORDER BY id"
        if include_type
        else "SELECT id, title, event_at FROM points ORDER BY id"
    )
    async with engine.connect() as connection:
        return (await connection.execute(text(query))).fetchall()


@pytest.mark.asyncio
@requires_migration_database
async def test_real_alembic_upgrade_and_event_only_downgrade_preserve_data(
    migration_database,
):
    engine = migration_database
    original_points = await point_rows(engine, include_type=False)
    async with engine.connect() as connection:
        original_slugs = tuple(
            row[0]
            for row in await connection.execute(
                text("SELECT slug FROM categories ORDER BY id")
            )
        )
    assert await database_revision(engine) == "0005_moderator_audit_log"

    run_alembic("upgrade", "head")

    assert await database_revision(engine) == MIGRATION_HEAD
    assert await row_counts(engine) == EXPECTED_COUNTS
    assert await point_rows(engine, include_type=False) == original_points
    assert await point_type_schema(engine) == (
        ("NO", "'event'::character varying"),
        "YES",
        True,
        True,
    )
    async with engine.connect() as connection:
        slugs = tuple(
            row[0]
            for row in (
                await connection.execute(text("SELECT slug FROM categories ORDER BY id"))
            )
        )
        point_types = await connection.execute(text("""
            SELECT point_type, count(*)
            FROM points
            GROUP BY point_type
        """))
        assert slugs == original_slugs == CATEGORY_SLUGS
        assert point_types.fetchall() == [("event", 17)]

    run_alembic("downgrade", "0006_historical_demo_catalog")

    assert await database_revision(engine) == "0006_historical_demo_catalog"
    assert await row_counts(engine) == EXPECTED_COUNTS
    assert await point_rows(engine, include_type=False) == original_points
    assert await point_type_schema(engine) == (None, "NO", False, False)


@pytest.mark.asyncio
@requires_migration_database
async def test_real_alembic_downgrade_refuses_permanent_points_without_changes(
    migration_database,
):
    engine = migration_database
    run_alembic("upgrade", "head")
    async with engine.begin() as connection:
        await connection.execute(text("""
            INSERT INTO points (
                id, title, description, category_id, location, point_type,
                event_at, author_name, is_active
            ) VALUES (
                18, 'Permanent place', 'Permanent description', 6,
                ST_SetSRID(ST_MakePoint(46.0, 51.5), 4326)::geography,
                'permanent', NULL, 'Test author', TRUE
            )
        """))
        await connection.execute(text("""
            SELECT setval(pg_get_serial_sequence('points', 'id'), 18)
        """))

    points_before = await point_rows(engine, include_type=True)
    counts_before = await row_counts(engine)
    schema_before = await point_type_schema(engine)
    failed_downgrade = run_alembic(
        "downgrade",
        "0006_historical_demo_catalog",
        expect_success=False,
    )

    assert failed_downgrade.returncode != 0
    output = failed_downgrade.stdout + failed_downgrade.stderr
    assert "Cannot downgrade point types while points with a non-event type exist." in output
    assert await database_revision(engine) == MIGRATION_HEAD
    assert await row_counts(engine) == counts_before
    assert await point_rows(engine, include_type=True) == points_before
    assert await point_type_schema(engine) == schema_before


@pytest.mark.asyncio
@requires_migration_database
async def test_patch_validates_point_type_and_preserves_rows_on_rejection(
    migration_database,
    moderator_client: httpx.AsyncClient,
):
    engine = migration_database
    run_alembic("upgrade", "head")
    async with engine.begin() as connection:
        await connection.execute(text("""
            INSERT INTO points (
                id, title, description, category_id, location, point_type,
                event_at, author_name, is_active
            ) VALUES (
                18, 'Permanent place', 'Permanent description', 6,
                ST_SetSRID(ST_MakePoint(46.0, 51.5), 4326)::geography,
                'permanent', NULL, 'Test author', TRUE
            )
        """))
        await connection.execute(text("""
            SELECT setval(pg_get_serial_sequence('points', 'id'), 18)
        """))

    permanent_update = await moderator_client.patch(
        "/api/v1/moderator/points/18",
        json={"title": "Updated permanent place", "description": "Still permanent"},
    )
    assert permanent_update.status_code == 200
    assert permanent_update.json()["title"] == "Updated permanent place"
    assert permanent_update.json()["event_at"] is None

    permanent_before = await point_rows(engine, include_type=True)
    async with engine.connect() as connection:
        audit_count = (
            await connection.execute(text("SELECT COUNT(*) FROM moderator_audit_logs"))
        ).scalar_one()
    rejected_permanent_update = await moderator_client.patch(
        "/api/v1/moderator/points/18",
        json={"event_at": "2026-12-01T12:00:00Z"},
    )
    assert rejected_permanent_update.status_code == 422
    assert rejected_permanent_update.json()["detail"] == (
        "event_at cannot be updated for permanent points"
    )
    assert await point_rows(engine, include_type=True) == permanent_before
    async with engine.connect() as connection:
        assert (
            await connection.execute(text("SELECT COUNT(*) FROM moderator_audit_logs"))
        ).scalar_one() == audit_count

    event_update = await moderator_client.patch(
        "/api/v1/moderator/points/1",
        json={
            "title": "Updated event",
            "event_at": "2026-12-01T12:00:00Z",
        },
    )
    assert event_update.status_code == 200
    assert event_update.json()["title"] == "Updated event"
    assert event_update.json()["event_at"] == "2026-12-01T12:00:00Z"

    event_before_invalid_date = await point_rows(engine, include_type=True)
    invalid_event_update = await moderator_client.patch(
        "/api/v1/moderator/points/1",
        json={"event_at": "2026-12-01T12:00:00"},
    )
    assert invalid_event_update.status_code == 422
    assert await point_rows(engine, include_type=True) == event_before_invalid_date
