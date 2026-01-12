from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.security import get_current_user
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models import Schedule
from app.schemas import ScheduleCreate, ScheduleUpdate, ScheduleResponse

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.get("", response_model=List[ScheduleResponse])
async def list_schedules(
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
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
    current_user: str = Depends(get_current_user)
):
    """Create a new schedule for a date."""
    # Check if schedule already exists for this date
    existing = db.query(Schedule).filter(Schedule.date == schedule_create.date).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Schedule already exists for {schedule_create.date}"
        )
    
    new_schedule = Schedule(
        date=schedule_create.date,
        shift=schedule_create.shift,
        people=schedule_create.people
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
    current_user: str = Depends(get_current_user)
):
    """Create or update a schedule by date (YYYY-MM-DD)."""
    schedule = db.query(Schedule).filter(Schedule.date == date).first()
    
    if schedule:
        # Update existing
        if schedule_update.shift is not None:
            schedule.shift = schedule_update.shift
        if schedule_update.people is not None:
            schedule.people = schedule_update.people
    else:
        # Create new
        if schedule_update.shift is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="shift is required for new schedule"
            )
        schedule = Schedule(
            date=date,
            shift=schedule_update.shift,
            people=schedule_update.people or []
        )
        db.add(schedule)
    
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    db.delete(schedule)
    db.commit()

