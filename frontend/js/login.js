// Login page functionality

const STORAGE_KEY_THEME = 'letsee_theme';

function toggleMode() {
    document.getElementById('login-form').classList.toggle('active');
    document.getElementById('register-form').classList.toggle('active');
    clearErrors();
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
    document.querySelectorAll('.success-message').forEach(el => {
        el.classList.remove('show');
    });
}

async function handleLogin(event) {
    event.preventDefault();
    clearErrors();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const loading = document.getElementById('login-loading');
    const errorEl = document.getElementById('login-error');

    btn.disabled = true;
    loading.classList.add('show');

    try {
        const loginPayload = { email, password };
        
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginPayload)
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
        errorEl.textContent = error.message;
        errorEl.classList.add('show');
        btn.disabled = false;
        loading.classList.remove('show');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    clearErrors();

    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const btn = document.getElementById('register-btn');
    const loading = document.getElementById('register-loading');
    const successEl = document.getElementById('register-success');
    const errorEl = document.getElementById('register-error');

    // Validate passwords match
    if (password !== confirm) {
        document.getElementById('register-confirm-error').textContent = 'Passwords do not match';
        document.getElementById('register-confirm-error').classList.add('show');
        return;
    }

    btn.disabled = true;
    loading.classList.add('show');

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                full_name: name
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Registration failed');
        }

        // Now login with the new account
        successEl.classList.add('show');
        setTimeout(() => {
            performLogin(email, password);
        }, 1500);
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('show');
        btn.disabled = false;
        loading.classList.remove('show');
    }
}

// Helper function to perform login without requiring a form event
async function performLogin(email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        // Save tokens
        localStorage.setItem('letsee_access_token', data.access_token);
        localStorage.setItem('letsee_refresh_token', data.refresh_token);

        // Redirect to main app
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Auto-login after registration failed:', error.message);
        // Fall back to manual login
        setTimeout(() => {
            showAlert('Account Created', 'Account created! Please log in with your credentials.');
            location.reload();
        }, 1000);
    }
}

// Ensure user is not already logged in
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('letsee_access_token');
    if (token) {
        window.location.href = '/index.html';
    }
    
    // Load saved theme
    loadTheme();
});

// Alert Modal Functions
function showAlert(title, message) {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-modal').style.display = 'flex';
}

function closeAlertModal() {
    document.getElementById('alert-modal').style.display = 'none';
}

// Theme toggle
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEY_THEME, newTheme);
    updateThemeIcon(newTheme);
}

// Update theme icon
function updateThemeIcon(theme) {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        if (theme === 'dark') {
            themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        } else {
            themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
        }
    }
    
    // Update favicon color
    const favicon = document.getElementById('favicon');
    if (favicon) {
        const color = theme === 'dark' ? '%23eee' : '%23333';
        favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='${color}'>L</text></svg>`;
    }
}

// Load theme on startup
function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}