from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    DATABASE_URL: str = "postgresql+psycopg://user:password@db:5432/letsee"
    
    # API
    API_TITLE: str = "Letsee Backend"
    API_VERSION: str = "0.1.0"
    API_DESCRIPTION: str = "Hotel Front Office Shift Handover API"
    
    # Auth
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS (expect JSON string or list in env)
    CORS_ORIGINS: List[str] = ["https://localhost"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    CORS_ALLOW_HEADERS: List[str] = ["Authorization", "Content-Type"]
    
    # File upload / Minio
    MINIO_URL: str = "http://minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "letsee-attachments"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Environment
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # ignore unexpected env vars (e.g., legacy S3_* settings)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Allow CORS_ORIGINS to be provided as JSON string or comma list."""
        if isinstance(v, str):
            v = v.strip()
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                # Fallback: comma-separated
                return [item.strip() for item in v.split(",") if item.strip()]
        return v


settings = Settings()
