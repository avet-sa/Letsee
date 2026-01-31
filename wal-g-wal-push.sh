#!/bin/bash
# PostgreSQL WAL Archiving Script for WAL-G
# This is called by PostgreSQL to archive completed WAL segments
# Called by: archive_command = '/usr/local/bin/wal-g wal-push "%p"'

set -e

# PostgreSQL passes %p as the filename to archive
WAL_FILE="$1"

if [ -z "$WAL_FILE" ]; then
    echo "ERROR: No WAL file specified" >&2
    exit 1
fi

source /app/wal-g-env.sh

# Archive to S3/MinIO
if /usr/local/bin/wal-g wal-push "$WAL_FILE"; then
    exit 0
else
    echo "ERROR: Failed to archive WAL file: $WAL_FILE" >&2
    exit 1
fi
