"""convert_schedule_to_multi_shift

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-05 00:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Rename old columns temporarily
    op.alter_column('schedules', 'shift', new_column_name='shift_old', existing_type=sa.String(1))
    op.alter_column('schedules', 'people', new_column_name='people_old', existing_type=postgresql.JSON)
    
    # Add new shifts column
    op.add_column('schedules', sa.Column('shifts', postgresql.JSON, nullable=False, server_default='{}'))
    
    # Migrate existing data from old columns to new shifts structure
    op.execute("""
        UPDATE schedules
        SET shifts = jsonb_build_object(
            'A', CASE WHEN shift_old = 'A' THEN people_old ELSE '[]'::json END,
            'M', CASE WHEN shift_old = 'M' THEN people_old ELSE '[]'::json END,
            'B', CASE WHEN shift_old = 'B' THEN people_old ELSE '[]'::json END,
            'C', CASE WHEN shift_old = 'C' THEN people_old ELSE '[]'::json END
        )
        WHERE shift_old IS NOT NULL
    """)
    
    # Drop old columns
    op.drop_column('schedules', 'shift_old')
    op.drop_column('schedules', 'people_old')


def downgrade():
    # Add back old columns
    op.add_column('schedules', sa.Column('shift', sa.String(1), nullable=True))
    op.add_column('schedules', sa.Column('people', postgresql.JSON, nullable=True))
    
    # Migrate data back: pick first non-empty shift
    op.execute("""
        UPDATE schedules
        SET 
            shift = CASE
                WHEN jsonb_array_length(shifts->'A') > 0 THEN 'A'
                WHEN jsonb_array_length(shifts->'M') > 0 THEN 'M'
                WHEN jsonb_array_length(shifts->'B') > 0 THEN 'B'
                WHEN jsonb_array_length(shifts->'C') > 0 THEN 'C'
                ELSE 'A'
            END,
            people = CASE
                WHEN jsonb_array_length(shifts->'A') > 0 THEN shifts->'A'
                WHEN jsonb_array_length(shifts->'M') > 0 THEN shifts->'M'
                WHEN jsonb_array_length(shifts->'B') > 0 THEN shifts->'B'
                WHEN jsonb_array_length(shifts->'C') > 0 THEN shifts->'C'
                ELSE '[]'::jsonb
            END
    """)
    
    # Drop new column
    op.drop_column('schedules', 'shifts')
