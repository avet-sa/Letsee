from fastapi import APIRouter, HTTPException, status, UploadFile, File
from app.core.config import settings
import boto3
import uuid
import mimetypes
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/files", tags=["files"])

# Initialize Minio client (lazy initialization)
s3_client = None
BUCKET_NAME = 'letsee-attachments'

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
    if not s3_client:
        return False
    
    try:
        s3_client.head_bucket(Bucket=BUCKET_NAME)
        logger.info(f"Bucket {BUCKET_NAME} already exists")
        return True
    except s3_client.exceptions.NoSuchBucket:
        try:
            s3_client.create_bucket(Bucket=BUCKET_NAME)
            logger.info(f"Created bucket {BUCKET_NAME}")
            return True
        except Exception as e:
            logger.error(f"Failed to create bucket {BUCKET_NAME}: {e}")
            return False
    except Exception as e:
        logger.error(f"Error checking bucket: {e}")
        return False


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file to Minio and return the file key for later access.
    """
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
            Bucket=BUCKET_NAME,
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
    Generate a presigned URL for downloading a file from MinIO.
    This allows direct download from MinIO without streaming through FastAPI.
    """
    try:
        client = get_s3_client()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File storage service not available: {str(e)}"
        )
    
    try:
        # Verify file exists
        client.head_object(Bucket=BUCKET_NAME, Key=file_key)
        
        # Generate presigned URL for download (valid for 1 hour)
        presigned_url = client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': file_key
            },
            ExpiresIn=3600
        )
        
        logger.info(f"Generated presigned download URL for: {file_key}")
        
        return {
            "success": True,
            "download_url": presigned_url,
            "file_key": file_key,
            "expires_in": 3600
        }
    except client.exceptions.NoSuchKey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    except Exception as e:
        logger.error(f"Failed to generate download URL for {file_key}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}"
        )


@router.delete("/delete/{file_key:path}")
async def delete_file(file_key: str):
    """
    Delete a file from Minio by file key.
    """
    try:
        client = get_s3_client()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File storage service not available: {str(e)}"
        )
    
    try:
        client.delete_object(Bucket=BUCKET_NAME, Key=file_key)
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
