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
