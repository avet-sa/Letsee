from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
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
    color: str


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


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
    date: str  # YYYY-MM-DD
    shift: str  # A, M, B, C
    people: List[str] = Field(default_factory=list)


class ScheduleUpdate(BaseModel):
    shift: Optional[str] = None
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
    url: str
    name: str


# ============ Handover Schemas ============

class HandoverCreate(BaseModel):
    date: str  # YYYY-MM-DD
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
