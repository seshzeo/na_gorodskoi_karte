from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, Request, Response

from app.backend.core.config import Settings
from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.services import auth


def test_settings_parse_and_validate():
    s = Settings(
        app_env="development",
        session_idle_timeout_seconds=60,
        session_cookie_samesite=" STRICT ",
        cors_origins=" http://a.test, http://b.test ",
    )
    assert s.session_cookie_samesite == "strict"
    assert s.cors_origins == ["http://a.test", "http://b.test"]


def test_settings_rejects_short_timeout():
    with pytest.raises(ValueError, match="at least 60"):
        Settings(session_idle_timeout_seconds=59)


def test_settings_rejects_bad_samesite():
    with pytest.raises(ValueError, match="lax, strict or none"):
        Settings(session_cookie_samesite="bad")


def test_settings_rejects_none_without_secure():
    with pytest.raises(ValueError, match="SameSite=None"):
        Settings(session_cookie_samesite="none", session_cookie_secure=False)


def test_settings_rejects_insecure_production():
    with pytest.raises(ValueError, match="required in production"):
        Settings(app_env="production", session_cookie_secure=False)


@pytest.mark.asyncio
async def test_get_db_yields_and_closes_session(monkeypatch):
    session = MagicMock()
    context = MagicMock()
    context.__aenter__ = AsyncMock(return_value=session)
    context.__aexit__ = AsyncMock(return_value=False)
    factory = MagicMock(return_value=context)
    monkeypatch.setattr("app.backend.core.database.AsyncSessionLocal", factory)

    yielded = []
    async for value in get_db():
        yielded.append(value)

    assert yielded == [session]
    context.__aenter__.assert_awaited_once()
    context.__aexit__.assert_awaited_once()


def test_hash_and_token_helpers(monkeypatch):
    assert auth._hash("abc") == auth._hash("abc")
    assert auth._hash("abc") != auth._hash("abcd")
    token = auth._new_token()
    assert isinstance(token, str) and token


def test_set_and_clear_cookie():
    response = Response()
    auth.set_session_cookie(response, "token")
    assert "moderator_session=token" in response.headers["set-cookie"]

    response = Response()
    auth.clear_session_cookie(response)
    assert "moderator_session=" in response.headers["set-cookie"]


@pytest.mark.asyncio
async def test_validate_csrf_rejects_missing_or_bad():
    session = SimpleNamespace(csrf_token_hash=auth._hash("good"))
    with pytest.raises(HTTPException) as exc:
        await auth.validate_csrf(session, None)
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await auth.validate_csrf(session, "bad")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_validate_csrf_accepts_good():
    session = SimpleNamespace(csrf_token_hash=auth._hash("good"))
    await auth.validate_csrf(session, "good")


@pytest.mark.asyncio
async def test_get_session_without_cookie():
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b"", "client": ("test", 1), "server": ("test", 80), "scheme": "http"})
    db = MagicMock()
    assert await auth.get_session_from_request(request, db) is None


@pytest.mark.asyncio
async def test_get_session_expired_deletes_and_commits(monkeypatch):
    session = SimpleNamespace(
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
    )
    db = MagicMock()
    db.delete = AsyncMock()
    db.commit = AsyncMock()
    monkeypatch.setattr(auth, "get_moderator_session", AsyncMock(return_value=session))

    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [(b"cookie", b"moderator_session=token")], "query_string": b""})
    assert await auth.get_session_from_request(request, db) is None
    db.delete.assert_awaited_once_with(session)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_current_moderator_rejects_missing_session(monkeypatch):
    monkeypatch.setattr(auth, "get_session_from_request", AsyncMock(return_value=None))
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""})
    with pytest.raises(HTTPException) as exc:
        await auth.get_current_moderator(MagicMock(), request)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_moderator_rejects_inactive_moderator(monkeypatch):
    session = SimpleNamespace(moderator_id="m1")
    moderator = SimpleNamespace(id="m1", is_active=False)
    db = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = moderator
    db.execute = AsyncMock(return_value=result)
    db.delete = AsyncMock()
    db.commit = AsyncMock()
    monkeypatch.setattr(auth, "get_session_from_request", AsyncMock(return_value=session))
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""})

    with pytest.raises(HTTPException) as exc:
        await auth.get_current_moderator(db, request)
    assert exc.value.status_code == 401
    db.delete.assert_awaited_once_with(session)


@pytest.mark.asyncio
async def test_get_current_moderator_validates_csrf_for_write(monkeypatch):
    session = SimpleNamespace(
        moderator_id="m1",
        last_activity_at=None,
        expires_at=None,
    )
    moderator = SimpleNamespace(id="m1", is_active=True)
    db = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = moderator
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    monkeypatch.setattr(auth, "get_session_from_request", AsyncMock(return_value=session))
    validate = AsyncMock()
    monkeypatch.setattr(auth, "validate_csrf", validate)
    request = Request({"type": "http", "method": "POST", "path": "/", "headers": [], "query_string": b""})

    got_moderator, got_session = await auth.get_current_moderator(db, request, "csrf")
    assert got_moderator is moderator
    assert got_session is session
    validate.assert_awaited_once_with(session, "csrf")
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_current_moderator_skips_csrf_for_get(monkeypatch):
    session = SimpleNamespace(moderator_id="m1", last_activity_at=None, expires_at=None)
    moderator = SimpleNamespace(id="m1", is_active=True)
    db = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = moderator
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    monkeypatch.setattr(auth, "get_session_from_request", AsyncMock(return_value=session))
    validate = AsyncMock()
    monkeypatch.setattr(auth, "validate_csrf", validate)
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""})

    await auth.get_current_moderator(db, request)
    validate.assert_not_awaited()


@pytest.mark.asyncio
async def test_require_moderator_refreshes_cookie(monkeypatch):
    moderator = SimpleNamespace(id="m1")
    monkeypatch.setattr("app.backend.core.security.get_current_moderator", AsyncMock(return_value=(moderator, object())))
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": [(b"cookie", b"moderator_session=abc")], "query_string": b""})
    response = Response()
    result = await require_moderator(request, response, MagicMock(), None)
    assert result == "m1"
    assert "moderator_session=abc" in response.headers["set-cookie"]
