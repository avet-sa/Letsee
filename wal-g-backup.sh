#!/bin/bash
# PostgreSQL pg_basebackup + S3 Upload Script
# Automated full backups with encryption and S3 upload

set -e

BACKUP_INTERVAL_SECONDS=${BACKUP_INTERVAL_SECONDS:-86400}  # Default: daily
LOG_PREFIX="[PG-Backup]"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_PREFIX $1"
}

verify_connectivity() {
    log "Verifying database connectivity..."
    if ! pg_isready -h "${PGHOST:-db}" -p "${PGPORT:-5432}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" &>/dev/null; then
        log "ERROR: Cannot connect to PostgreSQL"
        return 1
    fi
    log "✓ PostgreSQL connection OK"

    log "Verifying MinIO connectivity..."
    MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
    if ! curl -s -f -o /dev/null "http://${MINIO_ENDPOINT}/minio/health/live"; then
        log "ERROR: Cannot access MinIO at http://${MINIO_ENDPOINT}"
        return 1
    fi
    log "✓ MinIO connection OK"
    
    return 0
}

create_backup() {
    local backup_timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="/tmp/pg_backup_${backup_timestamp}.tar.gz"
    
    log "Starting backup: pg_backup_${backup_timestamp}"
    
    # Create streaming backup with compression (without -P progress meter)
    if pg_basebackup \
        -h "${PGHOST:-db}" \
        -p "${PGPORT:-5432}" \
        -U "$POSTGRES_USER" \
        -D - \
        -Ft \
        -X none \
        -z \
        2>&1 | gzip > "$backup_file"; then
        
        log "✓ Backup created: $(ls -lh $backup_file | awk '{print $5}')"
        
        # Upload to MinIO using AWS CLI
        if upload_to_minio "$backup_file"; then
            log "✓ Backup uploaded to MinIO"
            rm -f "$backup_file"
            return 0
        else
            log "ERROR: Failed to upload backup to MinIO"
            return 1
        fi
    else
        log "ERROR: pg_basebackup failed"
        return 1
    fi
}

upload_to_minio() {
    local file="$1"
    local filename=$(basename "$file")
    # Always use backup bucket, not attachment bucket
    local s3_bucket="letsee-db-backups"
    
    log "Uploading $filename to s3://${s3_bucket}/${filename}..."
    
    # Use MinIO root credentials (can access all buckets)
    MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}" \
    WALG_ACCESS_KEY="${MINIO_ROOT_USER:-letsee_minio}" \
    WALG_SECRET_KEY="${MINIO_ROOT_PASSWORD:-83yHlH6P2b3V9kbgLoziaxDmin2ncrP-}" \
    python3 /app/pg-upload-s3.py "$file" "$s3_bucket" "$filename"
    
    if [ $? -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

list_backups() {
    log "Recent backups in MinIO:"
    MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}" \
    WALG_ACCESS_KEY="${MINIO_ROOT_USER:-letsee_minio}" \
    WALG_SECRET_KEY="${MINIO_ROOT_PASSWORD:-83yHlH6P2b3V9kbgLoziaxDmin2ncrP-}" \
    python3 << 'PYTHON'
import boto3
import os

s3 = boto3.client(
    's3',
    endpoint_url='http://' + os.getenv('MINIO_ENDPOINT', 'minio:9000'),
    aws_access_key_id=os.getenv('WALG_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('WALG_SECRET_KEY')
)

try:
    response = s3.list_objects_v2(Bucket='letsee-db-backups', MaxKeys=10)
    objects = response.get('Contents', [])
    if objects:
        for obj in objects:
            size_mb = obj['Size'] / (1024*1024)
            print(f"  {obj['Key']} - {size_mb:.1f} MB")
    else:
        print("  No backups found")
except Exception as e:
    print(f"  Error: {e}")
PYTHON
}

# Main loop
log "PostgreSQL Backup Service Starting"
log "Backup interval: $BACKUP_INTERVAL_SECONDS seconds ($(( BACKUP_INTERVAL_SECONDS / 3600 )) hours)"

verify_connectivity || {
    log "ERROR: Initial connectivity check failed, exiting"
    exit 1
}

last_backup_time=0

while true; do
    current_time=$(date +%s)
    time_since_backup=$(( current_time - last_backup_time ))
    
    if [ $time_since_backup -ge $BACKUP_INTERVAL_SECONDS ]; then
        if create_backup; then
            last_backup_time=$current_time
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
