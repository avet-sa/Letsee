import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class User(Base):
    """User model for authentication."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class Person(Base):
    """Staff member."""

    __tablename__ = "people"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    color = Column(String(7), nullable=False)  # Hex color
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class Schedule(Base):
    """Daily shift schedule - contains all 4 shifts per day."""

    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(String(10), unique=True, nullable=False, index=True)  # YYYY-MM-DD
    shifts = Column(
        JSON, nullable=False, default=dict
    )  # {A: [people], M: [people], B: [people], C: [people]}
    edited_by = Column(String(255), nullable=True)  # Who last edited this schedule
    edited_at = Column(DateTime(timezone=True), nullable=True)  # When last edited
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (Index("idx_schedule_date", "date"),)


class Handover(Base):
    """Shift handover note."""

    __tablename__ = "handovers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    category = Column(String(50), nullable=False)  # complaint, request, billing, etc.
    room = Column(String(10), nullable=True)
    guest_name = Column(String(255), nullable=True)
    text = Column(Text, nullable=False)
    followup = Column(Boolean, default=False, nullable=False)
    promised = Column(Boolean, default=False, nullable=False)
    promise_text = Column(Text, nullable=True)
    attachments = Column(JSON, nullable=False, default=list)  # [{url, name}, ...]
    timestamp = Column(DateTime(timezone=True), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    added_by = Column(String(255), nullable=True)
    shift = Column(String(1), nullable=True)  # A, M, B, C
    due_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    due_time = Column(String(5), nullable=True)  # HH:MM
    edited_at = Column(DateTime(timezone=True), nullable=True)
    edited_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    __table_args__ = (
        Index("idx_handover_date", "date"),
        Index("idx_handover_date_created", "date", "created_at"),
        Index("idx_handover_deleted", "deleted_at"),
    )


class Setting(Base):
    """Application settings."""

    __tablename__ = "settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class RevokedToken(Base):
    """Blacklisted JWT tokens for logout/revocation."""

    __tablename__ = "revoked_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(500), unique=True, nullable=False, index=True)
    token_type = Column(String(10), nullable=False)  # 'access' or 'refresh'
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    revoked_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)  # When token would expire

    __table_args__ = (
        Index("idx_revoked_token_user", "user_id", "token_type"),
        Index("idx_revoked_token", "token"),
    )
