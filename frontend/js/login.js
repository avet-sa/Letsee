// Login page functionality

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
        console.log('Login payload:', loginPayload);
        
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginPayload)
        });

        const data = await response.json();
        console.log('Login response:', response.status, data);

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
            alert('Account created! Please log in with your credentials.');
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
    const savedTheme = localStorage.getItem('letsee_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
});

// Theme toggle
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('letsee_theme', newTheme);
}
