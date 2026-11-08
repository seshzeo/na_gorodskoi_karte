"""Add permanent map places.

Revision ID: 0007_point_types
Revises: 0006_historical_demo_catalog
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_point_types"
down_revision = "0006_historical_demo_catalog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "points",
        sa.Column("point_type", sa.String(length=20), server_default="event", nullable=False),
    )
    op.alter_column("points", "event_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.create_index("ix_points_type_active", "points", ["point_type", "is_active"])
    op.create_check_constraint(
        "ck_points_type_event_at",
        "points",
        "(point_type = 'event' AND event_at IS NOT NULL) OR "
        "(point_type = 'permanent' AND event_at IS NULL)",
    )


def downgrade() -> None:
    has_non_event_points = op.get_bind().execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM points WHERE point_type != 'event')")
    ).scalar_one()
    if has_non_event_points:
        raise RuntimeError(
            "Cannot downgrade point types while points with a non-event type exist."
        )

    op.drop_constraint("ck_points_type_event_at", "points", type_="check")
    op.drop_index("ix_points_type_active", table_name="points")
    op.alter_column("points", "event_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column("points", "point_type")
