/**
 * API Client for Letsee Backend
 * Replaces PocketBase with REST API calls
 */

const API_BASE = 'http://localhost:8000/api';

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
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
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

    async create(date, shift, people) {
        return apiFetch('/schedules', {
            method: 'POST',
            body: JSON.stringify({ date, shift, people }),
        });
    },

    async update(id, shift, people) {
        return apiFetch(`/schedules/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ shift, people }),
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
        return apiFetch('/handovers', {
            method: 'POST',
            body: JSON.stringify({
                date: data.date,
                category: data.category,
                room: data.room,
                guest_name: data.guestName,
                text: data.text,
                followup: data.followup,
                promised: data.promised,
                promise_text: data.promiseText,
                attachments: data.attachments,
                timestamp: data.timestamp || new Date().toISOString(),
                added_by: data.addedBy,
                shift: data.shift,
            }),
        });
    },

    async update(id, data) {
        return apiFetch(`/handovers/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                category: data.category,
                room: data.room,
                guest_name: data.guestName,
                text: data.text,
                followup: data.followup,
                promised: data.promised,
                promise_text: data.promiseText,
                attachments: data.attachments,
                completed: data.completed,
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
        // Try to get existing setting
        try {
            await SettingsAPI.get(key);
            // Update existing
            return apiFetch(`/settings/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value }),
            });
        } catch {
            // Create new
            return apiFetch('/settings', {
                method: 'POST',
                body: JSON.stringify({ key, value }),
            });
        }
    },

    async delete(key) {
        return apiFetch(`/settings/${key}`, { method: 'DELETE' });
    },
};

// ============ Files API ============

const FilesAPI = {
    async getPresignedUploadUrl(filename, contentType) {
        return apiFetch('/files/presign-upload', {
            method: 'POST',
            body: JSON.stringify({ filename, content_type: contentType }),
        });
    },

    async getPresignedDownloadUrl(fileKey) {
        return apiFetch(`/files/presign-download/${fileKey}`, {
            method: 'POST',
        });
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
        return people.map(p => ({ name: p.name, color: p.color }));
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
                shift: schedule.shift,
                people: schedule.people,
            };
        }
        return result;
    },

    async saveSchedule(schedule) {
        for (const [date, data] of Object.entries(schedule)) {
            const existing = await SchedulesAPI.list(date);
            if (existing.length > 0) {
                await SchedulesAPI.update(existing[0].id, data.shift, data.people);
            } else {
                await SchedulesAPI.create(date, data.shift, data.people);
            }
        }
    },

    // Handovers
    async getHandoverNotes() {
        const handovers = await HandoversAPI.list();
        const result = {};
        for (const note of handovers) {
            if (!result[note.date]) result[note.date] = { notes: [], sortOrder: [] };
            result[note.date].notes.push({
                id: note.id,
                category: note.category,
                room: note.room,
                guestName: note.guest_name,
                text: note.text,
                followup: note.followup,
                promised: note.promised,
                promiseText: note.promise_text,
                dueDate: '', // Note: dueDate not in new schema, add if needed
                dueTime: '',
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

    async saveHandoverNotes(notes) {
        for (const [date, dateData] of Object.entries(notes)) {
            const notesList = Array.isArray(dateData) ? dateData : (dateData.notes || []);
            for (const note of notesList) {
                const data = {
                    date,
                    category: note.category,
                    room: note.room || '',
                    guestName: note.guestName || '',
                    text: note.text,
                    followup: note.followup || false,
                    promised: note.promised || false,
                    promiseText: note.promiseText || '',
                    attachments: note.attachments || [],
                    timestamp: new Date(note.timestamp).toISOString(),
                    completed: note.completed || false,
                    addedBy: note.addedBy || '',
                    shift: note.shift || 'A',
                };

                try {
                    await HandoversAPI.get(note.id);
                    // Update
                    await HandoversAPI.update(note.id, data);
                } catch {
                    // Create
                    await HandoversAPI.create(data);
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
    async getPresignedUploadUrl(filename, contentType) {
        return FilesAPI.getPresignedUploadUrl(filename, contentType);
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
