from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.schemas.common import ErrorResponse
from app.backend.schemas.point_request import (
    PointRequestCreate,
    PointRequestPage,
    PointRequestRead,
    PointRequestReject,
    PointRequestUpdate,
)
from app.backend.services.errors import ConflictError, NotFoundError
from app.backend.services.point_requests import (
    approve_request,
    fetch_request,
    fetch_requests,
    reject_request,
    submit_request,
    update_request,
)

router = APIRouter(
    prefix="/point-requests",
    tags=["point requests"],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)


def _validate_request_date_filters(
    created_after: datetime | None, created_before: datetime | None
):
    for field_name, value in (
        ("created_after", created_after),
        ("created_before", created_before),
    ):
        if value is not None and value.utcoffset() is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field_name} must include a timezone",
            )
    if created_after and created_before and created_after > created_before:
        raise HTTPException(
            status_code=422,
            detail="created_after must be earlier than or equal to created_before",
        )


@router.post("", response_model=PointRequestRead, status_code=status.HTTP_201_CREATED)
async def create_point_request(
    payload: PointRequestCreate, db: AsyncSession = Depends(get_db)
):
    try:
        return await submit_request(db, payload.model_dump())
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "",
    response_model=PointRequestPage,
    dependencies=[Depends(require_moderator)],
)
async def list_point_requests(
    status_value: str | None = Query(
        default=None, alias="status", pattern="^(pending|approved|rejected)$"
    ),
    category_id: int | None = Query(default=None, gt=0),
    created_after: datetime | None = None,
    created_before: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    _validate_request_date_filters(created_after, created_before)
    result = await fetch_requests(
        db,
        status_value=status_value,
        category_id=category_id,
        created_after=created_after,
        created_before=created_before,
        limit=limit,
        offset=offset,
    )
    return {
        "items": result["rows"],
        "total": result["total"],
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/{request_id}",
    response_model=PointRequestRead,
    dependencies=[Depends(require_moderator)],
)
async def get_point_request(request_id: int, db: AsyncSession = Depends(get_db)):
    try:
        return await fetch_request(db, request_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch(
    "/{request_id}",
    response_model=PointRequestRead,
    dependencies=[Depends(require_moderator)],
)
async def patch_point_request(
    request_id: int, payload: PointRequestUpdate, db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    try:
        return await update_request(
            db, request_id, payload.model_dump(exclude_unset=True), moderator_id
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post(
    "/{request_id}/approve",
    response_model=PointRequestRead,
    dependencies=[Depends(require_moderator)],
)
async def approve_point_request(
    request_id: int,
    moderator_id: str = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await approve_request(db, request_id, moderator_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post(
    "/{request_id}/reject",
    response_model=PointRequestRead,
    dependencies=[Depends(require_moderator)],
)
async def reject_point_request(
    request_id: int,
    payload: PointRequestReject,
    moderator_id: str = Depends(require_moderator),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await reject_request(db, request_id, moderator_id, payload.reason)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
