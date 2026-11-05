from fastapi import APIRouter, Depends, Header, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.models.moderator import Moderator
from app.backend.schemas.auth import CsrfResponse, LoginRequest, LoginResponse, ModeratorRead
from app.backend.services.auth import (
    clear_session_cookie,
    get_session_from_request,
    issue_csrf_token,
    login,
    logout,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/csrf", response_model=CsrfResponse)
async def get_csrf_token(
    request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    token = await issue_csrf_token(request, response, db)
    return {"csrf_token": token}


@router.post("/login", response_model=LoginResponse)
async def login_moderator(
    payload: LoginRequest,
    request: Request,
    response: Response,
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
    db: AsyncSession = Depends(get_db),
):
    moderator, csrf_token = await login(
        db, request, response, payload.username, payload.password, x_csrf_token
    )
    return {"id": moderator.id, "username": moderator.username, "csrf_token": csrf_token}


@router.get("/me", response_model=ModeratorRead)
async def current_moderator(
    moderator_id: str = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Moderator).where(Moderator.id == moderator_id))
    moderator = result.scalar_one()
    return {"id": moderator.id, "username": moderator.username}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_moderator(
    request: Request,
    response: Response,
    moderator_id: str = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    session = await get_session_from_request(request, db)
    if session is not None:
        await logout(db, session)
    clear_session_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
