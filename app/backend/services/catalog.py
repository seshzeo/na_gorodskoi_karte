from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.models.category import Category
from app.backend.models.point import Point
from app.backend.models.point_request import PointRequest
from app.backend.repositories.category import (
    get_category,
    get_category_by_name_or_slug,
    list_active_categories,
)
from app.backend.services.errors import ConflictError, NotFoundError


async def get_categories(db: AsyncSession):
    return await list_active_categories(db)


async def create_category(db: AsyncSession, payload: dict) -> Category:
    duplicate = await get_category_by_name_or_slug(
        db, name=payload["name"], slug=payload["slug"]
    )
    if duplicate is not None:
        raise ConflictError("Category name or slug already exists")

    category = Category(name=payload["name"], slug=payload["slug"], is_active=True)
    db.add(category)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Category name or slug already exists") from exc
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession, category_id: int, changes: dict
) -> Category:
    category = await get_category(db, category_id)
    if category is None:
        raise NotFoundError("Category not found")

    if "name" in changes or "slug" in changes:
        duplicate = await get_category_by_name_or_slug(
            db,
            name=changes.get("name", category.name),
            slug=changes.get("slug", category.slug),
        )
        if duplicate is not None and duplicate.id != category.id:
            raise ConflictError("Category name or slug already exists")

    for field, value in changes.items():
        setattr(category, field, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Category name or slug already exists") from exc
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category_id: int) -> None:
    category = await get_category(db, category_id)
    if category is None:
        raise NotFoundError("Category not found")

    point_in_use = await db.scalar(
        select(exists().where(Point.category_id == category_id))
    )
    request_in_use = await db.scalar(
        select(exists().where(PointRequest.category_id == category_id))
    )
    if point_in_use or request_in_use:
        raise ConflictError("Category is used by points or point requests")

    await db.delete(category)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Category is used by points or point requests") from exc
