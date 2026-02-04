"""add_schedule_audit_fields

Revision ID: a1b2c3d4e5f6
Revises: 4c590b23b1bb
Create Date: 2026-02-04 23:43:27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f20fcaaa40d8'
branch_labels = None
depends_on = None


def upgrade():
    # Add audit fields to schedules table
    op.add_column('schedules', sa.Column('edited_by', sa.String(length=255), nullable=True))
    op.add_column('schedules', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    # Remove audit fields from schedules table
    op.drop_column('schedules', 'edited_at')
    op.drop_column('schedules', 'edited_by')
