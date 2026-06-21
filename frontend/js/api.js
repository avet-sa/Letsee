/**
 * API Client for Letsee Backend
 * Replaces PocketBase with REST API calls
 */

const API_BASE = (() => {
  const { protocol, hostname, port } = window.location;

  // Native frontend dev server: static files on :3000, FastAPI on :8000.
  if (port === '3000') {
    return `${protocol}//${hostname}:8000/api`;
  }

  return '/api';
})();

/** Calendar date in local timezone (matches handover note `date` field). */
function toLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// UUID v4 generator for creating note IDs
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Token management
const TOKEN_KEY = 'letsee_access_token';
const REFRESH_TOKEN_KEY = 'letsee_refresh_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(accessToken, refreshToken) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Fetch helper with auth
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired, clear and redirect to login
      clearTokens();
      window.location.href = '/login.html';
      return null;
    }

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204 || response.status === 205) {
      return null;
    }

    const responseText = await response.text();
    if (!responseText) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return JSON.parse(responseText);
    }

    return responseText;
  } catch (error) {
    console.error('API Fetch Error:', { url, error: error.message });
    throw error;
  }
}

// ============ Auth API ============

const AuthAPI = {
  async register(payload) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data) {
      setToken(data.access_token, data.refresh_token);
    }
    return data;
  },

  async getCurrentUser() {
    return apiFetch('/auth/me');
  },

  async logout() {
    try {
      if (getToken()) {
        await apiFetch('/auth/logout', { method: 'POST' });
      }
    } finally {
      clearTokens();
    }
  },

  async changePassword(currentPassword, newPassword) {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },
};

// ============ Users API (Staff Management) ============

const UsersAPI = {
  async list() {
    return apiFetch('/users');
  },

  async get(id) {
    return apiFetch(`/users/${id}`);
  },

  async create(userData) {
    return apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async update(id, userData) {
    return apiFetch(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  async delete(id) {
    return apiFetch(`/users/${id}`, { method: 'DELETE' });
  },

  async resetPassword(id, newPassword) {
    return apiFetch(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    });
  },

  // Positions
  async getPositions() {
    return apiFetch('/users/positions');
  },

  async createPosition(name) {
    return apiFetch('/users/positions', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    });
  },

  async deletePosition(id) {
    return apiFetch(`/users/positions/${id}`, { method: 'DELETE' });
  },
};

// ============ Schedules API ============

const SchedulesAPI = {
  async list(date = null, fromDate = null, toDate = null) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch(`/schedules${query}`);
  },

  async get(id) {
    return apiFetch(`/schedules/${id}`);
  },

  async create(date, data) {
    return apiFetch('/schedules', {
      method: 'POST',
      body: JSON.stringify({ date, shifts: data.shifts }),
    });
  },

  async update(date, data) {
    return apiFetch(`/schedules/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ shifts: data.shifts }),
    });
  },

  async delete(id) {
    return apiFetch(`/schedules/${id}`, { method: 'DELETE' });
  },
};

// ============ Handovers API ============

const HandoversAPI = {
  async list(date = null) {
    const query = date ? `?date=${date}` : '';
    return apiFetch(`/handovers${query}`);
  },

  async get(id) {
    return apiFetch(`/handovers/${id}`);
  },

  async create(data) {
    const payload = {
      date: data.date,
      category: data.category,
      room: data.room || '',
      guest_name: data.guestName || '',
      text: data.text,
      followup: data.followup,
      promised: data.promised,
      promise_text: data.promiseText || '',
      attachments: data.attachments,
      timestamp: data.timestamp || new Date().toISOString(),
      added_by: data.addedBy,
      shift: data.shift,
      due_date: data.due_date || null,
      due_time: data.due_time || null,
    };
    return apiFetch('/handovers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(id, data) {
    return apiFetch(`/handovers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        category: data.category,
        room: data.room || '',
        guest_name: data.guest_name || data.guestName || '',
        text: data.text,
        followup: data.followup,
        promised: data.promised,
        promise_text: data.promise_text || data.promiseText || '',
        attachments: data.attachments,
        completed: data.completed,
        due_date: data.due_date || data.dueDate || null,
        due_time: data.due_time || data.dueTime || null,
      }),
    });
  },

  async delete(id) {
    return apiFetch(`/handovers/${id}`, { method: 'DELETE' });
  },
};

// ============ Settings API ============

const SettingsAPI = {
  async list() {
    return apiFetch('/settings');
  },

  async get(key) {
    return apiFetch(`/settings/${key}`);
  },

  async set(key, value) {
    // Try to update existing setting first, create if it doesn't exist
    try {
      const existing = await this.get(key);
      // Update existing
      return await apiFetch(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
    } catch (error) {
      // If 404, create new
      if (error.message.includes('404') || error.message.includes('not found')) {
        return await apiFetch('/settings', {
          method: 'POST',
          body: JSON.stringify({ key, value }),
        });
      }
      // Re-throw other errors
      throw error;
    }
  },

  async delete(key) {
    return apiFetch(`/settings/${key}`, { method: 'DELETE' });
  },
};

// ============ Files API ============

const FilesAPI = {
  async uploadFile(file) {
    /**
     * Upload a file to Minio via backend.
     * @param {File} file - The file object to upload
     * @returns {Promise<{file_key, filename, size, content_type}>}
     */
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      clearTokens();
      window.location.href = '/login.html';
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'File upload failed');
    }

    return response.json();
  },

  async downloadFile(fileKey) {
    /**
     * Download a file from Minio.
     * @param {string} fileKey - The file key to download
     */
    const token = getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/files/download/${encodeURIComponent(fileKey)}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('File download failed');
    }

    return response.blob();
  },

  async deleteFile(fileKey) {
    /**
     * Delete a file from Minio.
     * @param {string} fileKey - The file key to delete
     */
    return apiFetch(`/files/delete/${encodeURIComponent(fileKey)}`, {
      method: 'DELETE',
    });
  },

  getDownloadUrl(fileKey) {
    /**
     * Get direct download URL for a file (for HTML links).
     * @param {string} fileKey - The file key
     * @returns {string} Direct download URL
     */
    return `${API_BASE}/files/download/${encodeURIComponent(fileKey)}`;
  },
};

// ============ Legacy DB wrapper (for compatibility) ============

const DB = {
  // Auth
  async login(email, password) {
    return AuthAPI.login(email, password);
  },

  async logout() {
    return AuthAPI.logout();
  },

  async getCurrentUser() {
    return AuthAPI.getCurrentUser();
  },

  // Users (Staff Management)
  async getUsers() {
    const users = await UsersAPI.list();
    // Ensure we always return an array
    if (!Array.isArray(users)) {
      console.warn('UsersAPI.list() returned non-array:', users);
      return [];
    }
    // Map to consistent format: id, name, color + position support
    return users.map((u) => ({
      id: u.id,
      name: u.full_name || (u.email ? u.email.split('@')[0] : 'Staff'),
      color: u.color,
      email: u.email,
      isActive: u.is_active,
      isAdmin: u.is_admin,
      position: u.position || null,
      position_id: u.position_id || null,
    }));
  },

  async updateUser(id, userData) {
    // userData: { full_name, color, is_active }
    return UsersAPI.update(id, userData);
  },

  async createUser(userData) {
    // userData: { email, password, full_name, color, is_admin }
    return UsersAPI.create(userData);
  },

  async deleteUser(id) {
    return UsersAPI.delete(id);
  },

  async changeMyPassword(currentPassword, newPassword) {
    return AuthAPI.changePassword(currentPassword, newPassword);
  },

  async resetUserPassword(id, newPassword) {
    return UsersAPI.resetPassword(id, newPassword);
  },

  // Positions
  async getPositions() {
    return UsersAPI.getPositions();
  },

  async createPosition(name) {
    return UsersAPI.createPosition(name);
  },

  async deletePosition(id) {
    return UsersAPI.deletePosition(id);
  },

  // Schedule
  async getSchedule(fromDate = null, toDate = null) {
    const schedules = await SchedulesAPI.list(null, fromDate, toDate);
    const result = {};
    for (const schedule of schedules) {
      result[schedule.date] = {
        shifts: schedule.shifts || { A: [], M: [], B: [], C: [] },
        edited_by: schedule.edited_by,
        edited_at: schedule.edited_at,
      };
    }
    return result;
  },

  async saveSchedule(schedule) {
    for (const [date, data] of Object.entries(schedule)) {
      const payload = {
        shifts: data.shifts || { A: [], M: [], B: [], C: [] },
      };
      await SchedulesAPI.update(date, payload);
    }
  },

  // Handovers
  async getHandoverNotes() {
    const handovers = await HandoversAPI.list();
    const result = {};
    for (const note of handovers) {
      if (!result[note.date]) {
        result[note.date] = { notes: [], sortOrder: [] };
      }
      result[note.date].notes.push({
        id: note.id,
        category: note.category,
        room: note.room,
        guestName: note.guest_name,
        text: note.text,
        followup: note.followup,
        promised: note.promised,
        promiseText: note.promise_text,
        dueDate: note.due_date || '',
        dueTime: note.due_time || '',
        attachments: note.attachments,
        timestamp: new Date(note.timestamp).getTime(),
        completed: note.completed,
        addedBy: note.added_by,
        shift: note.shift,
        editedAt: note.edited_at ? new Date(note.edited_at).getTime() : null,
        editedBy: note.edited_by,
      });
      result[note.date].sortOrder.push(note.id);
    }
    return result;
  },

  // ============ Handovers API Wrapper ============
  async saveHandoverNotes(notes) {
    for (const [date, dateData] of Object.entries(notes)) {
      const notesList = Array.isArray(dateData) ? dateData : dateData.notes || [];
      const currentIds = new Set(notesList.map((n) => String(n.id)).filter(Boolean));

      // 1. Handle soft deletes (notes removed from frontend)
      let existingNotes = [];
      try {
        existingNotes = await HandoversAPI.list(date);
      } catch (e) {
        console.warn(`Could not fetch existing notes for ${date}`, e);
      }

      const existingIds = new Set(existingNotes.map((n) => String(n.id)));

      for (const existingId of existingIds) {
        if (!currentIds.has(existingId)) {
          try {
            await HandoversAPI.delete(existingId);
            console.log(`Soft-deleted note: ${existingId}`);
          } catch (err) {
            console.error(`Failed to soft-delete note ${existingId}`, err);
          }
        }
      }

      // 2. Save / Create notes
      for (const note of notesList) {
        if (!note.text?.trim()) {
          continue;
        }

        const timestampStr = new Date(note.timestamp || Date.now()).toISOString();

        const payload = {
          date: date,
          category: note.category || 'info',
          room: note.room || '',
          guest_name: note.guestName || '',
          text: note.text,
          followup: Boolean(note.followup),
          promised: Boolean(note.promised),
          promise_text: note.promiseText || '',
          attachments: note.attachments || [],
          timestamp: timestampStr,
          completed: Boolean(note.completed),
          added_by: note.addedBy || '',
          shift: note.shift || 'A',
          due_date: note.dueDate || null,
          due_time: note.dueTime || null,
        };

        // Decide create vs update using the list we fetched for this date.
        // New notes get a client-generated UUID (for local tracking only) that
        // will not be present in the server list → create.
        // Existing notes loaded from server will be present → update.
        // This avoids 404s from attempting UPDATE on a brand-new client id.
        const noteIdStr = note.id ? String(note.id) : null;
        const isNewNote = !noteIdStr || !existingIds.has(noteIdStr);

        try {
          if (isNewNote) {
            // NEW NOTE → use CREATE (client id is temporary, server will assign real UUID)
            const created = await HandoversAPI.create(payload);
            console.log(`✅ Created new note on ${date}`);
          } else {
            // EXISTING NOTE (id came from prior server list) → use UPDATE
            await HandoversAPI.update(note.id, payload);
            console.log(`✅ Updated note ${note.id}`);
          }
        } catch (error) {
          // Only log real failures; normal new-note routing should not error now
          console.error(`Failed to save note ${note.id || 'new'}`, error);

          if (isNewNote || String(error.message).toLowerCase().includes('not found')) {
            try {
              await HandoversAPI.create(payload);
              console.log(`✅ Fallback create succeeded for note on ${date}`);
            } catch (fallbackErr) {
              console.error(`Complete failure saving note on ${date}`, fallbackErr);
            }
          }
        }
      }
    }
  },

  // Settings
  async getSetting(key) {
    try {
      const setting = await SettingsAPI.get(key);
      return setting.value;
    } catch {
      return null;
    }
  },

  async saveSetting(key, value) {
    return SettingsAPI.set(key, value);
  },

  async updateMyTheme(theme) {
    return apiFetch('/auth/me/theme', {
      method: 'PUT',
      body: JSON.stringify({ theme }),
    });
  },

  // Files
  async uploadFile(file) {
    return FilesAPI.uploadFile(file);
  },

  async downloadFile(fileKey) {
    return FilesAPI.downloadFile(fileKey);
  },

  async deleteFile(fileKey) {
    return FilesAPI.deleteFile(fileKey);
  },

  getDownloadUrl(fileKey) {
    return FilesAPI.getDownloadUrl(fileKey);
  },

  // Init (no-op for compatibility)
  async init() {
    // Migrations and schema setup handled by backend
    // Check if user is authenticated
    const token = getToken();
    if (!token) {
      // Redirect to login
      window.location.href = '/login.html';
    }
  },
};

// Make DB available globally for browser scripts
window.DB = DB;
window.API_BASE = API_BASE;
window.toLocalDateKey = toLocalDateKey;

window.openChangePasswordModal = function openChangePasswordModal() {
  const modal = document.getElementById('password-modal');
  if (!modal) return;

  modal.style.display = 'flex';

  // Clear fields
  const currentEl = document.getElementById('current-password');
  const newEl = document.getElementById('new-password');
  const confirmEl = document.getElementById('confirm-password');
  const errEl = document.getElementById('password-error');

  if (currentEl) currentEl.value = '';
  if (newEl) newEl.value = '';
  if (confirmEl) confirmEl.value = '';
  if (errEl) errEl.style.display = 'none';
};

window.closeChangePasswordModal = function closeChangePasswordModal() {
  const modal = document.getElementById('password-modal');
  if (modal) modal.style.display = 'none';
};

window.submitChangePassword = async function submitChangePassword() {
  const current = document.getElementById('current-password')?.value || '';
  const newPass = document.getElementById('new-password')?.value || '';
  const confirm = document.getElementById('confirm-password')?.value || '';
  const errEl = document.getElementById('password-error');

  if (errEl) errEl.style.display = 'none';

  if (!current || !newPass || !confirm) {
    if (errEl) {
      errEl.textContent = 'All fields are required.';
      errEl.style.display = 'block';
    }
    return;
  }

  if (newPass.length < 8) {
    if (errEl) {
      errEl.textContent = 'New password must be at least 8 characters.';
      errEl.style.display = 'block';
    }
    return;
  }

  if (newPass !== confirm) {
    if (errEl) {
      errEl.textContent = 'New passwords do not match.';
      errEl.style.display = 'block';
    }
    return;
  }

  if (newPass === current) {
    if (errEl) {
      errEl.textContent = 'New password cannot be the same as your current password.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    await DB.changeMyPassword(current, newPass);
    closeChangePasswordModal();
    if (typeof showAlert === 'function') {
      showAlert('Success', 'Password changed successfully. You may need to log in again on other devices.');
    } else {
      alert('Password changed successfully.');
    }
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message || 'Failed to change password. Check your current password.';
      errEl.style.display = 'block';
    }
  }
};

// For backward compatibility with onclick="changeMyPassword()"
window.changeMyPassword = window.openChangePasswordModal;
