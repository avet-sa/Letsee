from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import RevokedToken, User

# JWT
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def build_wildcard_token(user_id: str | UUID, token_type: str) -> str:
    """Build a unique wildcard token marker for per-user token revocation."""
    return f"*:{UUID(str(user_id))}:{token_type}"


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"sub": subject, "exp": expire, "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt  # type: ignore[no-any-return]


def create_refresh_token(subject: str) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": subject, "exp": expire, "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt  # type: ignore[no-any-return]


def is_token_revoked(
    db: Session,
    token: str,
    user_id: str | UUID,
    token_type: str = "access",
) -> bool:
    """Check if a token has been revoked.

    Checks for:
    1. Specific token revocation (exact token match)
    2. Wildcard revocation for specific token type (e.g., all refresh tokens)
    3. Wildcard revocation for all token types (logout all)
    """
    normalized_user_id = UUID(str(user_id))
    wildcard_token = build_wildcard_token(normalized_user_id, token_type)
    wildcard_all_token = build_wildcard_token(normalized_user_id, "all")
    revoked = (
        db.query(RevokedToken)
        .filter(
            (RevokedToken.token == token)
            | (
                ((RevokedToken.token == wildcard_token) | (RevokedToken.token == wildcard_all_token))
                & (RevokedToken.user_id == normalized_user_id)
                & ((RevokedToken.token_type == token_type) | (RevokedToken.token_type == "all"))
            )
            | (
                (RevokedToken.token == "*")
                & (RevokedToken.user_id == normalized_user_id)
                & ((RevokedToken.token_type == token_type) | (RevokedToken.token_type == "all"))
            )
        )
        .first()
    )
    return revoked is not None


def _get_user_from_token(token: str, db: Session) -> User:
    """Decode a JWT token, validate it, and return the current user record."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_type = payload.get("type", "access")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if token has been revoked (after decoding to get user_id)
    if is_token_revoked(db, token, user_id, token_type):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == UUID(str(user_id))).first()  # type: ignore[arg-type]
    if not user or not user.is_active:  # type: ignore[truthy-bool]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user_record(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Get current authenticated user record from JWT token."""
    return _get_user_from_token(credentials.credentials, db)


async def get_optional_current_user_record(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
) -> User | None:
    """Get current user when a bearer token is present, otherwise return None."""
    if credentials is None:
        return None
    return _get_user_from_token(credentials.credentials, db)


async def get_current_user(
    current_user: User = Depends(get_current_user_record),
) -> str:
    """Get current authenticated user id from JWT token."""
    return str(current_user.id)


async def get_current_user_from_query_token(
    token: str = Query(..., description="JWT access token for EventSource"),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate SSE clients that pass the bearer token as a query parameter."""
    return _get_user_from_token(token, db)


async def require_admin(
    current_user: User = Depends(get_current_user_record),
) -> User:
    """Require the current authenticated user to be an admin."""
    if not current_user.is_admin:  # type: ignore[truthy-bool]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
