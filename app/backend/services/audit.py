from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.models.moderator_audit_log import ModeratorAuditLog


async def record_moderator_action(
    db: AsyncSession,
    *,
    moderator_id: str,
    action: str,
    object_type: str,
    object_id: int | str,
    details: dict[str, Any] | None = None,
) -> None:
    """Add an audit entry to the current transaction; caller commits it."""
    db.add(
        ModeratorAuditLog(
            moderator_id=moderator_id,
            action=action,
            object_type=object_type,
            object_id=str(object_id),
            details=details,
        )
    )


from sqlalchemy import func, select

async def list_moderator_actions(
    db: AsyncSession,
    *,
    action: str | None,
    object_type: str | None,
    limit: int,
    offset: int,
):
    filters = []
    if action:
        filters.append(ModeratorAuditLog.action == action)
    if object_type:
        filters.append(ModeratorAuditLog.object_type == object_type)

    total = int(
        await db.scalar(
            select(func.count(ModeratorAuditLog.id)).where(*filters)
        ) or 0
    )
    result = await db.execute(
        select(ModeratorAuditLog)
        .where(*filters)
        .order_by(ModeratorAuditLog.created_at.desc(), ModeratorAuditLog.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all()), total
