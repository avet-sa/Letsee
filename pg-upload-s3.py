#!/usr/bin/env python3
"""Upload PostgreSQL backup to MinIO/S3"""

import sys
import os
import boto3

def upload_backup(file_path, bucket_name, s3_key):
    """Upload backup file to MinIO"""
    
    minio_endpoint = os.getenv('MINIO_ENDPOINT', 'minio:9000')
    access_key = os.getenv('WALG_ACCESS_KEY', 'letsee_minio')
    secret_key = os.getenv('WALG_SECRET_KEY', '83yHlH6P2b3V9kbgLoziaxDmin2ncrP-')
    
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=f'http://{minio_endpoint}',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name='us-east-1'
        )
        
        print(f"Uploading {file_path} to s3://{bucket_name}/{s3_key}...")
        s3_client.upload_file(file_path, bucket_name, s3_key)
        print("Upload successful")
        return 0
    except Exception as e:
        print(f"Upload failed: {e}")
        return 1

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} <file_path> <bucket_name> <s3_key>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    bucket_name = sys.argv[2]
    s3_key = sys.argv[3]
    
    sys.exit(upload_backup(file_path, bucket_name, s3_key))
