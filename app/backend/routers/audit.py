from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.schemas.audit import ModeratorAuditLogPage
from app.backend.services.audit import list_moderator_actions

router = APIRouter(
    prefix="/moderator/audit-logs",
    tags=["moderator audit"],
)


@router.get("", response_model=ModeratorAuditLogPage)
async def get_moderator_audit_logs(
    action: str | None = Query(default=None, min_length=1, max_length=80),
    object_type: str | None = Query(default=None, pattern="^(point|point_request|category)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    moderator_id: str = Depends(require_moderator),
):
    items, total = await list_moderator_actions(
        db,
        action=action,
        object_type=object_type,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}
