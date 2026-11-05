"""Add moderator accounts and database-backed browser sessions."""

from alembic import op
import sqlalchemy as sa

revision = "0004_moderator_sessions"
down_revision = "0003_builtin_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "moderators",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("username", name="uq_moderators_username"),
    )
    op.create_index(
        "uq_moderators_username_lower",
        "moderators",
        [sa.text("lower(username)")],
        unique=True,
    )
    op.create_table(
        "moderator_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "moderator_id",
            sa.String(length=36),
            sa.ForeignKey("moderators.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_moderator_sessions_token_hash"),
    )
    op.create_index("ix_moderator_sessions_moderator_id", "moderator_sessions", ["moderator_id"])
    op.create_index("ix_moderator_sessions_expires_at", "moderator_sessions", ["expires_at"])

    # Legacy API-key sessions used a static marker, not a real account identity.
    # Clear those markers before introducing the moderator foreign key.
    op.execute("UPDATE point_requests SET moderated_by = NULL WHERE moderated_by IS NOT NULL")
    op.alter_column(
        "point_requests",
        "moderated_by",
        existing_type=sa.String(length=100),
        type_=sa.String(length=36),
        existing_nullable=True,
    )
    op.create_foreign_key(
        "fk_point_requests_moderated_by_moderators",
        "point_requests",
        "moderators",
        ["moderated_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_point_requests_moderated_by_moderators",
        "point_requests",
        type_="foreignkey",
    )
    op.alter_column(
        "point_requests",
        "moderated_by",
        existing_type=sa.String(length=36),
        type_=sa.String(length=100),
        existing_nullable=True,
    )
    op.drop_index("ix_moderator_sessions_expires_at", table_name="moderator_sessions")
    op.drop_index("ix_moderator_sessions_moderator_id", table_name="moderator_sessions")
    op.drop_table("moderator_sessions")
    op.drop_index("uq_moderators_username_lower", table_name="moderators")
    op.drop_table("moderators")
