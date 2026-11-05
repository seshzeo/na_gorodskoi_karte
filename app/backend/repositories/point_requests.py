from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.models.point_request import PointRequest


async def get_request(db: AsyncSession, request_id: int, *, lock: bool = False):
    query = select(PointRequest).where(PointRequest.id == request_id)
    if lock:
        query = query.with_for_update()
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_requests(
    db: AsyncSession,
    *,
    status_value: str | None,
    category_id: int | None,
    created_after: datetime | None,
    created_before: datetime | None,
    limit: int,
    offset: int,
):
    query = select(PointRequest)
    if status_value:
        query = query.where(PointRequest.status == status_value)
    if category_id is not None:
        query = query.where(PointRequest.category_id == category_id)
    if created_after is not None:
        query = query.where(PointRequest.created_at >= created_after)
    if created_before is not None:
        query = query.where(PointRequest.created_at <= created_before)
    result = await db.execute(
        query.order_by(PointRequest.created_at.desc(), PointRequest.id.desc())
        .limit(limit).offset(offset)
    )
    return list(result.scalars().all())
