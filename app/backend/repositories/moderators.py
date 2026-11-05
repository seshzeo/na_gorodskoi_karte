from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.models.moderator import Moderator
from app.backend.models.moderator_session import ModeratorSession


async def get_moderator_by_username(db: AsyncSession, username: str) -> Moderator | None:
    result = await db.execute(
        select(Moderator).where(func.lower(Moderator.username) == username.strip().lower())
    )
    return result.scalar_one_or_none()


async def get_moderator_session(db: AsyncSession, token_hash: str) -> ModeratorSession | None:
    result = await db.execute(
        select(ModeratorSession).where(ModeratorSession.token_hash == token_hash)
    )
    return result.scalar_one_or_none()
