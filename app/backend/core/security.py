from fastapi import Depends, Header, Request, Response

from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.config import settings
from app.backend.core.database import get_db
from app.backend.services.auth import get_current_moderator, set_session_cookie


async def require_moderator(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> str:
    moderator, _ = await get_current_moderator(db, request, x_csrf_token)
    session_token = request.cookies.get(settings.session_cookie_name)
    if session_token:
        set_session_cookie(response, session_token)
    return moderator.id
