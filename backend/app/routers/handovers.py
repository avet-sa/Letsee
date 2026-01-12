from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.models import Handover
from app.schemas import HandoverCreate, HandoverUpdate, HandoverResponse

router = APIRouter(prefix="/api/handovers", tags=["handovers"])


@router.get("", response_model=List[HandoverResponse])
async def list_handovers(date: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Get handover notes. Optionally filter by date (YYYY-MM-DD)."""
    query = db.query(Handover)
    if date:
        query = query.filter(Handover.date == date)
    return query.order_by(Handover.timestamp.desc()).all()


@router.post("", response_model=HandoverResponse, status_code=status.HTTP_201_CREATED)
async def create_handover(handover_create: HandoverCreate, db: Session = Depends(get_db)):
    """Create a new handover note."""
    timestamp = handover_create.timestamp or datetime.utcnow()
    
    new_handover = Handover(
        date=handover_create.date,
        category=handover_create.category,
        room=handover_create.room,
        guest_name=handover_create.guest_name,
        text=handover_create.text,
        followup=handover_create.followup,
        promised=handover_create.promised,
        promise_text=handover_create.promise_text,
        # Store only provided fields to keep payload clean (supports Minio + legacy)
        attachments=[att.dict(exclude_none=True) for att in handover_create.attachments],
        timestamp=timestamp,
        added_by=handover_create.added_by,
        shift=handover_create.shift,
        due_date=handover_create.due_date,
        due_time=handover_create.due_time,
    )
    db.add(new_handover)
    db.commit()
    db.refresh(new_handover)
    return new_handover


@router.get("/{handover_id}", response_model=HandoverResponse)
async def get_handover(handover_id: UUID, db: Session = Depends(get_db)):
    """Get a handover note by ID."""
    handover = db.query(Handover).filter(Handover.id == handover_id).first()
    if not handover:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Handover note not found"
        )
    return handover


@router.put("/{handover_id}", response_model=HandoverResponse)
async def update_handover(handover_id: UUID, handover_update: HandoverUpdate, db: Session = Depends(get_db)):
    """Update a handover note."""
    handover = db.query(Handover).filter(Handover.id == handover_id).first()
    if not handover:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Handover note not found"
        )
    
    if handover_update.category is not None:
        handover.category = handover_update.category
    if handover_update.room is not None:
        handover.room = handover_update.room
    if handover_update.guest_name is not None:
        handover.guest_name = handover_update.guest_name
    if handover_update.text is not None:
        handover.text = handover_update.text
    if handover_update.followup is not None:
        handover.followup = handover_update.followup
    if handover_update.promised is not None:
        handover.promised = handover_update.promised
    if handover_update.promise_text is not None:
        handover.promise_text = handover_update.promise_text
    if handover_update.attachments is not None:
        handover.attachments = [att.dict(exclude_none=True) for att in handover_update.attachments]
    if handover_update.completed is not None:
        handover.completed = handover_update.completed
    if handover_update.due_date is not None:
        handover.due_date = handover_update.due_date
    if handover_update.due_time is not None:
        handover.due_time = handover_update.due_time
    
    handover.edited_at = datetime.utcnow()
    
    db.commit()
    db.refresh(handover)
    return handover


@router.delete("/{handover_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_handover(handover_id: UUID, db: Session = Depends(get_db)):
    """Delete a handover note."""
    handover = db.query(Handover).filter(Handover.id == handover_id).first()
    if not handover:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Handover note not found"
        )
    
    db.delete(handover)
    db.commit()
