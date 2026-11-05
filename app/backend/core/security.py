from fastapi import Depends, Header, Request

from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.database import get_db
from app.backend.services.auth import get_current_moderator


async def require_moderator(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> str:
    moderator, _ = await get_current_moderator(db, request, x_csrf_token)
    return moderator.id
