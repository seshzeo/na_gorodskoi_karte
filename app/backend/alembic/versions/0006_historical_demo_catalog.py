"""Compatibility placeholder for the historical demo catalog revision.

The original revision performed destructive data replacement.
This replacement intentionally does nothing to preserve existing databases.
"""

revision = "0006_historical_demo_catalog"
down_revision = "0005_moderator_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
