from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
import logging

from app.core.config import settings
from app.core.database import Base, engine
from app.core.rate_limit import api_rate_limiter
from app.core.scheduler import backup_scheduler
from app.routers import auth, people, schedules, handovers, settings as settings_router, files, backups

# Basic logging configuration for production
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Tables are managed by Alembic migrations, not create_all()
# Base.metadata.create_all(bind=engine)  # Removed to avoid race conditions with gunicorn workers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    logger.info("Starting Letsee Backend...")
    api_rate_limiter.start_cleanup()
    await backup_scheduler.start()
    yield
    # Shutdown
    logger.info("Shutting down Letsee Backend...")
    await backup_scheduler.stop()


# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=settings.API_DESCRIPTION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)


# Add global rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply rate limiting to all requests."""
    # Skip rate limiting for health checks
    if request.url.path in ["/health", "/api/health"]:
        return await call_next(request)
    
    # Apply rate limiting with proper exception handling
    try:
        await api_rate_limiter.check_rate_limit(request)
    except HTTPException as exc:
        # Return proper response for rate limit errors
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    
    response = await call_next(request)
    return response


# Include routers
app.include_router(auth.router)
app.include_router(people.router)
app.include_router(schedules.router)
app.include_router(handovers.router)
app.include_router(settings_router.router)
app.include_router(files.router)
app.include_router(backups.router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return {"status": "degraded", "service": "letsee-backend", "db": "unhealthy"}
    return {"status": "ok", "service": "letsee-backend", "db": "healthy", "backups": "enabled"}


@app.get("/api/health")
async def api_health_check():
    """API health check endpoint for Docker health checks."""
    return {"status": "ok", "service": "letsee-backend", "backups": "enabled"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Letsee Backend API",
        "version": settings.API_VERSION,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
