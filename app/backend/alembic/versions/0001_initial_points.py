"""Initial schema: categories, points and point_requests."""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision = "0001_initial_points"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("name", name="uq_categories_name"),
        sa.UniqueConstraint("slug", name="uq_categories_slug"),
    )
    op.create_table(
        "points",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("location", Geography(geometry_type="POINT", srid=4326), nullable=False),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_points_location_gist", "points", ["location"], postgresql_using="gist")
    op.create_index("ix_points_event_at", "points", ["event_at"])
    op.create_index("ix_points_category_id", "points", ["category_id"])
    op.create_table(
        "point_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("author_external_id", sa.String(100), nullable=False),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", name="point_request_status"),
                  nullable=False, server_default="pending"),
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        sa.Column("moderated_by", sa.String(100), nullable=True),
        sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("point_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["point_id"], ["points.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("point_id", name="uq_point_requests_point_id"),
    )
    op.create_index("ix_point_requests_status_created_at", "point_requests", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_point_requests_status_created_at", table_name="point_requests")
    op.drop_table("point_requests")
    op.drop_index("ix_points_category_id", table_name="points")
    op.drop_index("ix_points_event_at", table_name="points")
    op.drop_index("ix_points_location_gist", table_name="points")
    op.drop_table("points")
    op.drop_table("categories")
    op.execute("DROP TYPE IF EXISTS point_request_status")
