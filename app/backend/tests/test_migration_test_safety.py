import subprocess
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy.engine import make_url

from app.backend.tests.migration_test_safety import (
    UnsafeMigrationTestDatabase,
    validated_engine_url,
    validated_test_url,
)
from app.backend.tests.test_point_types_migration import clear_test_schema


SAFE_URL = "postgresql+asyncpg://tester:secret@localhost/migration_test_unit"


def configure_database(monkeypatch, url=SAFE_URL, allow="true"):
    monkeypatch.setenv("MIGRATION_TEST_DATABASE_URL", url)
    if allow is None:
        monkeypatch.delenv("ALLOW_DESTRUCTIVE_MIGRATION_TESTS", raising=False)
    else:
        monkeypatch.setenv("ALLOW_DESTRUCTIVE_MIGRATION_TESTS", allow)


@pytest.mark.parametrize("allow", [None, "false", "yes", "TRUE", " true "])
def test_requires_exact_destructive_opt_in(monkeypatch, allow):
    configure_database(monkeypatch, allow=allow)

    with pytest.raises(UnsafeMigrationTestDatabase, match="ALLOW_DESTRUCTIVE"):
        validated_test_url()


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+asyncpg://tester:secret@localhost/application",
        "postgresql+asyncpg://tester:secret@localhost/migration_test_",
    ],
)
def test_rejects_database_names_outside_migration_test_pattern(monkeypatch, url):
    configure_database(monkeypatch, url=url)

    with pytest.raises(UnsafeMigrationTestDatabase, match="migration_test_"):
        validated_test_url()


@pytest.mark.parametrize(
    "host",
    ["db.internal", "203.0.113.10", "[2001:4860:4860::8888]"],
)
def test_rejects_remote_or_public_hosts(monkeypatch, host):
    configure_database(monkeypatch, url=f"postgresql+asyncpg://tester:secret@{host}/migration_test_unit")

    with pytest.raises(UnsafeMigrationTestDatabase, match="localhost"):
        validated_test_url()


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]"])
def test_accepts_only_explicit_local_hosts(monkeypatch, host):
    configure_database(
        monkeypatch,
        url=f"postgresql+asyncpg://tester:secret@{host}/migration_test_unit",
    )

    validated = validated_test_url()

    assert validated.database == "migration_test_unit"
    assert validated.host in {"localhost", "127.0.0.1", "::1"}


def test_rejects_url_without_hostname(monkeypatch):
    configure_database(monkeypatch, url="postgresql+asyncpg:///migration_test_unit")

    with pytest.raises(UnsafeMigrationTestDatabase, match="localhost"):
        validated_test_url()


@pytest.mark.parametrize(
    "url",
    [
        "not-a-database-url",
        "postgresql+asyncpg://tester:secret@localhost:invalid/migration_test_unit",
    ],
)
def test_rejects_malformed_url_without_exposing_credentials(monkeypatch, url):
    configure_database(monkeypatch, url=url)

    with pytest.raises(UnsafeMigrationTestDatabase) as error:
        validated_test_url()

    assert "secret" not in str(error.value)


def test_rejects_connection_options_that_could_override_host(monkeypatch):
    configure_database(
        monkeypatch,
        url=(
            "postgresql+asyncpg://tester:secret@localhost/"
            "migration_test_unit?hostaddr=203.0.113.10"
        ),
    )

    with pytest.raises(UnsafeMigrationTestDatabase, match="connection options"):
        validated_test_url()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("url", "allow"),
    [
        (SAFE_URL, None),
        (SAFE_URL, "false"),
        (SAFE_URL, "invalid"),
        (None, "true"),
        ("postgresql://tester:secret@localhost/migration_test_unit", "true"),
        (
            "postgresql+asyncpg://tester:secret@localhost/"
            "migration_test_unit?hostaddr=203.0.113.10",
            "true",
        ),
        ("postgresql+asyncpg://tester:secret@localhost/application", "true"),
        ("postgresql+asyncpg://tester:secret@db.internal/migration_test_unit", "true"),
        ("postgresql+asyncpg://tester:secret@203.0.113.10/migration_test_unit", "true"),
        ("postgresql+asyncpg:///migration_test_unit", "true"),
        ("not-a-database-url", "true"),
    ],
)
async def test_refused_target_never_starts_schema_cleanup(monkeypatch, url, allow):
    if url is None:
        monkeypatch.delenv("MIGRATION_TEST_DATABASE_URL", raising=False)
        if allow is None:
            monkeypatch.delenv("ALLOW_DESTRUCTIVE_MIGRATION_TESTS", raising=False)
        else:
            monkeypatch.setenv("ALLOW_DESTRUCTIVE_MIGRATION_TESTS", allow)
    else:
        configure_database(monkeypatch, url=url, allow=allow)
    engine = SimpleNamespace(
        url=make_url(SAFE_URL),
        begin=Mock(),
    )

    with pytest.raises(UnsafeMigrationTestDatabase):
        await clear_test_schema(engine)

    engine.begin.assert_not_called()


@pytest.mark.asyncio
async def test_engine_must_match_the_validated_database_before_cleanup(monkeypatch):
    configure_database(monkeypatch)
    engine = SimpleNamespace(
        url=make_url("postgresql+asyncpg://tester:secret@localhost/migration_test_other"),
        begin=Mock(),
    )

    with pytest.raises(UnsafeMigrationTestDatabase, match="does not match"):
        validated_engine_url(engine)

    engine.begin.assert_not_called()


def test_refused_target_never_starts_alembic_subprocess(monkeypatch):
    configure_database(monkeypatch, url="postgresql://localhost/migration_test_unit")
    from app.backend.tests import test_point_types_migration

    subprocess = Mock()
    monkeypatch.setattr(test_point_types_migration, "subprocess", SimpleNamespace(run=subprocess))

    with pytest.raises(UnsafeMigrationTestDatabase):
        test_point_types_migration.run_alembic("upgrade", "head")

    subprocess.assert_not_called()


def test_alembic_failure_output_redacts_url_credentials(monkeypatch):
    configure_database(monkeypatch)
    from app.backend.tests import test_point_types_migration

    completed = subprocess.CompletedProcess(
        ["alembic", "downgrade"],
        1,
        stdout=SAFE_URL,
        stderr="database password: secret",
    )
    subprocess_run = Mock(return_value=completed)
    monkeypatch.setattr(
        test_point_types_migration,
        "subprocess",
        SimpleNamespace(run=subprocess_run, CompletedProcess=subprocess.CompletedProcess),
    )

    failed = test_point_types_migration.run_alembic(
        "downgrade",
        "0006_historical_demo_catalog",
        expect_success=False,
    )

    subprocess_run.assert_called_once()
    assert "secret" not in failed.stdout + failed.stderr
    assert "tester" not in failed.stdout + failed.stderr
