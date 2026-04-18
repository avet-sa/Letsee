"""add deleted_at column to handovers for soft delete

Revision ID: f3999ec856d3
Revises: 41316fcf6b5b
Create Date: 2026-04-18 00:30:49.073981

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic
revision = "f3999ec856d3"
down_revision = "41316fcf6b5b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("handovers", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("idx_handover_deleted_at", "handovers", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("idx_handover_deleted_at", table_name="handovers")
    op.drop_column("handovers", "deleted_at")
