from datetime import datetime

from geoalchemy2 import Geography, Geometry, WKTElement
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.backend.models.point import Point


def _point_query():
    longitude = func.ST_X(cast(Point.location, Geometry(srid=4326))).label("longitude")
    latitude = func.ST_Y(cast(Point.location, Geometry(srid=4326))).label("latitude")
    return select(Point, longitude, latitude).options(selectinload(Point.category))


def _apply_point_filters(
    query,
    *,
    bbox: tuple[float, float, float, float] | None,
    category_ids: list[int] | None,
    event_after: datetime | None,
    event_before: datetime | None,
):
    if bbox:
        min_lon, min_lat, max_lon, max_lat = bbox
        envelope = func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
        query = query.where(
            func.ST_Intersects(cast(Point.location, Geometry(srid=4326)), envelope)
        )
    if category_ids:
        query = query.where(Point.category_id.in_(category_ids))
    if event_after is not None:
        query = query.where(Point.event_at >= event_after)
    if event_before is not None:
        query = query.where(Point.event_at < event_before)
    return query


async def get_point(
    db: AsyncSession, point_id: int, *, active_only: bool = True, lock: bool = False
):
    query = _point_query().where(Point.id == point_id)
    if active_only:
        query = query.where(Point.is_active.is_(True))
    if lock:
        query = query.with_for_update(of=Point)
    result = await db.execute(query)
    return result.one_or_none()


async def list_points(
    db: AsyncSession,
    *,
    bbox: tuple[float, float, float, float] | None,
    category_ids: list[int] | None,
    event_after: datetime | None,
    event_before: datetime | None,
    limit: int,
    offset: int,
):
    filters = dict(
        bbox=bbox,
        category_ids=category_ids,
        event_after=event_after,
        event_before=event_before,
    )
    count_query = _apply_point_filters(
        select(Point.id).where(Point.is_active.is_(True)), **filters
    )
    total = await db.scalar(select(func.count()).select_from(count_query.subquery()))

    query = _apply_point_filters(
        _point_query().where(Point.is_active.is_(True)), **filters
    )
    query = query.order_by(Point.event_at.asc(), Point.id.asc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.all(), int(total or 0)


async def list_moderator_points(
    db: AsyncSession,
    *,
    status_value: str,
    category_id: int | None,
    event_after: datetime | None,
    event_before: datetime | None,
    limit: int,
    offset: int,
):
    filters = []
    if status_value == "active":
        filters.append(Point.is_active.is_(True))
    elif status_value == "archived":
        filters.append(Point.is_active.is_(False))
    if category_id is not None:
        filters.append(Point.category_id == category_id)
    if event_after is not None:
        filters.append(Point.event_at >= event_after)
    if event_before is not None:
        filters.append(Point.event_at < event_before)

    count_query = select(Point.id).where(*filters)
    total = await db.scalar(select(func.count()).select_from(count_query.subquery()))
    query = _point_query().where(*filters).order_by(Point.event_at.asc(), Point.id.asc())
    result = await db.execute(query.limit(limit).offset(offset))
    return result.all(), int(total or 0)


async def nearby_points(
    db: AsyncSession, *, latitude: float, longitude: float,
    radius: int, limit: int,
):
    origin = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    origin_geography = cast(origin, Geography(geometry_type="POINT", srid=4326))
    distance = func.ST_Distance(Point.location, origin_geography).label("distance_m")
    query = _point_query().add_columns(distance).where(
        Point.is_active.is_(True),
        func.ST_DWithin(Point.location, origin_geography, radius),
    ).order_by(distance).limit(limit)
    result = await db.execute(query)
    return result.all()


async def save_point(db: AsyncSession, point: Point) -> Point:
    db.add(point)
    await db.flush()
    return point


def make_location(latitude: float, longitude: float) -> WKTElement:
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)
