"""add_user_admin_and_person_link

Revision ID: c4d5e6f7a8b9
Revises: f3999ec856d3
Create Date: 2026-05-09 00:00:00

"""

import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "f3999ec856d3"
branch_labels = None
depends_on = None

DEFAULT_PERSON_COLOR = "#3498db"

users_table = sa.table(
    "users",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("email", sa.String(length=255)),
    sa.column("full_name", sa.String(length=255)),
    sa.column("person_id", postgresql.UUID(as_uuid=True)),
    sa.column("is_admin", sa.Boolean()),
    sa.column("created_at", sa.DateTime(timezone=True)),
)

people_table = sa.table(
    "people",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("name", sa.String(length=255)),
    sa.column("color", sa.String(length=7)),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def _normalize_name(value: str | None) -> str:
    return (value or "").strip().lower()


def _display_name(full_name: str | None, email: str) -> str:
    if full_name and full_name.strip():
        return full_name.strip()
    return email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()


def upgrade() -> None:
    op.add_column("users", sa.Column("person_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(op.f("ix_users_person_id"), "users", ["person_id"], unique=True)
    op.create_foreign_key(
        "fk_users_person_id_people",
        "users",
        "people",
        ["person_id"],
        ["id"],
        ondelete="SET NULL",
    )

    bind = op.get_bind()
    now = datetime.utcnow()

    existing_people = bind.execute(sa.select(people_table.c.id, people_table.c.name)).fetchall()
    person_ids_by_name: dict[str, list[uuid.UUID]] = {}
    for person_id, name in existing_people:
        normalized = _normalize_name(name)
        if not normalized:
            continue
        person_ids_by_name.setdefault(normalized, []).append(person_id)

    used_person_ids: set[uuid.UUID] = set()
    users = bind.execute(
        sa.select(
            users_table.c.id,
            users_table.c.email,
            users_table.c.full_name,
            users_table.c.created_at,
        ).order_by(users_table.c.created_at, users_table.c.id)
    ).fetchall()

    for user_id, email, full_name, _created_at in users:
        display_name = _display_name(full_name, email)
        normalized_name = _normalize_name(display_name)

        person_id = None
        for candidate_id in person_ids_by_name.get(normalized_name, []):
            if candidate_id not in used_person_ids:
                person_id = candidate_id
                break

        if person_id is None:
            person_id = uuid.uuid4()
            bind.execute(
                people_table.insert().values(
                    id=person_id,
                    name=display_name,
                    color=DEFAULT_PERSON_COLOR,
                    created_at=now,
                    updated_at=now,
                )
            )
            person_ids_by_name.setdefault(normalized_name, []).append(person_id)

        used_person_ids.add(person_id)
        bind.execute(
            sa.update(users_table)
            .where(users_table.c.id == user_id)
            .values(person_id=person_id, is_admin=True)
        )

    op.alter_column("users", "is_admin", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_users_person_id_people", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_person_id"), table_name="users")
    op.drop_column("users", "is_admin")
    op.drop_column("users", "person_id")
