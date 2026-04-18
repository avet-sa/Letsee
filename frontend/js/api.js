/**
 * API Client for Letsee Backend
 * Replaces PocketBase with REST API calls
 */

const API_BASE = (() => {
  const { protocol, hostname, port } = window.location;

  // Native frontend dev server: static files on :3000, FastAPI on :8000.
  if (hostname === 'localhost' && port === '3000') {
    return `${protocol}//${hostname}:8000/api`;
  }

  return '/api';
})();

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
  async register(email, password, fullName) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
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

  logout() {
    clearTokens();
  },
};

// ============ People API ============

const PeopleAPI = {
  async list() {
    return apiFetch('/people');
  },

  async get(id) {
    return apiFetch(`/people/${id}`);
  },

  async create(name, color) {
    return apiFetch('/people', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
  },

  async update(id, name, color) {
    return apiFetch(`/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, color }),
    });
  },

  async delete(id) {
    return apiFetch(`/people/${id}`, { method: 'DELETE' });
  },
};

// ============ Schedules API ============

const SchedulesAPI = {
  async list(date = null) {
    const query = date ? `?date=${date}` : '';
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
    AuthAPI.logout();
  },

  async getCurrentUser() {
    return AuthAPI.getCurrentUser();
  },

  // People
  async getPeople() {
    const people = await PeopleAPI.list();
    // Ensure we always return an array
    if (!Array.isArray(people)) {
      console.warn('PeopleAPI.list() returned non-array:', people);
      return [];
    }
    return people.map((p) => ({ id: p.id, name: p.name, color: p.color }));
  },

  async updatePerson(id, name, color, previousName = null) {
    const updatedPerson = await PeopleAPI.update(id, name, color);

    if (previousName && previousName !== name) {
      const existingSchedules = await DB.getSchedule();
      const schedulesToUpdate = {};

      Object.entries(existingSchedules).forEach(([date, schedule]) => {
        if (!schedule?.shifts) {
          return;
        }

        let changed = false;
        const updatedShifts = {};

        ['A', 'M', 'B', 'C'].forEach((shift) => {
          const originalPeople = schedule.shifts[shift] || [];
          const renamedPeople = [
            ...new Set(
              originalPeople.map((personName) => {
                if (personName === previousName) {
                  changed = true;
                  return name;
                }

                return personName;
              })
            ),
          ];

          updatedShifts[shift] = renamedPeople;
        });

        if (changed) {
          schedulesToUpdate[date] = { shifts: updatedShifts };
        }
      });

      if (Object.keys(schedulesToUpdate).length > 0) {
        await DB.saveSchedule(schedulesToUpdate);
      }
    }

    return updatedPerson;
  },

  async savePeople(people) {
    // Delete all and recreate (simple approach)
    const existing = await PeopleAPI.list();
    for (const person of existing) {
      await PeopleAPI.delete(person.id);
    }
    for (const person of people) {
      await PeopleAPI.create(person.name, person.color);
    }
  },

  // Schedule
  async getSchedule() {
    const schedules = await SchedulesAPI.list();
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

      const existing = await SchedulesAPI.list(date);
      if (existing.length > 0) {
        await SchedulesAPI.update(date, payload);
      } else {
        await SchedulesAPI.create(date, payload);
      }
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
        if (!note.text?.trim()) continue;

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

        // Decide if it's a new note or existing
        const isNewNote =
          !note.id ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            String(note.id)
          );

        try {
          if (isNewNote) {
            // NEW NOTE → always use CREATE
            const created = await HandoversAPI.create(payload);
            console.log(`✅ Created new note on ${date}`);
          } else {
            // EXISTING NOTE → use UPDATE
            await HandoversAPI.update(note.id, payload);
            console.log(`✅ Updated note ${note.id}`);
          }
        } catch (error) {
          console.error(`Failed to save note ${note.id || 'new'}`, error);

          // Last resort fallback
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
