from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models import Setting
from app.schemas import SettingCreate, SettingUpdate, SettingResponse

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=List[SettingResponse])
async def list_settings(db: Session = Depends(get_db)):
    """Get all settings."""
    return db.query(Setting).all()


@router.get("/{key}", response_model=SettingResponse)
async def get_setting(key: str, db: Session = Depends(get_db)):
    """Get a setting by key. Auto-creates with default value if not found."""
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        # Auto-create setting with default value for common keys
        defaults = {
            "theme": "dark",
            "language": "en",
            "timezone": "UTC",
        }
        if key in defaults:
            setting = Setting(key=key, value=defaults[key])
            db.add(setting)
            db.commit()
            db.refresh(setting)
            return setting
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    return setting


@router.post("", response_model=SettingResponse, status_code=status.HTTP_201_CREATED)
async def create_setting(setting_create: SettingCreate, db: Session = Depends(get_db)):
    """Create a new setting."""
    # Check if setting already exists
    existing = db.query(Setting).filter(Setting.key == setting_create.key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Setting '{setting_create.key}' already exists"
        )
    
    new_setting = Setting(key=setting_create.key, value=setting_create.value)
    db.add(new_setting)
    db.commit()
    db.refresh(new_setting)
    return new_setting


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(key: str, setting_update: SettingUpdate, db: Session = Depends(get_db)):
    """Update a setting by key."""
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    
    setting.value = setting_update.value
    db.commit()
    db.refresh(setting)
    return setting


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(key: str, db: Session = Depends(get_db)):
    """Delete a setting by key."""
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    
    db.delete(setting)
    db.commit()
