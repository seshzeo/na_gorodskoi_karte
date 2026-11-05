"""Create moderator audit log.

Revision ID: 0005_moderator_audit_log
Revises: 0004_moderator_sessions
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_moderator_audit_log"
down_revision = "0004_moderator_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "moderator_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "moderator_id",
            sa.String(length=36),
            sa.ForeignKey("moderators.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("object_type", sa.String(length=40), nullable=False),
        sa.Column("object_id", sa.String(length=80), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_moderator_audit_logs_created_at",
        "moderator_audit_logs",
        ["created_at"],
    )
    op.create_index(
        "ix_moderator_audit_logs_object",
        "moderator_audit_logs",
        ["object_type", "object_id"],
    )
    op.create_index(
        "ix_moderator_audit_logs_moderator",
        "moderator_audit_logs",
        ["moderator_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_moderator_audit_logs_moderator", table_name="moderator_audit_logs")
    op.drop_index("ix_moderator_audit_logs_object", table_name="moderator_audit_logs")
    op.drop_index("ix_moderator_audit_logs_created_at", table_name="moderator_audit_logs")
    op.drop_table("moderator_audit_logs")
