import time
import uuid
import logging
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log HTTP requests and responses."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Log request and response with timing and status."""
        # Generate request ID if not present
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        
        # Extract user ID from auth token if available (optional)
        user_id = request.headers.get("X-User-ID")
        request.state.user_id = user_id
        
        # Prepare log context
        log_context = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query) if request.url.query else None,
        }
        
        # Log request start
        logger.info(f"Request started: {request.method} {request.url.path}", extra=log_context)
        
        # Measure request duration
        start_time = time.time()
        
        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000
            
            # Add response info to context
            log_context["status_code"] = response.status_code
            log_context["duration_ms"] = f"{duration_ms:.2f}"
            
            # Log response
            level = "error" if response.status_code >= 400 else "info"
            getattr(logger, level)(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra=log_context,
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as exc:
            duration_ms = (time.time() - start_time) * 1000
            log_context["duration_ms"] = f"{duration_ms:.2f}"
            log_context["error"] = str(exc)
            
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                exc_info=True,
                extra=log_context,
            )
            raise
