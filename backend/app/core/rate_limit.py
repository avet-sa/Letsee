from fastapi import HTTPException, Request, status
from typing import Dict
import time
from collections import defaultdict
import asyncio


class RateLimiter:
    """Simple in-memory rate limiter."""
    
    def __init__(self, requests: int = 100, window: int = 60):
        """
        Initialize rate limiter.
        
        Args:
            requests: Maximum number of requests allowed
            window: Time window in seconds
        """
        self.requests = requests
        self.window = window
        self.clients: Dict[str, list] = defaultdict(list)
        self._cleanup_task = None
    
    async def _cleanup(self):
        """Periodically clean up old entries."""
        while True:
            await asyncio.sleep(self.window)
            current_time = time.time()
            for client_id in list(self.clients.keys()):
                # Remove timestamps older than the window
                self.clients[client_id] = [
                    ts for ts in self.clients[client_id]
                    if current_time - ts < self.window
                ]
                # Remove empty entries
                if not self.clients[client_id]:
                    del self.clients[client_id]
    
    def start_cleanup(self):
        """Start the cleanup background task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup())
    
    async def check_rate_limit(self, request: Request):
        """
        Check if request should be rate limited.
        
        Raises:
            HTTPException: If rate limit is exceeded
        """
        # Get client identifier (IP address)
        client_id = request.client.host if request.client else "unknown"
        
        current_time = time.time()
        
        # Clean old timestamps for this client
        self.clients[client_id] = [
            ts for ts in self.clients[client_id]
            if current_time - ts < self.window
        ]
        
        # Check if rate limit exceeded
        if len(self.clients[client_id]) >= self.requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {self.requests} requests per {self.window} seconds."
            )
        
        # Add current timestamp
        self.clients[client_id].append(current_time)


# Create rate limiter instances
# General API rate limiter: 100 requests per minute
api_rate_limiter = RateLimiter(requests=100, window=60)

# File upload rate limiter: 10 uploads per minute (more restrictive)
upload_rate_limiter = RateLimiter(requests=10, window=60)

# Authentication rate limiter: 5 login attempts per minute (protect against brute force)
auth_rate_limiter = RateLimiter(requests=5, window=60)
