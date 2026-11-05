from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.repositories.category import get_active_category
from app.backend.repositories.points import (
    get_point, list_moderator_points, list_points, make_location, nearby_points,
)
from app.backend.services.errors import ConflictError, NotFoundError
from app.backend.services.audit import record_moderator_action


async def fetch_points(db: AsyncSession, **filters):
    rows, total = await list_points(db, **filters)
    return {"rows": rows, "total": total}


async def fetch_moderator_points(db: AsyncSession, **filters):
    rows, total = await list_moderator_points(db, **filters)
    return {"rows": rows, "total": total}


async def fetch_nearby_points(db: AsyncSession, **filters):
    return await nearby_points(db, **filters)


async def fetch_point(db: AsyncSession, point_id: int, *, include_archived: bool = False):
    result = await get_point(db, point_id, active_only=not include_archived)
    if result is None:
        raise NotFoundError("Point not found")
    return result


async def update_point(
    db: AsyncSession, point_id: int, changes: dict, moderator_id: str, *, include_archived: bool = False
):
    point_row = await get_point(db, point_id, active_only=not include_archived, lock=True)
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
    await record_moderator_action(
        db, moderator_id=moderator_id, action="point.updated",
        object_type="point", object_id=point_id,
        details={"changed_fields": sorted(changes)},
    )
    await db.commit()
    # Another moderator may archive the point immediately after this transaction.
    # Return the committed row even if its active flag changed concurrently.
    return await fetch_point(db, point_id, include_archived=True)


async def hide_point(db: AsyncSession, point_id: int, moderator_id: str):
    point_row = await get_point(db, point_id, active_only=False, lock=True)
    if point_row is None:
        raise NotFoundError("Point not found")
    if not point_row[0].is_active:
        raise ConflictError("Point is already archived")
    point_row[0].is_active = False
    await record_moderator_action(
        db, moderator_id=moderator_id, action="point.archived",
        object_type="point", object_id=point_id,
    )
    await db.commit()


async def restore_point(db: AsyncSession, point_id: int, moderator_id: str):
    point_row = await get_point(db, point_id, active_only=False, lock=True)
    if point_row is None:
        raise NotFoundError("Point not found")
    point = point_row[0]
    if point.is_active:
        raise ConflictError("Point is already active")
    if await get_active_category(db, point.category_id) is None:
        raise ConflictError("Point category is inactive; activate the category before restoring")
    point.is_active = True
    await record_moderator_action(
        db, moderator_id=moderator_id, action="point.restored",
        object_type="point", object_id=point_id,
    )
    await db.commit()
    # Keep the response valid if a concurrent archive happens after restoration.
    return await fetch_point(db, point_id, include_archived=True)
