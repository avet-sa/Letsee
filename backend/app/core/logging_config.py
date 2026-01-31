import logging
import logging.handlers
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "status_code"):
            log_data["status_code"] = record.status_code
        
        return json.dumps(log_data)


class SimpleFormatter(logging.Formatter):
    """Simple text formatter for console output."""
    
    COLORS = {
        "DEBUG": "\033[36m",      # Cyan
        "INFO": "\033[32m",       # Green
        "WARNING": "\033[33m",    # Yellow
        "ERROR": "\033[31m",      # Red
        "CRITICAL": "\033[35m",   # Magenta
        "RESET": "\033[0m",       # Reset
    }
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with optional color."""
        color = self.COLORS.get(record.levelname, self.COLORS["RESET"])
        reset = self.COLORS["RESET"]
        
        # Build base message
        message = f"{color}{record.levelname:8}{reset} [{record.name}] {record.getMessage()}"
        
        # Add exception info if present
        if record.exc_info:
            message += f"\n{self.formatException(record.exc_info)}"
        
        return message


def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    json_format: bool = False,
    console_output: bool = True,
) -> None:
    """
    Configure application-wide logging.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path for file logging
        json_format: Use JSON format for logs (for production/aggregation)
        console_output: Enable console output
    """
    # Convert string log level to logging constant
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)  # Capture all, filter at handler level
    
    # Remove any existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    if console_output:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        
        # Use JSON or simple formatter
        if json_format:
            console_handler.setFormatter(JSONFormatter())
        else:
            console_handler.setFormatter(SimpleFormatter())
        
        root_logger.addHandler(console_handler)
    
    # File handler with rotation
    if log_file:
        log_dir = Path(log_file).parent
        log_dir.mkdir(parents=True, exist_ok=True)
        
        # Use rotating file handler (10MB per file, keep 10 backups)
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=10,
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(JSONFormatter())  # Always JSON for file
        root_logger.addHandler(file_handler)


def get_logger(name: str) -> logging.LoggerAdapter:
    """
    Get a logger instance with context support.
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        LoggerAdapter with context support
    """
    logger = logging.getLogger(name)
    return logging.LoggerAdapter(logger, {})


def set_request_context(logger: logging.LoggerAdapter, request_id: str, user_id: Optional[str] = None) -> None:
    """
    Set request context for correlation logging.
    
    Args:
        logger: LoggerAdapter instance
        request_id: Unique request ID
        user_id: Optional user ID
    """
    if logger.extra is None:
        logger.extra = {}
    logger.extra["request_id"] = request_id
    if user_id:
        logger.extra["user_id"] = user_id


def clear_request_context(logger: logging.LoggerAdapter) -> None:
    """Clear request context."""
    if logger.extra is None:
        logger.extra = {}
    logger.extra.pop("request_id", None)
    logger.extra.pop("user_id", None)
