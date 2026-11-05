from datetime import datetime

from sqlalchemy import func, select
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
    filters = []
    if status_value:
        filters.append(PointRequest.status == status_value)
    if category_id is not None:
        filters.append(PointRequest.category_id == category_id)
    if created_after is not None:
        filters.append(PointRequest.created_at >= created_after)
    if created_before is not None:
        filters.append(PointRequest.created_at <= created_before)

    count_query = select(func.count()).select_from(
        select(PointRequest.id).where(*filters).subquery()
    )
    total = int(await db.scalar(count_query) or 0)

    query = (
        select(PointRequest)
        .where(*filters)
        .order_by(PointRequest.created_at.desc(), PointRequest.id.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    return list(result.scalars().all()), total
