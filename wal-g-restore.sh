#!/bin/bash
# WAL-G Restore Script
# Interactive restore from backup (requires manual invocation for safety)

set -e

source /app/wal-g-env.sh

LOG_PREFIX="[WAL-G Restore]"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_PREFIX $1"
}

log "╔════════════════════════════════════════════════════════════════╗"
log "║           WAL-G DATABASE RESTORE UTILITY                      ║"
log "║  ⚠️  WARNING: This will overwrite the live database            ║"
log "║  Use only in disaster recovery or test environments            ║"
log "╚════════════════════════════════════════════════════════════════╝"
log ""

log "Available backups:"
wal-g backup-list

log ""
log "Enter backup name to restore (or press Ctrl+C to cancel):"
read -r BACKUP_NAME

if [ -z "$BACKUP_NAME" ]; then
    log "ERROR: No backup selected"
    exit 1
fi

log "Confirming restore of backup: $BACKUP_NAME"
log "This will OVERWRITE all data in PostgreSQL database."
log "Type 'YES' to confirm:"
read -r CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    log "Restore cancelled"
    exit 0
fi

log "⏳ Starting restore from backup: $BACKUP_NAME"
log "This may take several minutes for large databases..."

# Create a new connection slot for restore
export PGUSER="postgres"

if wal-g backup-fetch "$BACKUP_NAME" LATEST; then
    log "✓ Backup extracted successfully"
    log "✓ Restore completed: $BACKUP_NAME"
    log ""
    log "Database is now recovering from the backup."
    log "WAL files will be applied automatically."
    log "Monitor PostgreSQL logs for completion."
else
    log "ERROR: Restore failed!"
    exit 1
fi
