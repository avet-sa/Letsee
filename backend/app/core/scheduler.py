"""Background task scheduler for automatic backups and token cleanup."""

import asyncio
import logging
from datetime import UTC, datetime

from app.core.backup import backup_manager

logger = logging.getLogger(__name__)


class BackupScheduler:
    """Manages automated backup scheduling."""

    def __init__(self):
        """Initialize scheduler."""
        self.is_running = False
        self.backup_task: asyncio.Task | None = None
        self.cleanup_task: asyncio.Task | None = None
        self.token_cleanup_task: asyncio.Task | None = None

    async def start(self):
        """Start the backup scheduler."""
        if self.is_running:
            logger.warning("Backup scheduler already running")
            return

        self.is_running = True
        logger.info("Starting backup scheduler")

        # Create backup tasks
        self.backup_task = asyncio.create_task(self._backup_loop())
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        self.token_cleanup_task = asyncio.create_task(self._token_cleanup_loop())

    async def stop(self):
        """Stop the backup scheduler."""
        if not self.is_running:
            return

        self.is_running = False
        logger.info("Stopping backup scheduler")

        if self.backup_task:
            self.backup_task.cancel()
        if self.cleanup_task:
            self.cleanup_task.cancel()
        if self.token_cleanup_task:
            self.token_cleanup_task.cancel()

        try:
            if self.backup_task:
                await self.backup_task
            if self.cleanup_task:
                await self.cleanup_task
            if self.token_cleanup_task:
                await self.token_cleanup_task
        except asyncio.CancelledError:
            pass

    async def _backup_loop(self):
        """Continuously create backups at scheduled intervals."""
        # Wait 5 minutes before first backup
        await asyncio.sleep(300)

        while self.is_running:
            try:
                timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
                logger.info(f"Starting scheduled backup at {timestamp}")

                # Run backup in thread pool to avoid blocking
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, backup_manager.create_backup, "auto")

                if result:
                    logger.info(f"Scheduled backup completed: {result}")
                else:
                    logger.error("Scheduled backup failed")

            except Exception as e:
                logger.error(f"Error in backup loop: {e}")

            # Wait 1 hour before next backup
            try:
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                break

    async def _cleanup_loop(self):
        """Periodically clean up old backups."""
        # Wait 10 minutes before first cleanup
        await asyncio.sleep(600)

        while self.is_running:
            try:
                logger.info("Running backup cleanup")

                # Run cleanup in thread pool
                loop = asyncio.get_event_loop()
                deleted = await loop.run_in_executor(None, backup_manager.cleanup_old_backups)

                logger.info(f"Cleanup completed: {deleted} backups deleted")

            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

            # Run cleanup every 24 hours
            try:
                await asyncio.sleep(86400)
            except asyncio.CancelledError:
                break

    async def _token_cleanup_loop(self):
        """Periodically clean up expired revoked tokens."""
        # Wait 1 hour before first cleanup
        await asyncio.sleep(3600)

        while self.is_running:
            try:
                from app.core.database import SessionLocal
                from app.models import RevokedToken

                db = SessionLocal()
                try:
                    # Delete tokens that have expired
                    deleted = (
                        db.query(RevokedToken)
                        .filter(RevokedToken.expires_at < datetime.now(UTC))
                        .delete()
                    )
                    db.commit()
                    logger.info(f"Token cleanup completed: {deleted} expired tokens deleted")
                finally:
                    db.close()

            except Exception as e:
                logger.error(f"Error in token cleanup loop: {e}")

            # Run cleanup every 6 hours (access tokens expire in 30 min)
            try:
                await asyncio.sleep(21600)  # 6 hours
            except asyncio.CancelledError:
                break


# Global scheduler instance
backup_scheduler = BackupScheduler()
