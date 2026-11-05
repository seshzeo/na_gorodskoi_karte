"""Mark seeded catalog entries as built-in categories."""

from alembic import op
import sqlalchemy as sa

revision = "0003_builtin_categories"
down_revision = "0002_seed_default_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE categories
        SET is_builtin = TRUE
        WHERE slug IN ('events', 'places', 'services', 'announcements', 'other')
        """
    )


def downgrade() -> None:
    op.drop_column("categories", "is_builtin")
