from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.backend.models.base import Base


class ModeratorAuditLog(Base):
    __tablename__ = "moderator_audit_logs"
    __table_args__ = (
        Index("ix_moderator_audit_logs_created_at", "created_at"),
        Index("ix_moderator_audit_logs_object", "object_type", "object_id"),
        Index("ix_moderator_audit_logs_moderator", "moderator_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    moderator_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("moderators.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    object_type: Mapped[str] = mapped_column(String(40), nullable=False)
    object_id: Mapped[str] = mapped_column(String(80), nullable=False)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
