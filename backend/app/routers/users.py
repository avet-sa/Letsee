from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, require_admin, verify_password
from app.models import Position, Schedule, User
from app.schemas import (
    AdminPasswordReset,
    PositionCreate,
    PositionResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/api/users", tags=["users"])
DEFAULT_USER_COLOR = "#3498db"


def _schedule_contains_user(schedule: Schedule, user_id: str) -> bool:
    """Return true when a schedule JSON payload references a user ID."""
    shifts = schedule.shifts if isinstance(schedule.shifts, dict) else {}
    for entries in shifts.values():
        if isinstance(entries, list) and user_id in {str(entry) for entry in entries}:
            return True
    return False


def _user_to_response(user: User) -> dict:
    """Serialize user with resolved position name for responses."""
    pos_name = user.position.name if getattr(user, "position", None) else None
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "color": user.color,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "position_id": user.position_id,
        "position": pos_name,
        "created_at": user.created_at,
    }


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Get all active users (staff members)."""
    users = (
        db.query(User)
        .options(joinedload(User.position))
        .filter(User.deleted_at.is_(None))
        .order_by(User.full_name)
        .all()
    )
    return [_user_to_response(u) for u in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new user (staff member) - admin only."""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_create.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Resolve display name
    display_name = user_create.full_name.strip() if user_create.full_name and user_create.full_name.strip() else user_create.email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()

    new_user = User(
        email=user_create.email,
        hashed_password=get_password_hash(user_create.password),
        full_name=display_name,
        color=user_create.color or DEFAULT_USER_COLOR,
        is_active=True,
        is_admin=user_create.is_admin,
        position_id=user_create.position_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    # reload with position for response
    user = (
        db.query(User)
        .options(joinedload(User.position))
        .filter(User.id == new_user.id)
        .first()
    )
    return _user_to_response(user)


# ============ Positions ============


@router.get("/positions", response_model=list[PositionResponse])
async def list_positions(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """List all available staff positions (any logged in user)."""
    positions = db.query(Position).order_by(Position.name).all()
    return positions


@router.post("/positions", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
async def create_position(
    position_create: PositionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new staff position (admin only)."""
    name = position_create.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Position name is required")

    existing = db.query(Position).filter(Position.name.ilike(name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Position already exists")

    new_pos = Position(name=name)
    db.add(new_pos)
    db.commit()
    db.refresh(new_pos)
    return new_pos


@router.delete("/positions/{pos_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_position(
    pos_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete a position (admin). Any users using it will have it cleared."""
    pos = db.query(Position).filter(Position.id == pos_id).first()
    if not pos:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")

    # Clear references
    db.query(User).filter(User.position_id == pos_id).update({"position_id": None})

    db.delete(pos)
    db.commit()
    return None





@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a user by ID."""
    user = (
        db.query(User)
        .options(joinedload(User.position))
        .filter(User.id == user_id, User.deleted_at.is_(None))
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _user_to_response(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a user (staff member) - admin only."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.color is not None:
        user.color = user_update.color
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    if user_update.is_admin is not None:
        user.is_admin = user_update.is_admin

    # Allow setting or clearing position_id (explicit null clears it)
    update_data = user_update.model_dump(exclude_unset=True)
    if "position_id" in update_data:
        user.position_id = update_data["position_id"]

    db.commit()
    db.refresh(user)
    user = (
        db.query(User)
        .options(joinedload(User.position))
        .filter(User.id == user.id)
        .first()
    )
    return _user_to_response(user)


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: UUID,
    reset: AdminPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Reset another user's password (admin only)."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if verify_password(reset.new_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as the current password",
        )

    user.hashed_password = get_password_hash(reset.new_password)
    db.commit()
    return {"detail": "Password reset successfully"}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Soft delete a user (staff member) - admin only.

    The user is marked as deleted but remains in the database for historical records.
    """
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    assigned_dates = [
        schedule.date
        for schedule in db.query(Schedule).all()
        if _schedule_contains_user(schedule, str(user_id))
    ]
    if assigned_dates:
        preview_dates = ", ".join(sorted(assigned_dates)[:5])
        more_count = len(assigned_dates) - 5
        suffix = f" and {more_count} more" if more_count > 0 else ""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot delete staff member while assigned to schedules. "
                f"Remove them from {preview_dates}{suffix} first."
            ),
        )

    # Soft delete - mark as deleted
    user.deleted_at = db.query(func.now()).scalar()
    user.is_active = False
    user_id = user.id
    db.commit()
    return None



