"""migrate_schedule_names_to_user_ids

Revision ID: 7d9a2c6f4b1e
Revises: 556dbdeb7e81
Create Date: 2026-05-11 06:15:00

"""

from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "7d9a2c6f4b1e"
down_revision = "556dbdeb7e81"
branch_labels = None
depends_on = None

SHIFT_ORDER = ("A", "M", "B", "C")

schedules_table = sa.table(
    "schedules",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("shifts", postgresql.JSON),
)

users_table = sa.table(
    "users",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("full_name", sa.String(length=255)),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("deleted_at", sa.DateTime(timezone=True)),
)


def _normalize_person_name(value: str | None) -> str:
    return " ".join((value or "").split()).casefold()


def _resolve_schedule_entry(
    entry: str,
    exact_name_map: dict[str, str],
    normalized_name_map: dict[str, str],
) -> str:
    try:
        return str(UUID(entry))
    except (ValueError, TypeError):
        pass

    return exact_name_map.get(entry) or normalized_name_map.get(_normalize_person_name(entry)) or entry


def _normalize_shifts(
    shifts: dict | None,
    exact_name_map: dict[str, str],
    normalized_name_map: dict[str, str],
) -> dict[str, list[str]]:
    raw_shifts = shifts if isinstance(shifts, dict) else {}
    normalized_shifts: dict[str, list[str]] = {}

    for shift in SHIFT_ORDER:
        raw_entries = raw_shifts.get(shift, [])
        if not isinstance(raw_entries, list):
            raw_entries = []

        normalized_entries: list[str] = []
        seen_entries: set[str] = set()
        for raw_entry in raw_entries:
            value = str(raw_entry or "").strip()
            if not value:
                continue

            resolved_value = _resolve_schedule_entry(value, exact_name_map, normalized_name_map)
            if resolved_value in seen_entries:
                continue

            seen_entries.add(resolved_value)
            normalized_entries.append(resolved_value)

        normalized_shifts[shift] = normalized_entries

    return normalized_shifts


def upgrade() -> None:
    bind = op.get_bind()

    users = bind.execute(
        sa.select(
            users_table.c.id,
            users_table.c.full_name,
            users_table.c.created_at,
            users_table.c.deleted_at,
        ).order_by(users_table.c.deleted_at.is_not(None), users_table.c.created_at, users_table.c.id)
    ).fetchall()

    exact_name_map: dict[str, str] = {}
    normalized_name_map: dict[str, str] = {}
    for user_id, full_name, _created_at, _deleted_at in users:
        name = (full_name or "").strip()
        if not name:
            continue
        canonical_user_id = str(user_id)
        exact_name_map.setdefault(name, canonical_user_id)
        normalized_name_map.setdefault(_normalize_person_name(name), canonical_user_id)

    schedules = bind.execute(sa.select(schedules_table.c.id, schedules_table.c.shifts)).fetchall()
    for schedule_id, shifts in schedules:
        normalized_shifts = _normalize_shifts(shifts, exact_name_map, normalized_name_map)
        if normalized_shifts != (shifts or {}):
            bind.execute(
                sa.update(schedules_table)
                .where(schedules_table.c.id == schedule_id)
                .values(shifts=normalized_shifts)
            )


def downgrade() -> None:
    bind = op.get_bind()

    users = bind.execute(
        sa.select(users_table.c.id, users_table.c.full_name)
    ).fetchall()
    user_name_map = {str(user_id): (full_name or "").strip() for user_id, full_name in users}

    schedules = bind.execute(sa.select(schedules_table.c.id, schedules_table.c.shifts)).fetchall()
    for schedule_id, shifts in schedules:
        raw_shifts = shifts if isinstance(shifts, dict) else {}
        downgraded_shifts: dict[str, list[str]] = {}

        for shift in SHIFT_ORDER:
            raw_entries = raw_shifts.get(shift, [])
            if not isinstance(raw_entries, list):
                raw_entries = []

            downgraded_shifts[shift] = [
                user_name_map.get(str(entry).strip(), str(entry).strip())
                for entry in raw_entries
                if str(entry or "").strip()
            ]

        if downgraded_shifts != raw_shifts:
            bind.execute(
                sa.update(schedules_table)
                .where(schedules_table.c.id == schedule_id)
                .values(shifts=downgraded_shifts)
            )
