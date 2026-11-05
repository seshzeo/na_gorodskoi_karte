from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.schemas.category import (
    CategoryAdminPage, CategoryAdminRead, CategoryCreate, CategoryRead, CategoryUpdate,
)
from app.backend.schemas.common import ErrorResponse
from app.backend.services.catalog import (
    create_category, delete_category, get_all_categories, get_categories, update_category,
)
from app.backend.services.errors import ConflictError, NotFoundError

router = APIRouter(
    prefix="/categories",
    tags=["categories"],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)

moderator_categories_router = APIRouter(
    prefix="/moderator/categories",
    tags=["categories"],
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)


@router.get("", response_model=list[CategoryRead])
async def list_categories(db: AsyncSession = Depends(get_db)):
    return await get_categories(db)


@moderator_categories_router.get("", response_model=CategoryAdminPage)
async def list_moderator_categories(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    return await get_all_categories(db, limit=limit, offset=offset)


@router.post(
    "",
    response_model=CategoryAdminRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_moderator)],
)
async def post_category(payload: CategoryCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await create_category(db, payload.model_dump())
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch(
    "/{category_id}",
    response_model=CategoryAdminRead,
    dependencies=[Depends(require_moderator)],
)
async def patch_category(
    category_id: int,
    payload: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await update_category(
            db, category_id, payload.model_dump(exclude_unset=True)
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_moderator)],
)
async def remove_category(category_id: int, db: AsyncSession = Depends(get_db)):
    try:
        await delete_category(db, category_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
