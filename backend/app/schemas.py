from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

# ============ Auth Schemas ============


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str | None
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Person Schemas ============


class PersonCreate(BaseModel):
    name: str
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class PersonUpdate(BaseModel):
    name: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class PersonResponse(BaseModel):
    id: UUID
    name: str
    color: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Schedule Schemas ============


class ShiftAssignment(BaseModel):
    """People assigned to each shift."""

    A: list[str] = Field(default_factory=list)
    M: list[str] = Field(default_factory=list)
    B: list[str] = Field(default_factory=list)
    C: list[str] = Field(default_factory=list)


class ScheduleCreate(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    shifts: ShiftAssignment = Field(default_factory=ShiftAssignment)


class ScheduleUpdate(BaseModel):
    shifts: ShiftAssignment | None = None


class ScheduleResponse(BaseModel):
    id: UUID
    date: str
    shifts: dict  # {A: [people], M: [people], B: [people], C: [people]}
    edited_by: str | None = None
    edited_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Attachment Schemas ============


class AttachmentInfo(BaseModel):
    """Attachment metadata.
    Supports legacy base64/url attachments and new Minio-backed uploads using file_key.
    """

    # New Minio-backed fields
    file_key: str | None = None
    filename: str | None = None
    size: int | None = None
    content_type: str | None = None

    # Legacy inline/base64 fields
    url: str | None = None
    name: str | None = None


# ============ Handover Schemas ============


class HandoverCreate(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    category: str
    room: str | None = None
    guest_name: str | None = None
    text: str
    followup: bool = False
    promised: bool = False
    promise_text: str | None = None
    attachments: list[AttachmentInfo] = Field(default_factory=list)
    timestamp: datetime | None = None
    added_by: str | None = None
    shift: str | None = None
    due_date: str | None = None  # YYYY-MM-DD
    due_time: str | None = None  # HH:MM


class HandoverUpdate(BaseModel):
    category: str | None = None
    room: str | None = None
    guest_name: str | None = None
    text: str | None = None
    followup: bool | None = None
    promised: bool | None = None
    promise_text: str | None = None
    attachments: list[AttachmentInfo] | None = None
    completed: bool | None = None
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    due_time: str | None = None  # HH:MM


class HandoverResponse(BaseModel):
    id: UUID
    date: str
    category: str
    room: str | None
    guest_name: str | None
    text: str
    followup: bool
    promised: bool
    promise_text: str | None
    attachments: list[AttachmentInfo]
    timestamp: datetime
    completed: bool
    added_by: str | None
    shift: str | None
    due_date: str | None
    due_time: str | None
    edited_at: datetime | None
    edited_by: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Setting Schemas ============


class SettingCreate(BaseModel):
    key: str
    value: str


class SettingUpdate(BaseModel):
    value: str


class SettingResponse(BaseModel):
    id: UUID
    key: str
    value: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ File Upload Schemas ============


class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str


class PresignedUrlResponse(BaseModel):
    url: str
    fields: dict  # For form-based uploads
