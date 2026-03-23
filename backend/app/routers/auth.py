from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import auth_rate_limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    security,
    verify_password,
)
from app.models import RevokedToken, User
from app.schemas import Token, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(user_create: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Register a new user."""
    # Apply per-route rate limiting to prevent mass signups
    await auth_rate_limiter.check_rate_limit(request)
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_create.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create user
    new_user = User(
        email=user_create.email,
        hashed_password=get_password_hash(user_create.password),
        full_name=user_create.full_name,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
async def login(user_login: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticate and return JWT tokens."""
    # Apply per-route rate limiting to protect against brute force
    await auth_rate_limiter.check_rate_limit(request)
    user: User | None = db.query(User).filter(User.email == user_login.email).first()

    if user is None or not verify_password(user_login.password, user.hashed_password):  # type: ignore[arg-type]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    if not user.is_active:  # type: ignore[truthy-bool]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled"
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user info."""
    user = db.query(User).filter(User.id == UUID(current_user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/logout")
async def logout(
    current_user_id: str = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Logout and revoke the JWT token."""
    token = credentials.credentials

    # Decode token to get expiry time
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp_timestamp = payload.get("exp")
        if not exp_timestamp:
            # Fallback: use default expiry (30 minutes)
            expires_at = datetime.now(UTC) + timedelta(minutes=30)
        else:
            expires_at = datetime.fromtimestamp(exp_timestamp, tz=UTC)
    except JWTError:
        # If token is invalid, still allow logout
        expires_at = datetime.now(UTC) + timedelta(minutes=30)

    # Add token to blacklist
    revoked = RevokedToken(
        token=token,
        user_id=current_user_id,
        revoked_at=datetime.now(UTC),
        expires_at=expires_at,
    )
    db.add(revoked)
    db.commit()

    return {"detail": "Logged out successfully"}
