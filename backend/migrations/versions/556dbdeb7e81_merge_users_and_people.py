"""merge_users_and_people

Revision ID: 556dbdeb7e81
Revises: c4d5e6f7a8b9
Create Date: 2026-05-11 03:00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "556dbdeb7e81"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None

DEFAULT_USER_COLOR = "#3498db"


def upgrade() -> None:
    bind = op.get_bind()
    
    # Step 1: Add color column to users
    op.add_column(
        "users",
        sa.Column("color", sa.String(length=7), nullable=True, server_default=DEFAULT_USER_COLOR),
    )
    
    # Step 2: Add deleted_at column for soft delete
    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    
    # Step 3: Get all people with their colors
    result = bind.execute(sa.text("SELECT id, color FROM people"))
    people_colors = {str(row.id): row.color for row in result}
    
    # Step 4: Get all users
    result = bind.execute(sa.text("SELECT id, person_id FROM users"))
    users = list(result)
    
    # Step 5: Update users with the color from their linked person
    for user in users:
        color = people_colors.get(str(user.person_id), DEFAULT_USER_COLOR)
        bind.execute(
            sa.text("UPDATE users SET color = :color WHERE id = :id")
            .bindparams(color=color, id=user.id)
        )
    
    # Step 6: Remove person_id foreign key constraint and column
    op.drop_constraint("fk_users_person_id_people", "users", type_="foreignkey")
    op.drop_index("ix_users_person_id", table_name="users")
    op.drop_column("users", "person_id")
    
    # Step 7: Get all people that don't have a linked user
    existing_user_person_ids = {str(u.person_id) for u in users if u.person_id is not None}
    
    result = bind.execute(sa.text("SELECT id FROM people"))
    all_person_ids = {str(row.id) for row in result}
    orphan_people = all_person_ids - existing_user_person_ids
    
    # Step 8: Create user records for orphan people
    now = datetime.utcnow()
    for person_id_str in orphan_people:
        # Use explicit CAST for UUID
        result = bind.execute(
            sa.text("SELECT name, created_at FROM people WHERE id = CAST(:person_id AS uuid)")
            .bindparams(person_id=person_id_str)
        )
        person = result.first()
        
        if person:
            # Generate email from name
            base_email = (
                person.name.lower()
                .replace(" ", ".")
                .replace("'", "")
                .replace(",", "")
            )
            email = f"{base_email}@letsee.local"
            
            # Use raw SQL to insert with explicit UUID cast
            bind.execute(
                sa.text("""
                    INSERT INTO users (id, email, full_name, color, is_admin, is_active, hashed_password, created_at, deleted_at)
                    VALUES (CAST(:person_id AS uuid), :email, :full_name, :color, :is_admin, :is_active, :hashed_password, :created_at, :deleted_at)
                """).bindparams(
                    person_id=person_id_str,
                    email=email,
                    full_name=person.name,
                    color=people_colors.get(person_id_str, DEFAULT_USER_COLOR),
                    is_admin=False,
                    is_active=False,
                    hashed_password="",
                    created_at=person.created_at or now,
                    deleted_at=None,
                )
            )
    
    # Step 9: Drop the people table
    op.drop_table("people")


def downgrade() -> None:
    bind = op.get_bind()
    
    # Step 1: Recreate people table
    op.create_table(
        "people",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    
    # Step 2: Recreate person_id column in users
    op.add_column(
        "users",
        sa.Column("person_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    
    # Step 3: Migrate data back - get all users
    result = bind.execute(
        sa.text("SELECT id, full_name, color, created_at, deleted_at, email FROM users")
    )
    users = list(result)
    
    now = datetime.utcnow()
    for user in users:
        # Only create person if user is not deleted
        if user.deleted_at is None:
            # Insert into people
            bind.execute(
                sa.text("""
                    INSERT INTO people (id, name, color, created_at, updated_at)
                    VALUES (:id, :name, :color, :created_at, :updated_at)
                """).bindparams(
                    id=user.id,
                    name=user.full_name or user.email.split("@")[0],
                    color=user.color or DEFAULT_USER_COLOR,
                    created_at=user.created_at or now,
                    updated_at=user.created_at or now,
                )
            )
            
            # Link user to person
            bind.execute(
                sa.text("UPDATE users SET person_id = :person_id WHERE id = :id")
                .bindparams(person_id=user.id, id=user.id)
            )
    
    # Step 4: Remove color and deleted_at columns from users
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "color")
    
    # Step 5: Recreate foreign key and index
    op.create_foreign_key(
        "fk_users_person_id_people",
        "users",
        "people",
        ["person_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_person_id", "users", ["person_id"], unique=True)