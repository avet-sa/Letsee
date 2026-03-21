from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Schedule
from app.schemas import ScheduleCreate, ScheduleResponse, ScheduleUpdate

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    date: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Get schedules. Optionally filter by date (YYYY-MM-DD)."""
    query = db.query(Schedule)
    if date:
        query = query.filter(Schedule.date == date)
    return query.order_by(Schedule.date.desc()).all()


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_create: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Create a new schedule for a date."""
    # Check if schedule already exists for this date
    existing = db.query(Schedule).filter(Schedule.date == schedule_create.date).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Schedule already exists for {schedule_create.date}",
        )

    new_schedule = Schedule(
        date=schedule_create.date,
        shifts=schedule_create.shifts.model_dump(),
        edited_by=current_user,
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
    current_user: str = Depends(get_current_user),
):
    """Create or update a schedule by date (YYYY-MM-DD)."""
    schedule = db.query(Schedule).filter(Schedule.date == date).first()

    if schedule:
        # Update existing
        if schedule_update.shifts is not None:
            schedule.shifts = schedule_update.shifts.model_dump()
        # Update audit fields
        schedule.edited_by = current_user
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
            shifts=schedule_update.shifts.model_dump(),
            edited_by=current_user,
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
    current_user: str = Depends(get_current_user),
):
    """Get a schedule by ID or date."""
    # Try UUID first
    try:
        uuid_id = UUID(schedule_id)
        schedule = db.query(Schedule).filter(Schedule.id == uuid_id).first()
    except ValueError:
        # Fallback to date string
        schedule = db.query(Schedule).filter(Schedule.date == schedule_id).first()

    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Delete a schedule by ID or date."""
    # Try UUID first
    try:
        uuid_id = UUID(schedule_id)
        schedule = db.query(Schedule).filter(Schedule.id == uuid_id).first()
    except ValueError:
        # Fallback to date string
        schedule = db.query(Schedule).filter(Schedule.date == schedule_id).first()

    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    db.delete(schedule)
    db.commit()
