import os
import time
from datetime import datetime, timezone

from app.core.backup import backup_manager


def main() -> None:
    interval_seconds = int(os.getenv("BACKUP_INTERVAL_SECONDS", "86400"))
    backup_type = os.getenv("BACKUP_TYPE", "auto")
    keep_daily = int(os.getenv("BACKUP_KEEP_DAILY", "7"))
    keep_hourly = int(os.getenv("BACKUP_KEEP_HOURLY", "24"))

    while True:
        timestamp = datetime.now(timezone.utc).isoformat()
        filename = backup_manager.create_backup(backup_type=backup_type)
        if filename:
            backup_manager.cleanup_old_backups(
                keep_daily=keep_daily,
                keep_hourly=keep_hourly,
            )
        next_run = datetime.now(timezone.utc).isoformat()
        print(f"[{timestamp}] backup={filename or 'failed'} next_run_after={interval_seconds}s at={next_run}")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
