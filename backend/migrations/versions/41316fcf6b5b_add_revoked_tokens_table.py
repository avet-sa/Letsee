"""add_revoked_tokens_table

Revision ID: 41316fcf6b5b
Revises: b2c3d4e5f6g7
Create Date: 2026-03-23 23:39:30.319865

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = "41316fcf6b5b"
down_revision = "b2c3d4e5f6g7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create revoked_tokens table for JWT token blacklisting
    op.create_table(
        "revoked_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(length=500), nullable=False),
        sa.Column("token_type", sa.String(length=10), nullable=False),  # 'access' or 'refresh'
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    # Create indexes for performance
    op.create_index("ix_revoked_tokens_token", "revoked_tokens", ["token"], unique=False)
    op.create_index("ix_revoked_tokens_user_id", "revoked_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_revoked_tokens_user_id", table_name="revoked_tokens")
    op.drop_index("ix_revoked_tokens_token", table_name="revoked_tokens")
    op.drop_table("revoked_tokens")
