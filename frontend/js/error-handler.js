/**
 * Global Error Handler for Letsee Frontend
 * Catches unhandled errors and provides user-friendly feedback
 */

/**
 * Initialize global error handlers
 */
function initErrorHandler() {
  // Handle uncaught errors
  window.addEventListener('error', function handleError(event) {
    const error = event.error || event;
    console.error('Uncaught error:', error);

    // Don't show alert for network errors (already handled by API layer)
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return;
    }

    // Show user-friendly error message
    showGlobalError('Something went wrong. Please try refreshing the page.');

    // Log error details for debugging (in production, send to error tracking service)
    logError(error);
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', function handleRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);

    // Show user-friendly error message
    showGlobalError('A request failed. Please try again.');

    // Log error details
    logError(event.reason);
  });

  console.log('Error handler initialized'); // eslint-disable-line no-console
}

/**
 * Show a global error message to the user
 * @param {string} message - Error message to display
 */
function showGlobalError(message) {
  // Try to use existing alert modal if available
  if (typeof showAlert === 'function') {
    showAlert('Error', message);
    return;
  }

  // Fallback: create a temporary error notification
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 16px 24px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: var(--primary-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto);
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Log error for debugging
 * In production, this could send errors to a monitoring service
 * @param {Error|Event} error - Error to log
 */
function logError(error) {
  const errorData = {
    message: error.message || String(error),
    stack: error.stack || null,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  // Log to console (in development)
  console.error('Error logged:', errorData);

  // In production, you could send to an error tracking service:
  // fetch('/api/errors', {
  //   method: 'POST',
  //   body: JSON.stringify(errorData)
  // });

  // Store recent errors in localStorage for debugging
  try {
    const errors = JSON.parse(localStorage.getItem('letsee_errors') || '[]');
    errors.push(errorData);
    // Keep only last 10 errors
    if (errors.length > 10) {errors.shift();}
    localStorage.setItem('letsee_errors', JSON.stringify(errors));
  } catch (e) { // eslint-disable-line no-unused-vars
    // Ignore localStorage errors
  }
}

/**
 * Clear logged errors from localStorage
 */
function clearErrorLog() {
  try {
    localStorage.removeItem('letsee_errors');
  } catch (error) { // eslint-disable-line no-unused-vars
    // Ignore
  }
}

/**
 * Get recent errors from localStorage
 * @returns {Array} - Array of error objects
 */
function getRecentErrors() {
  try {
    return JSON.parse(localStorage.getItem('letsee_errors') || '[]');
  } catch (error) { // eslint-disable-line no-unused-vars
    return [];
  }
}

/**
 * Report an error manually
 * @param {Error|string} error - Error to report
 * @param {string} context - Additional context about the error
 */
function reportError(error, context = '') {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  if (context) {
    errorObj.message = `${context}: ${errorObj.message}`;
  }
  console.error('Reported error:', errorObj);
  logError(errorObj);
  showGlobalError(errorObj.message);
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initErrorHandler);
} else {
  initErrorHandler();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initErrorHandler,
    showGlobalError,
    logError,
    clearErrorLog,
    getRecentErrors,
    reportError,
  };
}
