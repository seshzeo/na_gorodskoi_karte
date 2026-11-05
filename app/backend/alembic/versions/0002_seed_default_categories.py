"""Seed the initial public category catalog.

This is a data migration: conflict-safe inserts make it safe to apply to a
database where an administrator has already created one or more categories.
"""
from alembic import op

revision = "0002_seed_default_categories"
down_revision = "0001_initial_points"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO categories (name, slug, is_active)
        VALUES
            ('События', 'events', TRUE),
            ('Места', 'places', TRUE),
            ('Услуги', 'services', TRUE),
            ('Объявления', 'announcements', TRUE),
            ('Другое', 'other', TRUE)
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    # Preserve catalog data: seeded categories may already be referenced by
    # user-created points or requests, or may have been renamed by a moderator.
    pass
