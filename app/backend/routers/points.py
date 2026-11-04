from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.schemas.point import PointNearbyRead, PointRead, PointUpdate
from app.backend.services.errors import NotFoundError
from app.backend.services.points import (
    fetch_nearby_points, fetch_point, fetch_points, hide_point, update_point,
)

router = APIRouter(prefix="/points", tags=["points"])


def _point_data(row):
    point, longitude, latitude = row[:3]
    return {
        "id": point.id,
        "title": point.title,
        "description": point.description,
        "category_id": point.category_id,
        "category_name": point.category.name,
        "latitude": latitude,
        "longitude": longitude,
        "event_at": point.event_at,
        "author_name": point.author_name,
        "created_at": point.created_at,
        "updated_at": point.updated_at,
    }


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


@router.get("", response_model=list[PointRead])
async def list_map_points(
    bbox: str | None = None,
    category_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    rows = await fetch_points(
        db, bbox=_parse_bbox(bbox), category_id=category_id, limit=limit, offset=offset
    )
    return [_point_data(row) for row in rows]


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
    point_id: int, payload: PointUpdate, db: AsyncSession = Depends(get_db)
):
    try:
        row = await update_point(db, point_id, payload.model_dump(exclude_unset=True))
        return _point_data(row)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete(
    "/{point_id}", status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_moderator)],
)
async def delete_map_point(point_id: int, db: AsyncSession = Depends(get_db)):
    try:
        await hide_point(db, point_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
