/**
 * Login page functionality for Letsee Frontend
 */

const STORAGE_KEY_THEME = 'letsee_theme';

/**
 * Clear all error and success messages
 */
function clearErrors() {
  document.querySelectorAll('.error-message').forEach((el) => {
    el.classList.remove('show');
    el.textContent = '';
  });
  document.querySelectorAll('.success-message').forEach((el) => {
    el.classList.remove('show');
  });
}

/**
 * Sanitize email input
 * @param {string} value - Email to sanitize
 * @returns {string} - Sanitized email
 */
function sanitizeEmail(value) {
  const v = (value || '').trim();
  return v.replace(/[\s<>"'`]/g, '');
}

/**
 * Sanitize password (trim only)
 * @param {string} value - Password to sanitize
 * @returns {string} - Sanitized password
 */
function sanitizePassword(value) {
  return (value || '').trim();
}

/**
 * Validate email format
 * @param {string} value - Email to validate
 * @returns {boolean} - True if valid email
 */
function isValidEmail(value) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

/**
 * Check if password meets minimum requirements
 * @param {string} value - Password to check
 * @returns {boolean} - True if password is strong enough
 */
function isStrongEnoughPassword(value) {
  return typeof value === 'string' && value.length >= 8;
}

/**
 * Handle login form submission
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
  event.preventDefault();
  clearErrors();

  const emailInput = document.getElementById('login-email')?.value || '';
  const passwordInput = document.getElementById('login-password')?.value || '';
  const email = sanitizeEmail(emailInput);
  const password = sanitizePassword(passwordInput);
  const btn = document.getElementById('login-btn');
  const loading = document.getElementById('login-loading');
  const errorEl = document.getElementById('login-error');

  if (btn) {
    btn.disabled = true;
  }
  if (loading) {
    loading.classList.add('show');
  }

  try {
    if (!isValidEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!isStrongEnoughPassword(password)) {
      throw new Error('Password must be at least 8 characters.');
    }

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.detail || data.message || 'Login failed';
      throw new Error(errorMsg);
    }

    // Save tokens
    localStorage.setItem('letsee_access_token', data.access_token);
    localStorage.setItem('letsee_refresh_token', data.refresh_token);

    // Redirect to main app
    window.location.href = '/index.html';
  } catch (error) {
    console.error('Login error:', error);
    if (errorEl) {
      errorEl.textContent = error.message;
      errorEl.classList.add('show');
    }
    if (btn) {
      btn.disabled = false;
    }
    if (loading) {
      loading.classList.remove('show');
    }
  }
}

/**
 * Initialize login page on DOM ready
 */
window.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  const token = localStorage.getItem('letsee_access_token');
  if (token) {
    window.location.href = '/index.html';
  }

  // Load saved theme
  loadTheme();
});

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEY_THEME, newTheme);
  updateThemeIcon(newTheme);
}

/**
 * Update theme toggle button icon
 * @param {string} theme - Current theme ('light' or 'dark')
 */
function updateThemeIcon(theme) {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (!themeBtn) {
    return;
  }

  if (theme === 'dark') {
    themeBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  } else {
    themeBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }

  // Update favicon color
  const favicon = document.getElementById('favicon');
  if (favicon) {
    const color = theme === 'dark' ? '%23eee' : '%23333';
    favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='${color}'>L</text></svg>`;
  }
}

/**
 * Load saved theme from localStorage
 */
function loadTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clearErrors,
    sanitizeEmail,
    sanitizePassword,
    isValidEmail,
    isStrongEnoughPassword,
    handleLogin,
    toggleTheme,
    updateThemeIcon,
    loadTheme,
  };
}
