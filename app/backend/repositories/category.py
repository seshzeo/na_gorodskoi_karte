from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.models.category import Category

async def get_category(db: AsyncSession, category_id: int) -> Category | None:
    return await db.get(Category, category_id)


async def get_active_category(db: AsyncSession, category_id: int) -> Category | None:
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.is_active.is_(True))
    )
    return result.scalar_one_or_none()


async def get_category_by_name_or_slug(
    db: AsyncSession, *, name: str, slug: str
) -> Category | None:
    result = await db.execute(
        select(Category)
        .where((func.lower(Category.name) == name.lower()) | (Category.slug == slug))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_active_categories(db: AsyncSession) -> list[Category]:
    result = await db.execute(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.name)
    )
    return list(result.scalars().all())


async def list_all_categories(
    db: AsyncSession, *, limit: int, offset: int
) -> tuple[list[Category], int]:
    total = await db.scalar(select(func.count(Category.id)))
    result = await db.execute(
        select(Category).order_by(Category.name, Category.id).limit(limit).offset(offset)
    )
    return list(result.scalars().all()), int(total or 0)
