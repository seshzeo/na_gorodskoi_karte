from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.models.point import Point
from app.backend.models.point_request import PointRequest, PointRequestStatus
from app.backend.repositories.category import get_active_category
from app.backend.repositories.point_requests import get_request, list_requests
from app.backend.repositories.points import make_location
from app.backend.services.errors import ConflictError, NotFoundError
from app.backend.services.audit import record_moderator_action


async def submit_request(db: AsyncSession, payload: dict):
    category = await get_active_category(db, payload["category_id"])
    if category is None:
        raise NotFoundError("Active category not found")
    payload["author_external_id"] = "web:anonymous"
    request = PointRequest(**payload)
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


async def fetch_request(db: AsyncSession, request_id: int):
    request = await get_request(db, request_id)
    if request is None:
        raise NotFoundError("Point request not found")
    return request


async def fetch_requests(db: AsyncSession, **filters):
    rows, total = await list_requests(db, **filters)
    return {"rows": rows, "total": total}


async def update_request(db: AsyncSession, request_id: int, changes: dict, moderator_id: str):
    request = await get_request(db, request_id, lock=True)
    if request is None:
        raise NotFoundError("Point request not found")
    if request.status != PointRequestStatus.PENDING:
        raise ConflictError("Only pending requests can be edited")
    if "category_id" in changes and await get_active_category(db, changes["category_id"]) is None:
        raise NotFoundError("Active category not found")
    for key, value in changes.items():
        setattr(request, key, value)
    await record_moderator_action(
        db, moderator_id=moderator_id, action="request.updated",
        object_type="point_request", object_id=request.id,
        details={"changed_fields": sorted(changes)},
    )
    await db.commit()
    await db.refresh(request)
    return request


async def approve_request(db: AsyncSession, request_id: int, moderator_id: str):
    request = await get_request(db, request_id, lock=True)
    if request is None:
        raise NotFoundError("Point request not found")
    if request.status != PointRequestStatus.PENDING:
        raise ConflictError("Only pending requests can be approved")

    point = Point(
        title=request.title,
        description=request.description,
        category_id=request.category_id,
        location=make_location(request.latitude, request.longitude),
        event_at=request.event_at,
        author_name=request.author_name,
        is_active=True,
    )
    db.add(point)
    try:
        # Keep INSERT, request state transition and audit fields in one transaction.
        await db.flush()
        request.status = PointRequestStatus.APPROVED
        request.point_id = point.id
        request.moderated_by = moderator_id
        request.moderated_at = datetime.now(timezone.utc)
        await record_moderator_action(
            db, moderator_id=moderator_id, action="request.approved",
            object_type="point_request", object_id=request.id,
            details={"point_id": point.id},
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Could not approve point request") from exc

    await db.refresh(request)
    return request


async def reject_request(db: AsyncSession, request_id: int, moderator_id: str, reason: str):
    request = await get_request(db, request_id, lock=True)
    if request is None:
        raise NotFoundError("Point request not found")
    if request.status != PointRequestStatus.PENDING:
        raise ConflictError("Only pending requests can be rejected")
    request.status = PointRequestStatus.REJECTED
    request.rejection_reason = reason
    request.moderated_by = moderator_id
    request.moderated_at = datetime.now(timezone.utc)
    await record_moderator_action(
        db, moderator_id=moderator_id, action="request.rejected",
        object_type="point_request", object_id=request.id,
        details={"reason": reason},
    )
    await db.commit()
    await db.refresh(request)
    return request
