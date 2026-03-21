// Shared UI Utilities for Letsee Frontend

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML string
 */
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize user input by removing potentially dangerous characters
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Show an alert modal with a title and message
 * @param {string} title - The title of the alert
 * @param {string} message - The message to display
 */
function showAlert(title, message) {
  const titleEl = document.getElementById('alert-title');
  const messageEl = document.getElementById('alert-message');
  const modalEl = document.getElementById('alert-modal');

  if (titleEl) {
    titleEl.textContent = escapeHtml(title);
  }
  if (messageEl) {
    messageEl.textContent = escapeHtml(message);
  }
  if (modalEl) {
    modalEl.style.display = 'flex';
  }
}

/**
 * Close the alert modal
 */
function closeAlertModal() {
  const modalEl = document.getElementById('alert-modal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
}

/**
 * Show a confirmation modal
 * @param {string} title - The title of the confirmation
 * @param {string} message - The message to display
 * @param {Function} onConfirm - Callback function to execute on confirmation
 */
function showConfirm(title, message, onConfirm) {
  const titleEl = document.getElementById('confirm-title');
  const messageEl = document.getElementById('confirm-message');
  const modalEl = document.getElementById('confirm-modal');

  if (titleEl) {
    titleEl.textContent = escapeHtml(title);
  }
  if (messageEl) {
    messageEl.textContent = escapeHtml(message);
  }
  if (modalEl) {
    modalEl.style.display = 'flex';
  }

  window.confirmAction = onConfirm;
}

/**
 * Close the confirmation modal
 */
function closeConfirmModal() {
  const modalEl = document.getElementById('confirm-modal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
  window.confirmAction = null;
}

/**
 * Execute the confirmation action
 */
function executeConfirmAction() {
  if (window.confirmAction) {
    window.confirmAction();
  }
  closeConfirmModal();
}

/**
 * Generate a UUID v4
 * @returns {string} - Generated UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format time to HH:MM
 * @param {Date} date - Date to format
 * @returns {string} - Formatted time string
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Debounce function to limit rate of execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if element is in viewport
 * @param {Element} element - Element to check
 * @returns {boolean} - True if element is in viewport
 */
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    sanitizeInput,
    showAlert,
    closeAlertModal,
    showConfirm,
    closeConfirmModal,
    executeConfirmAction,
    generateUUID,
    formatDate,
    formatTime,
    debounce,
    isInViewport,
  };
}
