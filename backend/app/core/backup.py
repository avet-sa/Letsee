"""Database backup and recovery management."""
import io
import logging
import os
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

import boto3
from app.core.config import settings
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class BackupManager:
    """Handles database backups and restoration."""

    def __init__(self):
        """Initialize S3/Minio client for backup storage."""
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_URL,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name="us-east-1",
        )
        self.backup_bucket = "letsee-backups"
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        """Create backup bucket if it doesn't exist."""
        try:
            self.s3_client.head_bucket(Bucket=self.backup_bucket)
        except Exception:
            try:
                self.s3_client.create_bucket(Bucket=self.backup_bucket)
                logger.info(f"Created backup bucket: {self.backup_bucket}")
            except Exception as e:
                logger.error(f"Failed to create backup bucket: {e}")

    def _extract_postgres_credentials(self) -> dict:
        """Extract PostgreSQL credentials from DATABASE_URL."""
        url = urlparse(settings.DATABASE_URL)
        return {
            "host": url.hostname or "localhost",
            "port": url.port or 5432,
            "database": url.path.lstrip("/"),
            "user": url.username or "postgres",
            "password": url.password or "",
        }

    def create_backup(self, backup_type: str = "auto") -> Optional[str]:
        """
        Create a database backup using pg_dump.

        Args:
            backup_type: 'auto' for scheduled, 'manual' for user-triggered

        Returns:
            Backup filename if successful, None otherwise
        """
        try:
            creds = self._extract_postgres_credentials()
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_filename = f"backup_{backup_type}_{timestamp}.sql"

            # Create backup using pg_dump
            env = {"PGPASSWORD": creds["password"]}
            cmd = [
                "pg_dump",
                "-h",
                creds["host"],
                "-p",
                str(creds["port"]),
                "-U",
                creds["user"],
                "-d",
                creds["database"],
                "--no-owner",
                "--no-acl",
            ]

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env={**os.environ, **env},
            )
            stdout, stderr = process.communicate()

            if process.returncode != 0:
                logger.error(f"pg_dump failed: {stderr.decode()}")
                return None

            # Upload to S3/Minio
            backup_data = stdout
            try:
                self.s3_client.put_object(
                    Bucket=self.backup_bucket,
                    Key=backup_filename,
                    Body=backup_data,
                    ContentType="text/plain",
                    Metadata={
                        "timestamp": timestamp,
                        "type": backup_type,
                        "size": str(len(backup_data)),
                    },
                )
                logger.info(
                    f"Backup created successfully: {backup_filename} "
                    f"(size: {len(backup_data) / 1024 / 1024:.2f}MB)"
                )
                return backup_filename
            except Exception as e:
                logger.error(f"Failed to upload backup to S3: {e}")
                return None

        except Exception as e:
            logger.error(f"Backup creation failed: {e}")
            return None
        
    def restore_backup(self, backup_filename: str) -> bool:
        """
        Restore database from backup.

        Args:
            backup_filename: Name of backup file to restore

        Returns:
            True if successful, False otherwise
        """
        try:
            creds = self._extract_postgres_credentials()

            # Download backup from S3/Minio
            try:
                response = self.s3_client.get_object(
                    Bucket=self.backup_bucket, Key=backup_filename
                )
                backup_data = response["Body"].read()
            except Exception as e:
                logger.error(f"Failed to download backup from S3: {e}")
                return False

            # Restore using psql
            env = {"PGPASSWORD": creds["password"]}
            cmd = [
                "psql",
                "-h",
                creds["host"],
                "-p",
                str(creds["port"]),
                "-U",
                creds["user"],
                "-d",
                creds["database"],
            ]

            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env={**os.environ, **env},
            )
            stdout, stderr = process.communicate(input=backup_data)

            if process.returncode != 0:
                logger.error(f"psql restore failed: {stderr.decode()}")
                return False

            logger.info(f"Backup restored successfully: {backup_filename}")
            return True

        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False

    def list_backups(self, limit: int = 50) -> list:
        """
        List available backups.

        Returns:
            List of backup metadata
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.backup_bucket, MaxKeys=limit
            )

            backups = []
            if "Contents" in response:
                for obj in sorted(response["Contents"], key=lambda x: x["LastModified"]):
                    backups.append(
                        {
                            "filename": obj["Key"],
                            "size_mb": round(obj["Size"] / 1024 / 1024, 2),
                            "created_at": obj["LastModified"].isoformat(),
                        }
                    )

            return sorted(backups, key=lambda x: x["created_at"], reverse=True)

        except Exception as e:
            logger.error(f"Failed to list backups: {e}")
            return []

    def cleanup_old_backups(
        self, keep_daily: int = 7, keep_hourly: int = 24
    ) -> int:
        """
        Delete old backups to save storage.

        Args:
            keep_daily: Number of daily backups to keep
            keep_hourly: Number of hourly backups to keep

        Returns:
            Number of backups deleted
        """
        try:
            response = self.s3_client.list_objects_v2(Bucket=self.backup_bucket)
            if "Contents" not in response:
                return 0

            backups = sorted(response["Contents"], key=lambda x: x["LastModified"])
            daily_backups = [b for b in backups if "auto" in b["Key"] and "_" in b["Key"]]

            to_delete = []

            # Keep only recent backups
            if len(daily_backups) > keep_daily + keep_hourly:
                to_delete = daily_backups[: len(daily_backups) - keep_daily - keep_hourly]

            deleted_count = 0
            for backup in to_delete:
                try:
                    self.s3_client.delete_object(
                        Bucket=self.backup_bucket, Key=backup["Key"]
                    )
                    logger.info(f"Deleted old backup: {backup['Key']}")
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete backup {backup['Key']}: {e}")

            return deleted_count

        except Exception as e:
            logger.error(f"Cleanup failed: {e}")
            return 0


# Global backup manager instance
backup_manager = BackupManager()
