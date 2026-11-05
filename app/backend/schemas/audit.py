from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ModeratorAuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    moderator_id: str | None
    action: str
    object_type: str
    object_id: str
    details: dict[str, Any] | None
    created_at: datetime


class ModeratorAuditLogPage(BaseModel):
    items: list[ModeratorAuditLogRead]
    total: int
    limit: int
    offset: int
