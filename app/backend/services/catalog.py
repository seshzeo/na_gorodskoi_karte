from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.models.category import Category
from app.backend.models.point import Point
from app.backend.models.point_request import PointRequest, PointRequestStatus
from app.backend.repositories.category import (
    get_category,
    get_category_by_name_or_slug,
    list_active_categories,
    list_all_categories,
)
from app.backend.services.audit import record_moderator_action
from app.backend.services.errors import ConflictError, NotFoundError


async def get_categories(db: AsyncSession):
    return await list_active_categories(db)


async def get_all_categories(db: AsyncSession, *, limit: int, offset: int):
    items, total = await list_all_categories(db, limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def create_category(db: AsyncSession, payload: dict, moderator_id: str) -> Category:
    duplicate = await get_category_by_name_or_slug(
        db, name=payload["name"], slug=payload["slug"]
    )
    if duplicate is not None:
        raise ConflictError("Category name or slug already exists")

    category = Category(
        name=payload["name"], slug=payload["slug"], is_active=True, is_builtin=False
    )
    db.add(category)
    try:
        await db.flush()
        await record_moderator_action(
            db,
            moderator_id=moderator_id,
            action="category.created",
            object_type="category",
            object_id=category.id,
            details={"name": category.name, "slug": category.slug},
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Category name or slug already exists") from exc
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession, category_id: int, changes: dict, moderator_id: str
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

    if changes.get("is_active") is False and category.is_active:
        active_points = await db.scalar(
            select(exists().where(Point.category_id == category_id, Point.is_active.is_(True)))
        )
        pending_requests = await db.scalar(
            select(exists().where(
                PointRequest.category_id == category_id,
                PointRequest.status == PointRequestStatus.PENDING,
            ))
        )
        if active_points or pending_requests:
            raise ConflictError("Category is used by active points or pending requests")

    for field, value in changes.items():
        setattr(category, field, value)

    await record_moderator_action(
        db,
        moderator_id=moderator_id,
        action="category.updated",
        object_type="category",
        object_id=category_id,
        details={"changed_fields": sorted(changes)},
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Category name or slug already exists") from exc
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category_id: int, moderator_id: str) -> None:
    category = await get_category(db, category_id)
    if category is None:
        raise NotFoundError("Category not found")
    if category.is_builtin:
        raise ConflictError("Built-in categories cannot be deleted")

    point_in_use = await db.scalar(
        select(exists().where(Point.category_id == category_id))
    )
    request_in_use = await db.scalar(
        select(exists().where(PointRequest.category_id == category_id))
    )
    if point_in_use or request_in_use:
        raise ConflictError("Category is used by points or point requests")

    await record_moderator_action(
        db,
        moderator_id=moderator_id,
        action="category.deleted",
        object_type="category",
        object_id=category_id,
        details={"name": category.name, "slug": category.slug},
    )
    await db.delete(category)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Category is used by points or point requests") from exc
