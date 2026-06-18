from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, require_admin
from app.models import Schedule, User
from app.schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])
DEFAULT_USER_COLOR = "#3498db"


def _schedule_contains_user(schedule: Schedule, user_id: str) -> bool:
    """Return true when a schedule JSON payload references a user ID."""
    shifts = schedule.shifts if isinstance(schedule.shifts, dict) else {}
    for entries in shifts.values():
        if isinstance(entries, list) and user_id in {str(entry) for entry in entries}:
            return True
    return False


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Get all active users (staff members)."""
    users = db.query(User).filter(User.deleted_at.is_(None)).order_by(User.full_name).all()
    return users


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
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a user by ID."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


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

    db.commit()
    db.refresh(user)
    return user


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
