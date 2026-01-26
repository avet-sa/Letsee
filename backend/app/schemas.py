from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID


# ============ Auth Schemas ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None


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
    full_name: Optional[str]
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
    name: Optional[str] = None
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class PersonResponse(BaseModel):
    id: UUID
    name: str
    color: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ============ Schedule Schemas ============

class ScheduleCreate(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    shift: Literal["A", "M", "B", "C"]
    people: List[str] = Field(default_factory=list)


class ScheduleUpdate(BaseModel):
    shift: Optional[Literal["A", "M", "B", "C"]] = None
    people: Optional[List[str]] = None


class ScheduleResponse(BaseModel):
    id: UUID
    date: str
    shift: str
    people: List[str]
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
    file_key: Optional[str] = None
    filename: Optional[str] = None
    size: Optional[int] = None
    content_type: Optional[str] = None
    
    # Legacy inline/base64 fields
    url: Optional[str] = None
    name: Optional[str] = None


# ============ Handover Schemas ============

class HandoverCreate(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    category: str
    room: Optional[str] = None
    guest_name: Optional[str] = None
    text: str
    followup: bool = False
    promised: bool = False
    promise_text: Optional[str] = None
    attachments: List[AttachmentInfo] = Field(default_factory=list)
    timestamp: Optional[datetime] = None
    added_by: Optional[str] = None
    shift: Optional[str] = None
    due_date: Optional[str] = None  # YYYY-MM-DD
    due_time: Optional[str] = None  # HH:MM


class HandoverUpdate(BaseModel):
    category: Optional[str] = None
    room: Optional[str] = None
    guest_name: Optional[str] = None
    text: Optional[str] = None
    followup: Optional[bool] = None
    promised: Optional[bool] = None
    promise_text: Optional[str] = None
    attachments: Optional[List[AttachmentInfo]] = None
    completed: Optional[bool] = None
    due_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    due_time: Optional[str] = None  # HH:MM


class HandoverResponse(BaseModel):
    id: UUID
    date: str
    category: str
    room: Optional[str]
    guest_name: Optional[str]
    text: str
    followup: bool
    promised: bool
    promise_text: Optional[str]
    attachments: List[AttachmentInfo]
    timestamp: datetime
    completed: bool
    added_by: Optional[str]
    shift: Optional[str]
    due_date: Optional[str]
    due_time: Optional[str]
    edited_at: Optional[datetime]
    edited_by: Optional[str]
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
