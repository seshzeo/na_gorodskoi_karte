"""Add permanent map places.

Revision ID: 0006_point_types
Revises: 0005_moderator_audit_log
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_point_types"
down_revision = "0005_moderator_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "points",
        sa.Column("point_type", sa.String(length=20), server_default="event", nullable=False),
    )
    op.alter_column("points", "event_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.create_index("ix_points_type_active", "points", ["point_type", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_points_type_active", table_name="points")
    op.alter_column("points", "event_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column("points", "point_type")
