from fastapi import APIRouter, HTTPException, status, UploadFile, File, Depends, Request
from fastapi.responses import StreamingResponse
from app.core.config import settings
from app.core.security import get_current_user
from app.core.rate_limit import upload_rate_limiter
import boto3
import uuid
import mimetypes
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/files", tags=["files"])

# Initialize Minio client (lazy initialization)
s3_client = None

# Allowed file extensions (images and PDFs only)
ALLOWED_EXTENSIONS = {
    # Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico',
    # PDFs
    '.pdf'
}

# Max file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


def validate_file_type(filename: str) -> bool:
    """Validate file extension against allowed types."""
    ext = os.path.splitext(filename.lower())[1]
    return ext in ALLOWED_EXTENSIONS


def validate_file_path(file_key: str) -> str:
    """Validate file path to prevent directory traversal attacks."""
    # Remove any path traversal attempts
    if '..' in file_key or file_key.startswith('/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path"
        )
    # Normalize path
    normalized = os.path.normpath(file_key)
    if normalized != file_key.replace('\\', '/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path"
        )
    return file_key

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
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user)
):
    """
    Upload a file to Minio and return the file key for later access.
    Requires authentication. Only images and PDFs allowed.
    """
    # Apply upload-specific rate limiting
    await upload_rate_limiter.check_rate_limit(request)
    
    # Validate file type
    if not validate_file_type(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Only images and PDFs are accepted."
        )
    
    bucket_name = get_bucket_name()
    try:
        client = get_s3_client()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File storage service not available: {str(e)}"
        )
    
    try:
        if not ensure_bucket_exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize storage"
            )
        
        # Read file content and check size
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # Generate unique file key with original extension
        file_extension = os.path.splitext(file.filename)[1].lower()
        file_key = f"attachments/{uuid.uuid4()}{file_extension}"
        
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
async def download_file(
    file_key: str,
    current_user: str = Depends(get_current_user)
):
    """
    Download a file from MinIO with streaming support.
    Requires authentication. Validates file path for security.
    """
    # Validate file path to prevent directory traversal
    validate_file_path(file_key)
    
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
async def delete_file(
    file_key: str,
    current_user: str = Depends(get_current_user)
):
    """
    Delete a file from Minio by file key.
    Requires authentication. Validates file path for security.
    """
    # Validate file path to prevent directory traversal
    validate_file_path(file_key)
    
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
async def presign_upload(
    filename: str,
    content_type: str,
    current_user: str = Depends(get_current_user)
):
    """
    Generate a presigned URL for direct client-side upload to Minio.
    Requires authentication. Only images and PDFs allowed.
    """
    # Validate file type
    if not validate_file_type(filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Only images and PDFs are accepted."
        )
    
    bucket_name = get_bucket_name()
    try:
        client = get_s3_client()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File storage service not available: {str(e)}"
        )
    
    try:
        file_extension = os.path.splitext(filename)[1].lower()
        file_key = f"attachments/{uuid.uuid4()}{file_extension}"
        
        presigned_url = client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
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
