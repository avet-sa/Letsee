#!/bin/bash
# WAL-G Automated Full Backup Script
# Runs full backups on a schedule and manages retention

set -e

source /app/wal-g-env.sh

BACKUP_INTERVAL_SECONDS=${BACKUP_INTERVAL_SECONDS:-86400}  # Default: daily
LOG_PREFIX="[WAL-G Backup]"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_PREFIX $1"
}

verify_connectivity() {
    log "Verifying database connectivity..."
    if ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" &>/dev/null; then
        log "ERROR: Cannot connect to PostgreSQL at $PGHOST:$PGPORT"
        return 1
    fi
    log "✓ PostgreSQL connection OK"

    log "Verifying MinIO/S3 connectivity..."
    if ! wal-g st ls &>/dev/null; then
        log "ERROR: Cannot access S3/MinIO at $WALG_S3_ENDPOINT"
        return 1
    fi
    log "✓ MinIO/S3 connection OK"
    
    return 0
}

create_full_backup() {
    local backup_name="full_$(date '+%Y%m%d_%H%M%S')"
    
    log "Starting full backup: $backup_name"
    log "Endpoint: $WALG_S3_ENDPOINT"
    log "Bucket: $WALG_S3_PREFIX"
    
    if wal-g backup-push; then
        log "✓ Full backup completed successfully: $backup_name"
        return 0
    else
        log "ERROR: Full backup failed!"
        return 1
    fi
}

cleanup_retention() {
    log "Running retention cleanup..."
    log "Policy: Keep $WALG_RETENTION_REDUNDANCY backup chains, $WALG_RETENTION_DAYS days old"
    
    if wal-g delete --confirm retain $WALG_RETENTION_REDUNDANCY; then
        log "✓ Retention cleanup completed"
        return 0
    else
        log "ERROR: Retention cleanup failed"
        return 1
    fi
}

list_backups() {
    log "Recent backups in S3:"
    wal-g backup-list || log "No backups found"
}

# Main loop
log "WAL-G Automated Backup Service Starting"
log "Backup interval: $BACKUP_INTERVAL_SECONDS seconds ($(( BACKUP_INTERVAL_SECONDS / 3600 )) hours)"
log "Encryption enabled: $([ -n "$WALG_CRYPTO_KEY" ] && echo "YES" || echo "NO")"

verify_connectivity || {
    log "ERROR: Initial connectivity check failed, exiting"
    exit 1
}

last_backup_time=0

while true; do
    current_time=$(date +%s)
    time_since_backup=$(( current_time - last_backup_time ))
    
    if [ $time_since_backup -ge $BACKUP_INTERVAL_SECONDS ]; then
        if create_full_backup; then
            last_backup_time=$current_time
            cleanup_retention
            list_backups
        else
            log "Backup failed, will retry in 5 minutes"
            sleep 300
            continue
        fi
    else
        time_until_next=$(( BACKUP_INTERVAL_SECONDS - time_since_backup ))
        log "Next backup in $time_until_next seconds"
    fi
    
    sleep 60  # Check every minute
done
