#!/bin/bash
# WAL-G Environment Configuration
# Source this in WAL-G backup/restore operations

# PostgreSQL Configuration
export PGPASSWORD="${POSTGRES_PASSWORD}"
export PGUSER="${POSTGRES_USER}"
export PGDATABASE="${POSTGRES_DB}"
export PGHOST="db"
export PGPORT="5432"

# WAL-G S3/MinIO Configuration
export WALG_S3_ENDPOINT="http://minio:9000"
export WALG_S3_REGION="us-east-1"  # MinIO requires region, even if unused
export AWS_ACCESS_KEY_ID="${WALG_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${WALG_SECRET_KEY}"
export WALG_S3_PREFIX="s3://letsee-db-backups"

# Encryption Configuration (AES-256-GCM)
export WALG_CRYPTO_KEY="${WALG_CRYPTO_KEY}"

# Backup Configuration
export WALG_COMPRESSION_METHOD="brotli"  # Faster than gzip, better compression
export WALG_DELTA_MAX_STEPS=5            # Allow incremental backups up to 5 steps
export WALG_PARALLEL_THREADS=4           # Upload/download parallelism
export WALG_PREVENT_WAL_OVERWRITE=true   # Safety: never overwrite existing WAL

# Retention Configuration (in seconds)
export WALG_RETENTION_DAYS=30             # Keep full backups for 30 days
export WALG_RETENTION_REDUNDANCY=3        # Keep at least 3 full backup chains

# Logging
export WALG_LOG_LEVEL="INFO"
