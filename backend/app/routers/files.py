from fastapi import APIRouter, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from app.core.config import settings
import boto3
import uuid
import mimetypes
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/files", tags=["files"])

# Initialize Minio client (lazy initialization)
s3_client = None

def get_bucket_name():
    """Get bucket name from settings."""
    return settings.MINIO_BUCKET

def get_s3_client():
    """Get or initialize S3 client lazily."""
    global s3_client
    if s3_client is None:
        try:
            s3_client = boto3.client(
                's3',
                endpoint_url=settings.MINIO_URL,
                aws_access_key_id=settings.MINIO_ACCESS_KEY,
                aws_secret_access_key=settings.MINIO_SECRET_KEY,
                region_name='us-east-1'
            )
            logger.info(f"Minio client initialized: {settings.MINIO_URL}")
            ensure_bucket_exists()
        except Exception as e:
            logger.error(f"Failed to initialize Minio client: {e}")
            raise
    return s3_client

def ensure_bucket_exists():
    """Create bucket if it doesn't exist."""
    global s3_client
    bucket_name = get_bucket_name()
    if not s3_client:
        return False
    
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        logger.info(f"Bucket {bucket_name} already exists")
        return True
    except Exception as e:
        # head_bucket raises generic ClientError with 404, not NoSuchBucket
        error_code = e.response.get('Error', {}).get('Code') if hasattr(e, 'response') else None
        
        if error_code == '404' or 'NoSuchBucket' in str(e):
            logger.info(f"Bucket {bucket_name} does not exist, creating it...")
            try:
                s3_client.create_bucket(Bucket=bucket_name)
                logger.info(f"Successfully created bucket {bucket_name}")
                return True
            except Exception as create_error:
                logger.error(f"Failed to create bucket {bucket_name}: {create_error}")
                return False
        else:
            logger.error(f"Error checking bucket {bucket_name}: {e}")
            return False


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file to Minio and return the file key for later access.
    """
    bucket_name = get_bucket_name()
    try:
        client = get_s3_client()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File storage service not available: {str(e)}"
        )
    
    try:
        # Generate unique file key
        file_ext = mimetypes.guess_extension(file.content_type) or '.bin'
        file_key = f"attachments/{uuid.uuid4()}{file_ext}"
        
        # Read file content
        content = await file.read()
        
        logger.info(f"Uploading file: {file.filename} ({len(content)} bytes) to key: {file_key}")
        
        # Upload to Minio
        client.put_object(
            Bucket=bucket_name,
            Key=file_key,
            Body=content,
            ContentType=file.content_type,
            Metadata={'filename': file.filename}
        )
        
        logger.info(f"Successfully uploaded file: {file_key}")
        
        return {
            "success": True,
            "file_key": file_key,
            "filename": file.filename,
            "size": len(content),
            "content_type": file.content_type
        }
    except Exception as e:
        logger.error(f"Failed to upload file {file.filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/download/{file_key:path}")
async def download_file(file_key: str):
    """
    Download a file from MinIO with streaming support.
    Uses Range requests for efficient large file handling.
    """
    bucket_name = get_bucket_name()
    try:
        client = get_s3_client()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File storage service not available: {str(e)}"
        )
    
    try:
        # Verify file exists and get metadata
        response = client.head_object(Bucket=bucket_name, Key=file_key)
        content_length = response.get('ContentLength', 0)
        content_type = response.get('ContentType', 'application/octet-stream')
        
        # Get file object
        file_obj = client.get_object(Bucket=bucket_name, Key=file_key)
        
        filename = file_key.split('/')[-1]
        
        return StreamingResponse(
            iter([file_obj['Body'].read()]),
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(content_length),
                "Accept-Ranges": "bytes"
            }
        )
    except client.exceptions.NoSuchKey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    except Exception as e:
        logger.error(f"Failed to download file {file_key}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file: {str(e)}"
        )


@router.delete("/delete/{file_key:path}")
async def delete_file(file_key: str):
    """
    Delete a file from Minio by file key.
    """
    bucket_name = get_bucket_name()
    try:
        client = get_s3_client()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File storage service not available: {str(e)}"
        )
    
    try:
        client.delete_object(Bucket=bucket_name, Key=file_key)
        return {"success": True, "message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}"
        )


@router.post("/presign-upload")
async def presign_upload(filename: str, content_type: str):
    """
    Generate a presigned URL for direct client-side upload to Minio.
    Not typically used if using /upload endpoint, but useful for large files.
    """
    try:
        file_key = f"attachments/{uuid.uuid4()}/{filename}"
        
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': file_key,
                'ContentType': content_type
            },
            ExpiresIn=3600  # URL valid for 1 hour
        )
        
        return {
            "success": True,
            "presigned_url": presigned_url,
            "file_key": file_key,
            "expires_in": 3600
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate presigned URL: {str(e)}"
        )
