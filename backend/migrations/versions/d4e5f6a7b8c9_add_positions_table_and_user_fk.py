"""add_positions_table_and_user_fk

Creates the positions table (with seed data) and adds the position_id
foreign key column to the users table.

Revision ID: d4e5f6a7b8c9
Revises: 7d9a2c6f4b1e
Create Date: 2026-06-20
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from datetime import datetime, UTC

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "7d9a2c6f4b1e"
branch_labels = None
depends_on = None

# Default positions to seed. Using fixed UUIDs for consistency across environments.
DEFAULT_POSITIONS = [
    ("Manager", "a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    ("Supervisor", "b2c3d4e5-f6a7-8901-bcde-f12345678901"),
    ("Reception", "c3d4e5f6-a7b8-9012-cdef-123456789012"),
    ("Housekeeping", "d4e5f6a7-b8c9-0123-def1-234567890123"),
]


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC)

    # 1. Create the positions lookup table
    op.create_table(
        "positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_positions_name"), "positions", ["name"], unique=True
    )

    # 2. Seed a few sensible default positions.
    # ON CONFLICT protects if the row already exists for some reason.
    for name, pos_id in DEFAULT_POSITIONS:
        bind.execute(
            sa.text("""
                INSERT INTO positions (id, name, created_at)
                VALUES (CAST(:pos_id AS uuid), :name, :created_at)
                ON CONFLICT (name) DO NOTHING
            """).bindparams(
                pos_id=pos_id,
                name=name,
                created_at=now
            )
        )

    # 3. Add the position_id column to users (nullable = existing data is fine)
    op.add_column(
        "users",
        sa.Column("position_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 4. Create the foreign key constraint
    op.create_foreign_key(
        "fk_users_position_id_positions",
        "users",
        "positions",
        ["position_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 5. Helpful index for filtering users by position
    op.create_index("ix_users_position_id", "users", ["position_id"])


def downgrade() -> None:
    # Reverse order
    op.drop_index("ix_users_position_id", table_name="users")
    op.drop_constraint(
        "fk_users_position_id_positions", "users", type_="foreignkey"
    )
    op.drop_column("users", "position_id")

    op.drop_index(op.f("ix_positions_name"), table_name="positions")
    op.drop_table("positions")
