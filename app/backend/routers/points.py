from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.schemas.point import (
    ModeratorPointPage, ModeratorPointRead, PointCreate, PointNearbyRead, PointPage, PointRead, PointUpdate,
)
from app.backend.schemas.common import ErrorResponse
from app.backend.services.errors import ConflictError, InvalidInputError, NotFoundError
from app.backend.services.points import (
    fetch_moderator_points, fetch_nearby_points, fetch_point, fetch_points,
    create_point, hide_point, restore_point, update_point,
)

router = APIRouter(
    prefix="/points",
    tags=["points"],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)

moderator_points_router = APIRouter(
    prefix="/moderator/points",
    tags=["moderator points"],
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)


def _point_data(row, *, include_active: bool = False):
    point, longitude, latitude = row[:3]
    data = {
        "id": point.id,
        "title": point.title,
        "description": point.description,
        "category_id": point.category_id,
        "category_name": point.category.name,
        "latitude": latitude,
        "longitude": longitude,
        "point_type": point.point_type,
        "event_at": point.event_at,
        "author_name": point.author_name,
        "created_at": point.created_at,
        "updated_at": point.updated_at,
    }
    if include_active:
        data["is_active"] = point.is_active
    return data


def _parse_bbox(value: str | None):
    if value is None:
        return None
    try:
        parts = [float(item.strip()) for item in value.split(",")]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="bbox must contain four numbers") from exc
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox format: min_lon,min_lat,max_lon,max_lat")
    min_lon, min_lat, max_lon, max_lat = parts
    if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180):
        raise HTTPException(status_code=422, detail="bbox longitude must be between -180 and 180")
    if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
        raise HTTPException(status_code=422, detail="bbox latitude must be between -90 and 90")
    if min_lon >= max_lon or min_lat >= max_lat:
        raise HTTPException(status_code=422, detail="bbox minimum values must be less than maximum values")
    return min_lon, min_lat, max_lon, max_lat


def _validate_event_filters(event_after: datetime | None, event_before: datetime | None):
    for name, value in (("event_after", event_after), ("event_before", event_before)):
        if value is not None and value.utcoffset() is None:
            raise HTTPException(status_code=422, detail=f"{name} must include a timezone")
    if event_after is not None and event_before is not None and event_after >= event_before:
        raise HTTPException(status_code=422, detail="event_after must be earlier than event_before")


@router.get("", response_model=PointPage)
async def list_map_points(
    bbox: str | None = None,
    category_id: list[int] | None = Query(default=None),
    event_after: datetime | None = None,
    event_before: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    _validate_event_filters(event_after, event_before)
    if category_id and any(value <= 0 for value in category_id):
        raise HTTPException(status_code=422, detail="category_id values must be positive")
    result = await fetch_points(
        db,
        bbox=_parse_bbox(bbox),
        category_ids=list(dict.fromkeys(category_id or [])) or None,
        event_after=event_after,
        event_before=event_before,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [_point_data(row) for row in result["rows"]],
        "total": result["total"],
        "limit": limit,
        "offset": offset,
    }


@router.get("/nearby", response_model=list[PointNearbyRead])
async def list_nearby_points(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius: int = Query(default=1000, ge=1, le=50000),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    rows = await fetch_nearby_points(
        db, latitude=latitude, longitude=longitude, radius=radius, limit=limit
    )
    return [{**_point_data(row), "distance_m": row[3]} for row in rows]


@router.get("/{point_id}", response_model=PointRead)
async def get_map_point(point_id: int, db: AsyncSession = Depends(get_db)):
    try:
        return _point_data(await fetch_point(db, point_id))
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{point_id}", response_model=PointRead, dependencies=[Depends(require_moderator)])
async def patch_map_point(
    point_id: int, payload: PointUpdate, db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        row = await update_point(db, point_id, payload.model_dump(exclude_unset=True), moderator_id)
        return _point_data(row)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete(
    "/{point_id}", status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_moderator)],
)
async def delete_map_point(
    point_id: int, db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        await hide_point(db, point_id, moderator_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{point_id}/restore", response_model=PointRead,
    dependencies=[Depends(require_moderator)],
)
async def restore_map_point(
    point_id: int, db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        row = await restore_point(db, point_id, moderator_id)
        return _point_data(row)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@moderator_points_router.post("", response_model=ModeratorPointRead, status_code=status.HTTP_201_CREATED)
async def create_moderator_point(
    payload: PointCreate,
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        row = await create_point(db, payload.model_dump(), moderator_id)
        return _point_data(row, include_active=True)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@moderator_points_router.get("", response_model=ModeratorPointPage)
async def list_moderator_points(
    status_value: str = Query(default="active", alias="status", pattern="^(active|archived|all)$"),
    category_id: int | None = Query(default=None, gt=0),
    event_after: datetime | None = None,
    event_before: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    _validate_event_filters(event_after, event_before)
    result = await fetch_moderator_points(
        db,
        status_value=status_value,
        category_id=category_id,
        event_after=event_after,
        event_before=event_before,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [_point_data(row, include_active=True) for row in result["rows"]],
        "total": result["total"],
        "limit": limit,
        "offset": offset,
    }


@moderator_points_router.get("/{point_id}", response_model=ModeratorPointRead)
async def get_moderator_point(
    point_id: int,
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        return _point_data(await fetch_point(db, point_id, include_archived=True), include_active=True)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@moderator_points_router.patch("/{point_id}", response_model=ModeratorPointRead)
async def patch_moderator_point(
    point_id: int,
    payload: PointUpdate,
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        row = await update_point(
            db, point_id, payload.model_dump(exclude_unset=True), moderator_id, include_archived=True
        )
        return _point_data(row, include_active=True)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@moderator_points_router.delete("/{point_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_moderator_point(
    point_id: int,
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        await hide_point(db, point_id, moderator_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@moderator_points_router.post("/{point_id}/restore", response_model=ModeratorPointRead)
async def restore_moderator_point(
    point_id: int,
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        row = await restore_point(db, point_id, moderator_id)
        return _point_data(row, include_active=True)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
