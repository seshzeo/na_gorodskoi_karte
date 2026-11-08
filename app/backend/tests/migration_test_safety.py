import os
import re

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError


_ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1"}
_ALLOWED_DATABASE = re.compile(r"migration_test_[A-Za-z0-9][A-Za-z0-9_-]*\Z")


class UnsafeMigrationTestDatabase(ValueError):
    pass


def validated_test_url() -> URL:
    if os.getenv("ALLOW_DESTRUCTIVE_MIGRATION_TESTS") != "true":
        raise UnsafeMigrationTestDatabase(
            "Set ALLOW_DESTRUCTIVE_MIGRATION_TESTS=true to enable destructive migration tests."
        )

    raw_url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if not raw_url:
        raise UnsafeMigrationTestDatabase(
            "MIGRATION_TEST_DATABASE_URL must target a local migration_test_* database."
        )

    try:
        url = make_url(raw_url)
    except (ArgumentError, TypeError, ValueError):
        raise UnsafeMigrationTestDatabase(
            "MIGRATION_TEST_DATABASE_URL is invalid."
        ) from None

    if url.drivername != "postgresql+asyncpg":
        raise UnsafeMigrationTestDatabase(
            "MIGRATION_TEST_DATABASE_URL must use PostgreSQL."
        )
    if url.query:
        raise UnsafeMigrationTestDatabase(
            "MIGRATION_TEST_DATABASE_URL must not override connection options."
        )
    if not url.database or not _ALLOWED_DATABASE.fullmatch(url.database):
        raise UnsafeMigrationTestDatabase(
            "MIGRATION_TEST_DATABASE_URL must target a migration_test_* database."
        )
    if not url.host or url.host.casefold() not in _ALLOWED_HOSTS:
        raise UnsafeMigrationTestDatabase(
            "MIGRATION_TEST_DATABASE_URL must use localhost, 127.0.0.1, or ::1."
        )
    return url


def validated_engine_url(engine) -> URL:
    configured_url = validated_test_url()
    engine_url = engine.url
    configured_target = (
        configured_url.drivername,
        configured_url.host.casefold(),
        configured_url.port,
        configured_url.database,
    )
    engine_target = (
        engine_url.drivername,
        (engine_url.host or "").casefold(),
        engine_url.port,
        engine_url.database,
    )
    if engine_target != configured_target or engine_url.query:
        raise UnsafeMigrationTestDatabase(
            "The database engine does not match the validated migration test database."
        )
    return configured_url
