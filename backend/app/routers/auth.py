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
    is_token_revoked,
    security,
    verify_password,
)
from app.models import RevokedToken, User
from app.schemas import RefreshToken, Token, TokenPair, UserCreate, UserLogin, UserResponse

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

    if user is None or not verify_password(str(user_login.password), str(user.hashed_password)):  # type: ignore[arg-type]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    if not user.is_active:  # type: ignore[truthy-bool]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled"
        )

    # Revoke all existing refresh tokens for this user (single session enforcement)
    # This ensures only one active session per user
    revoked_refresh = RevokedToken(
        token="*",
        token_type="refresh",
        user_id=user.id,
        revoked_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(revoked_refresh)
    db.commit()

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
    user = db.query(User).filter(User.id == UUID(current_user_id)).first()  # type: ignore[arg-type]
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/logout")
async def logout(
    current_user_id: str = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Logout and revoke both access and refresh tokens."""
    access_token = credentials.credentials

    # Decode access token to get expiry time
    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            access_expires_at = datetime.fromtimestamp(exp_timestamp, tz=UTC)
        else:
            access_expires_at = datetime.now(UTC) + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
    except JWTError:
        # If token is invalid, still allow logout
        access_expires_at = datetime.now(UTC) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    # Revoke the access token
    revoked_access = RevokedToken(
        token=access_token,
        token_type="access",
        user_id=current_user_id,  # type: ignore[arg-type]
        revoked_at=datetime.now(UTC),
        expires_at=access_expires_at,
    )
    db.add(revoked_access)

    # Also revoke any refresh tokens for this user (single session logout)
    # This prevents using refresh token to get new access token after logout
    revoked_refresh = RevokedToken(
        token="*",  # Wildcard for all refresh tokens of this user
        token_type="refresh",
        user_id=current_user_id,  # type: ignore[arg-type]
        revoked_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(revoked_refresh)

    db.commit()

    return {"detail": "Logged out successfully"}


@router.post("/logout/all")
async def logout_all_sessions(
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Logout all sessions for current user (revoke all tokens)."""
    # Revoke all tokens for this user using wildcard
    revoked = RevokedToken(
        token="*",  # Wildcard for all tokens
        token_type="all",
        user_id=current_user_id,  # type: ignore[arg-type]
        revoked_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(revoked)
    db.commit()

    return {"detail": "All sessions logged out successfully"}


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(
    refresh_request: RefreshToken,
    db: Session = Depends(get_db),
):
    """Refresh access token using a valid refresh token."""
    refresh_token_str = refresh_request.refresh_token

    # Validate the refresh token
    try:
        payload = jwt.decode(
            refresh_token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if refresh token has been revoked
    if is_token_revoked(db, refresh_token_str, user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user still exists and is active
    user = db.query(User).filter(User.id == UUID(user_id)).first()  # type: ignore[arg-type]
    if not user or not user.is_active:  # type: ignore[truthy-bool]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create new token pair
    new_access_token = create_access_token(subject=user_id)
    new_refresh_token = create_refresh_token(subject=user_id)

    # Revoke the old refresh token (token rotation)
    try:
        payload = jwt.decode(
            refresh_token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            old_expires_at = datetime.fromtimestamp(exp_timestamp, tz=UTC)
        else:
            old_expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    except JWTError:
        old_expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    revoked = RevokedToken(
        token=refresh_token_str,
        token_type="refresh",
        user_id=user_id,  # type: ignore[arg-type]
        revoked_at=datetime.now(UTC),
        expires_at=old_expires_at,
    )
    db.add(revoked)
    db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }
