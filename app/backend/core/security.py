import secrets

from fastapi import Header, HTTPException, status

from app.backend.core.config import settings


async def require_moderator(
    x_moderator_key: str | None = Header(default=None, alias="X-Moderator-Key"),
) -> str:
    configured_key = settings.moderator_api_key
    if not configured_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Moderator access is not configured",
        )
    if not x_moderator_key or not secrets.compare_digest(x_moderator_key, configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid moderator credentials",
        )
    return "api-key-moderator"
