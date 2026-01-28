"""Backup management routes."""
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.core.backup import backup_manager
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.schemas import UserResponse

router = APIRouter(prefix="/api/backups", tags=["backups"])


class BackupListResponse:
    """Response model for backup list."""

    def __init__(self, filename: str, size_mb: float, created_at: str):
        self.filename = filename
        self.size_mb = size_mb
        self.created_at = created_at


@router.get("/list")
async def list_backups(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """List available backups (admin only)."""
    # In production, add role checking to ensure only admins can access
    backups = backup_manager.list_backups(limit=limit)
    return {"backups": backups, "total": len(backups)}


@router.post("/create")
async def create_backup(
    backup_type: str = "manual",
    current_user: User = Depends(get_current_user),
):
    """Create a manual backup (admin only)."""
    # In production, add role checking
    filename = backup_manager.create_backup(backup_type=backup_type)

    if not filename:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create backup",
        )

    return {"success": True, "backup_filename": filename, "message": "Backup created successfully"}


@router.post("/restore/{backup_filename}")
async def restore_backup(
    backup_filename: str,
    current_user: User = Depends(get_current_user),
):
    """Restore database from backup (admin only)."""
    # In production, add role checking and confirmation
    # Validate backup filename to prevent path traversal
    if "/" in backup_filename or "\\" in backup_filename or ".." in backup_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid backup filename",
        )

    success = backup_manager.restore_backup(backup_filename)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore backup",
        )

    return {"success": True, "message": f"Backup '{backup_filename}' restored successfully"}


@router.post("/cleanup")
async def cleanup_backups(
    keep_daily: int = 7,
    keep_hourly: int = 24,
    current_user: User = Depends(get_current_user),
):
    """Delete old backups to save storage (admin only)."""
    # In production, add role checking
    deleted_count = backup_manager.cleanup_old_backups(
        keep_daily=keep_daily, keep_hourly=keep_hourly
    )
    return {"success": True, "deleted_count": deleted_count}
