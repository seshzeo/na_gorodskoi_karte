from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.repositories.category import list_active_categories


async def get_categories(db: AsyncSession):
    return await list_active_categories(db)
