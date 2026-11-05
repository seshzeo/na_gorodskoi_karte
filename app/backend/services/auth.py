import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.config import settings
from app.backend.models.moderator import Moderator
from app.backend.models.moderator_session import ModeratorSession
from app.backend.repositories.moderators import get_moderator_by_username, get_moderator_session

_password_hasher = PasswordHasher()


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_token() -> str:
    return secrets.token_urlsafe(48)


def _expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.session_idle_timeout_seconds)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_idle_timeout_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


async def get_session_from_request(request: Request, db: AsyncSession) -> ModeratorSession | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    session = await get_moderator_session(db, _hash(token))
    if session is None or session.expires_at <= datetime.now(timezone.utc):
        if session is not None:
            await db.delete(session)
            await db.commit()
        return None
    return session


async def issue_csrf_token(
    request: Request, response: Response, db: AsyncSession
) -> str:
    session = await get_session_from_request(request, db)
    token = _new_token()
    now = datetime.now(timezone.utc)
    if session is None:
        session_token = _new_token()
        session = ModeratorSession(
            moderator_id=None,
            token_hash=_hash(session_token),
            csrf_token_hash=_hash(token),
            last_activity_at=now,
            expires_at=_expires_at(),
        )
        db.add(session)
        await db.commit()
        set_session_cookie(response, session_token)
    else:
        session.csrf_token_hash = _hash(token)
        session.last_activity_at = now
        session.expires_at = _expires_at()
        await db.commit()
        existing_token = request.cookies.get(settings.session_cookie_name)
        if existing_token:
            set_session_cookie(response, existing_token)
    return token


async def validate_csrf(session: ModeratorSession, supplied_token: str | None) -> None:
    if not supplied_token or not secrets.compare_digest(
        session.csrf_token_hash, _hash(supplied_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token is missing or invalid",
        )


async def login(
    db: AsyncSession,
    request: Request,
    response: Response,
    username: str,
    password: str,
    csrf_token: str | None,
) -> tuple[Moderator, str]:
    session = await get_session_from_request(request, db)
    if session is None:
        raise HTTPException(status_code=403, detail="CSRF context is missing")
    await validate_csrf(session, csrf_token)

    moderator = await get_moderator_by_username(db, username)
    valid_password = False
    if moderator is not None and moderator.is_active:
        try:
            valid_password = _password_hasher.verify(moderator.password_hash, password)
        except (VerifyMismatchError, InvalidHashError):
            valid_password = False
    if moderator is None or not moderator.is_active or not valid_password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    session_token = _new_token()
    new_csrf_token = _new_token()
    now = datetime.now(timezone.utc)
    session.moderator_id = moderator.id
    session.token_hash = _hash(session_token)
    session.csrf_token_hash = _hash(new_csrf_token)
    session.last_activity_at = now
    session.expires_at = _expires_at()
    await db.commit()
    set_session_cookie(response, session_token)
    return moderator, new_csrf_token


async def get_current_moderator(
    db: AsyncSession, request: Request, csrf_token: str | None = None
) -> tuple[Moderator, ModeratorSession]:
    session = await get_session_from_request(request, db)
    if session is None or session.moderator_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    from sqlalchemy import select

    result = await db.execute(select(Moderator).where(Moderator.id == session.moderator_id))
    moderator = result.scalar_one_or_none()
    if moderator is None or not moderator.is_active:
        await db.delete(session)
        await db.commit()
        raise HTTPException(status_code=401, detail="Authentication required")

    if request.method.upper() not in {"GET", "HEAD", "OPTIONS"}:
        await validate_csrf(session, csrf_token)

    now = datetime.now(timezone.utc)
    session.last_activity_at = now
    session.expires_at = _expires_at()
    await db.commit()
    return moderator, session


async def logout(db: AsyncSession, session: ModeratorSession) -> None:
    await db.delete(session)
    await db.commit()


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite=settings.session_cookie_samesite,
    )


async def create_moderator(db: AsyncSession, username: str, password: str) -> Moderator:
    normalized = username.strip().lower()
    if not normalized or len(normalized) > 80:
        raise ValueError("Username must contain 1..80 characters")
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters")
    if len(password) > 1024:
        raise ValueError("Password must contain no more than 1024 characters")
    existing_moderator_id = await db.scalar(select(Moderator.id).limit(1))
    if existing_moderator_id is not None:
        raise ValueError("Only one moderator account is supported")
    moderator = Moderator(username=normalized, password_hash=_password_hasher.hash(password))
    db.add(moderator)
    await db.commit()
    await db.refresh(moderator)
    return moderator
