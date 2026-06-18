from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_record, require_admin
from app.models import Schedule, User
from app.schemas import ScheduleCreate, ScheduleResponse, ScheduleUpdate

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

VALID_SHIFTS = {"A", "M", "B", "C"}
SHIFT_ORDER = ("A", "M", "B", "C")


def _validate_schedule_date(date_value: str | None) -> str | None:
    """Validate schedule date strings as real YYYY-MM-DD calendar dates."""
    if date_value is None:
        return None

    try:
        parsed = datetime.strptime(date_value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date must be a valid YYYY-MM-DD calendar date",
        )

    if parsed.isoformat() != date_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date must be a valid YYYY-MM-DD calendar date",
        )

    return date_value


def _normalize_person_name(value: str | None) -> str:
    return " ".join((value or "").split()).casefold()


def _build_schedule_user_maps(db: Session) -> tuple[dict[str, str], dict[str, str]]:
    users = (
        db.query(User)
        .order_by(User.deleted_at.is_not(None), User.created_at, User.id)
        .all()
    )

    exact_name_map: dict[str, str] = {}
    normalized_name_map: dict[str, str] = {}
    for user in users:
        name = (user.full_name or "").strip()
        if not name:
            continue
        user_id = str(user.id)
        exact_name_map.setdefault(name, user_id)
        normalized_name_map.setdefault(_normalize_person_name(name), user_id)

    return exact_name_map, normalized_name_map


def _resolve_schedule_entry(
    entry: str,
    exact_name_map: dict[str, str],
    normalized_name_map: dict[str, str],
) -> str | None:
    try:
        return str(UUID(entry))
    except (ValueError, TypeError):
        pass

    return exact_name_map.get(entry) or normalized_name_map.get(_normalize_person_name(entry))


def _normalize_schedule_shifts(
    shifts: dict | None,
    exact_name_map: dict[str, str],
    normalized_name_map: dict[str, str],
) -> tuple[dict[str, list[str]], bool, list[str]]:
    raw_shifts = shifts if isinstance(shifts, dict) else {}
    normalized_shifts: dict[str, list[str]] = {}
    changed = not isinstance(shifts, dict)
    unresolved_entries: list[str] = []

    if set(raw_shifts.keys()) != VALID_SHIFTS:
        changed = True

    for shift in SHIFT_ORDER:
        raw_entries = raw_shifts.get(shift, [])
        if not isinstance(raw_entries, list):
            raw_entries = []
            changed = True

        normalized_entries: list[str] = []
        seen_entries: set[str] = set()

        for raw_entry in raw_entries:
            value = str(raw_entry or "").strip()
            if not value:
                changed = True
                continue

            resolved_value = _resolve_schedule_entry(value, exact_name_map, normalized_name_map)
            if resolved_value is None:
                unresolved_entries.append(value)
                resolved_value = value
            elif resolved_value != value:
                changed = True

            if resolved_value in seen_entries:
                changed = True
                continue

            seen_entries.add(resolved_value)
            normalized_entries.append(resolved_value)

        normalized_shifts[shift] = normalized_entries

    return normalized_shifts, changed, unresolved_entries


def _auto_migrate_schedule_rows(schedules: list[Schedule], db: Session) -> None:
    if not schedules:
        return

    exact_name_map, normalized_name_map = _build_schedule_user_maps(db)
    updated = False

    for schedule in schedules:
        normalized_shifts, changed, unresolved_entries = _normalize_schedule_shifts(
            schedule.shifts,
            exact_name_map,
            normalized_name_map,
        )
        if changed and not unresolved_entries:
            schedule.shifts = normalized_shifts
            updated = True

    if updated:
        db.commit()
        for schedule in schedules:
            db.refresh(schedule)


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    date: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Get schedules. Optionally filter by date (YYYY-MM-DD)."""
    date = _validate_schedule_date(date)

    query = db.query(Schedule)
    if date:
        query = query.filter(Schedule.date == date)
    schedules = query.order_by(Schedule.date.desc()).all()
    _auto_migrate_schedule_rows(schedules, db)
    return schedules


def _validate_shifts(shifts: dict, db: Session) -> None:
    """Validate shift assignments:
    1. Only valid shift keys (A, M, B, C)
    2. All user IDs exist and are active
    3. No duplicate users within a shift
    4. No duplicate users across shifts
    """
    # Validate shift keys
    for shift_key in shifts:
        if shift_key not in VALID_SHIFTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid shift key: {shift_key}. Must be one of {VALID_SHIFTS}",
            )

    # Collect all user IDs and check for duplicates
    all_user_ids = []
    for shift_key, user_ids in shifts.items():
        if not isinstance(user_ids, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shift {shift_key} must be a list of user IDs",
            )

        # Check for duplicates within shift
        if len(user_ids) != len(set(user_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate user IDs in shift {shift_key}",
            )

        all_user_ids.extend(user_ids)

    # Check for duplicates across shifts
    if len(all_user_ids) != len(set(all_user_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User assigned to multiple shifts on the same day",
        )

    # Validate all user IDs exist and are active
    if all_user_ids:
        # Convert string UUIDs to UUID objects
        try:
            uuid_ids = [UUID(uid) for uid in all_user_ids]
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid user ID format: {e}",
            )

        existing_users = (
            db.query(User)
            .filter(
                User.id.in_(uuid_ids),
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
            .all()
        )

        existing_ids = {str(u.id) for u in existing_users}
        for uid in all_user_ids:
            if uid not in existing_ids:
                # Check if user exists but is deleted
                deleted_user = (
                    db.query(User)
                    .filter(
                        User.id == UUID(uid),
                        User.deleted_at.is_not(None),
                    )
                    .first()
                )
                if deleted_user:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"User {uid} is no longer active (deleted)",
                    )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User {uid} not found",
                )


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_create: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new schedule for a date."""
    _validate_schedule_date(schedule_create.date)

    # Check if schedule already exists for this date
    existing = db.query(Schedule).filter(Schedule.date == schedule_create.date).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Schedule already exists for {schedule_create.date}",
        )

    # Validate shifts
    shifts_data = schedule_create.shifts.model_dump()
    _validate_shifts(shifts_data, db)

    new_schedule = Schedule(
        date=schedule_create.date,
        shifts=shifts_data,
        edited_by=current_user.full_name or current_user.email,
        edited_at=datetime.now(UTC),
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)
    return new_schedule


@router.put("/{date}", response_model=ScheduleResponse)
async def upsert_schedule(
    date: str,
    schedule_update: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create or update a schedule by date (YYYY-MM-DD)."""
    date = _validate_schedule_date(date)
    schedule = db.query(Schedule).filter(Schedule.date == date).first()

    if schedule_update.shifts is not None:
        # Validate shifts before saving
        shifts_data = schedule_update.shifts.model_dump()
        _validate_shifts(shifts_data, db)

    if schedule:
        # Update existing
        if schedule_update.shifts is not None:
            schedule.shifts = shifts_data
        # Update audit fields
        schedule.edited_by = current_user.full_name or current_user.email
        schedule.edited_at = datetime.now(UTC)
    else:
        # Create new
        if schedule_update.shifts is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="shifts is required for new schedule",
            )
        schedule = Schedule(
            date=date,
            shifts=shifts_data,
            edited_by=current_user.full_name or current_user.email,
            edited_at=datetime.now(UTC),
        )
        db.add(schedule)

    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_record),
):
    """Get a schedule by ID or date."""
    # Try UUID first
    try:
        uuid_id = UUID(schedule_id)
        schedule = db.query(Schedule).filter(Schedule.id == uuid_id).first()
    except ValueError:
        # Fallback to date string
        schedule_date = _validate_schedule_date(schedule_id)
        schedule = db.query(Schedule).filter(Schedule.date == schedule_date).first()

    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    _auto_migrate_schedule_rows([schedule], db)
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete a schedule by ID or date."""
    # Try UUID first
    try:
        uuid_id = UUID(schedule_id)
        schedule = db.query(Schedule).filter(Schedule.id == uuid_id).first()
    except ValueError:
        # Fallback to date string
        schedule_date = _validate_schedule_date(schedule_id)
        schedule = db.query(Schedule).filter(Schedule.date == schedule_date).first()

    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    schedule_date = schedule.date
    schedule_id = schedule.id
    db.delete(schedule)
    db.commit()
