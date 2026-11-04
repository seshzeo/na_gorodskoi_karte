from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.repositories.category import get_active_category
from app.backend.repositories.points import (
    get_point, list_points, make_location, nearby_points,
)
from app.backend.services.errors import NotFoundError


async def fetch_points(db: AsyncSession, **filters):
    return await list_points(db, **filters)


async def fetch_nearby_points(db: AsyncSession, **filters):
    return await nearby_points(db, **filters)


async def fetch_point(db: AsyncSession, point_id: int):
    result = await get_point(db, point_id)
    if result is None:
        raise NotFoundError("Point not found")
    return result


async def update_point(db: AsyncSession, point_id: int, changes: dict):
    point_row = await get_point(db, point_id)
    if point_row is None:
        raise NotFoundError("Point not found")
    point = point_row[0]
    if "category_id" in changes:
        category = await get_active_category(db, changes["category_id"])
        if category is None:
            raise NotFoundError("Active category not found")
    if "latitude" in changes:
        point.location = make_location(changes.pop("latitude"), changes.pop("longitude"))
    for field, value in changes.items():
        setattr(point, field, value)
    await db.commit()
    return await fetch_point(db, point_id)


async def hide_point(db: AsyncSession, point_id: int):
    point_row = await get_point(db, point_id)
    if point_row is None:
        raise NotFoundError("Point not found")
    point_row[0].is_active = False
    await db.commit()
