// Storage keys
const STORAGE_KEY_PEOPLE = 'letsee_people';
const STORAGE_KEY_SCHEDULE = 'letsee_schedule';
const STORAGE_KEY_HANDOVER = 'letsee_handover';
const STORAGE_KEY_THEME = 'letsee_theme';

let searchQuery = '';
window.searchQuery = searchQuery;
let currentSort = 'newest';
let currentFilter = 'all';
// Quick filter and selection state
let currentQuickFilter = '';
const selectedNotes = new Set();
const DRAFT_KEY = 'letsee_note_draft';
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DRAFT_SCHEMA_VERSION = 1;
const STAFF_COLOR_PRESETS = [
  '#3498db',
  '#e74c3c',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#f1c40f',
  '#e84393',
];
const DEFAULT_PERSON_COLOR = STAFF_COLOR_PRESETS[0];
let editingPersonId = null;
let editingPersonOriginalName = '';
let currentUser = null;

// Cache for render performance
let cachedDateData = null;
let cachedDateKey = null;
let cachedSchedule = null;
let cachedShiftPeople = null;

function initPersonColorPicker() {
  const picker = document.getElementById('new-person-color-picker');
  const colorInput = document.getElementById('new-person-color');

  if (!picker || !colorInput) {
    return;
  }

  const selectedColor = colorInput.value || DEFAULT_PERSON_COLOR;
  colorInput.value = selectedColor;

  picker.innerHTML = STAFF_COLOR_PRESETS.map(
    (color) => `
        <button
            type="button"
            class="color-swatch${color.toLowerCase() === selectedColor.toLowerCase() ? ' is-selected' : ''}"
            style="--swatch-color: ${color}"
            data-color="${color}"
            onclick="selectPersonColor('${color}')"
            aria-label="Select ${color}"
            aria-pressed="${color.toLowerCase() === selectedColor.toLowerCase()}">
        </button>
    `
  ).join('');
}

function selectPersonColor(color) {
  const colorInput = document.getElementById('new-person-color');
  if (!colorInput) {
    return;
  }

  colorInput.value = color;
  document.querySelectorAll('#new-person-color-picker .color-swatch').forEach((swatch) => {
    const isSelected = swatch.dataset.color.toLowerCase() === color.toLowerCase();
    swatch.classList.toggle('is-selected', isSelected);
    swatch.setAttribute('aria-pressed', String(isSelected));
  });
}

function resetPersonForm() {
  editingPersonId = null;
  editingPersonOriginalName = '';

  const nameInput = document.getElementById('new-person-name');
  const titleEl = document.getElementById('person-form-title');
  const saveBtn = document.getElementById('save-person-btn');
  const cancelBtn = document.getElementById('cancel-person-edit');
  const posSel = document.getElementById('new-person-position');
  if (nameInput) nameInput.value = '';
  if (titleEl) titleEl.textContent = 'Add New Staff Member';
  if (saveBtn) saveBtn.textContent = '+ Add Staff';
  if (cancelBtn) cancelBtn.style.display = 'none';
  const posText = document.getElementById('position-selected-text');
  const posHid = document.getElementById('new-person-position-id');
  if (posText) posText.textContent = '— No position —';
  if (posHid) posHid.value = '';
  const adminHidden = document.getElementById('new-person-is-admin');
  const adminBtn = document.getElementById('admin-toggle-btn');
  if (adminHidden) adminHidden.value = 'false';
  if (adminBtn) adminBtn.textContent = 'Make Admin';

  initPersonColorPicker();
  selectPersonColor(DEFAULT_PERSON_COLOR);
}

/**
 * Toggle admin status from the form button.
 */
function toggleFormAdmin() {
  const hidden = document.getElementById('new-person-is-admin');
  const btn = document.getElementById('admin-toggle-btn');
  if (!hidden || !btn) return;

  const isCurrentlyAdmin = hidden.value === 'true';
  const newState = !isCurrentlyAdmin;
  hidden.value = newState ? 'true' : 'false';
  btn.textContent = newState ? 'Remove Admin' : 'Make Admin';
}

function selectPosition(id, name) {
  const hidden = document.getElementById('new-person-position-id');
  const textEl = document.getElementById('position-selected-text');
  if (hidden) hidden.value = id;
  if (textEl) textEl.textContent = name || '— No position —';
}

function togglePositionDropdown() {
  const dd = document.getElementById('position-dropdown');
  const search = document.getElementById('position-search');
  if (!dd) return;
  const isOpen = dd.style.display === 'block' || dd.style.display === 'flex';
  dd.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen && search) {
    populatePositionOptions();
    search.value = '';
    filterPositionDropdown();
    setTimeout(() => search.focus(), 10);
  }
}

function filterPositionDropdown() {
  const search = document.getElementById('position-search');
  const container = document.getElementById('position-options');
  if (!search || !container) return;
  const q = search.value.toLowerCase().trim();
  Array.from(container.children).forEach((opt) => {
    const matches = !q || opt.textContent.toLowerCase().includes(q);
    opt.style.display = matches ? '' : 'none';
  });
}

function populatePositionOptions() {
  const container = document.getElementById('position-options');
  if (!container) return;
  container.innerHTML = '';

  (window._positionsCache || []).forEach((p) => {
    const opt = document.createElement('div');
    opt.className = 'position-option';
    opt.textContent = p.name;
    opt.onclick = () => {
      selectPosition(p.id, p.name);
      const dd = document.getElementById('position-dropdown');
      if (dd) dd.style.display = 'none';
    };
    container.appendChild(opt);
  });
}

/**
 * Toggle a user's active status directly from the list.
 */
async function toggleUserActive(id, currentActive, name) {
  const newActive = !currentActive;
  const action = newActive ? 'activate' : 'deactivate';
  try {
    await DB.updateUser(id, { is_active: newActive });
    await refreshPeopleViews();
    showAlert('Success', `Staff member "${name}" ${action}d`);
  } catch (error) {
    console.error('Error toggling active:', error);
    showAlert('Error', error.message || `Failed to ${action} staff member.`);
  }
}



async function startPersonEdit(id) {
  const people = await getUsers();
  const person = people.find((candidate) => String(candidate.id) === String(id));
  if (!person) {
    return;
  }

  editingPersonId = String(person.id);
  editingPersonOriginalName = person.name;

  document.getElementById('person-form-title').textContent = 'Edit Staff Member';
  document.getElementById('save-person-btn').textContent = 'Save';
  document.getElementById('cancel-person-edit').style.display = 'inline-flex';
  document.getElementById('new-person-name').value = person.name;

  if (!window._positionsCache || window._positionsCache.length === 0) {
    await loadPositions();
  }
  if (typeof populatePositionOptions === 'function') populatePositionOptions();
  if (person.position_id && person.position) {
    if (typeof selectPosition === 'function') selectPosition(person.position_id, person.position);
  } else {
    const textEl = document.getElementById('position-selected-text');
    if (textEl) textEl.textContent = '— No position —';
    const hid = document.getElementById('new-person-position-id');
    if (hid) hid.value = '';
  }

  initPersonColorPicker();
  selectPersonColor(person.color);

  const adminHidden = document.getElementById('new-person-is-admin');
  const adminBtn = document.getElementById('admin-toggle-btn');
  const isAdmin = !!person.isAdmin;
  if (adminHidden) adminHidden.value = isAdmin ? 'true' : 'false';
  if (adminBtn) adminBtn.textContent = isAdmin ? 'Remove Admin' : 'Make Admin';

  document.getElementById('new-person-name').focus();
}

function cancelPersonEdit() {
  resetPersonForm();
}

async function refreshPeopleViews() {
  await _refreshPeopleCache();
  await updatePeopleBlock();
  await renderHandoverNotes(true);
  await renderPeopleList();
}

// Initialize database on load
let dbInitialized = false;
async function ensureDB() {
  if (!dbInitialized) {
    await DB.init();
    dbInitialized = true;
  }
}

async function loadCurrentUser() {
  try {
    currentUser = await DB.getCurrentUser();
  } catch (error) {
    console.error('Error loading current user:', error);
    currentUser = null;
  }
}

function applyRoleUI() {
  const manageStaffBtn = document.getElementById('manage-staff-btn');
  const manageScheduleLink = document.getElementById('manage-schedule-link');
  const isAdmin = Boolean(currentUser?.is_admin);

  if (manageStaffBtn) {
    manageStaffBtn.style.display = isAdmin ? '' : 'none';
  }

  if (manageScheduleLink) {
    manageScheduleLink.style.display = isAdmin ? '' : 'none';
  }
}

// Open native date/time picker when clicking custom icon wrapper
function openPicker(inputId) {
  const el = document.getElementById(inputId);
  if (!el) {
    return;
  }
  if (typeof el.showPicker === 'function') {
    el.showPicker();
  } else {
    el.focus();
    el.click();
  }
}

// Logout function
function handleLogout() {
  showConfirm('Sign Out', 'Are you sure you want to sign out?', async () => {
    try {
      if (typeof window.stopDataPolling === 'function') window.stopDataPolling();
      await DB.logout();
    } catch (error) {
      console.warn('Server logout failed; clearing local session anyway.', error);
    } finally {
      window.location.href = '/login.html';
    }
  });
}

// Shift colors
const SHIFT_COLORS = {
  A: 'rgba(255, 200, 100, 0.5)', // Morning - warm yellow
  M: 'rgba(150, 200, 255, 0.5)', // Middle - sky blue
  B: 'rgba(255, 150, 150, 0.5)', // Afternoon - soft red
  C: 'rgba(150, 150, 200, 0.5)', // Night - dark blue
};
const SHIFT_ORDER = ['A', 'M', 'B', 'C'];

let currentEditingNoteId = null;

function getShiftEntries(daySchedule) {
  return daySchedule?.shifts || { A: [], M: [], B: [], C: [] };
}

function getCurrentShiftCode(date = currentDate, daySchedule = null) {
  const targetDate = date instanceof Date ? date : new Date(date);
  const targetDateKey = targetDate.toISOString().split('T')[0];
  const todayDateKey = new Date().toISOString().split('T')[0];

  if (targetDateKey !== todayDateKey) {
    const shifts = getShiftEntries(daySchedule);
    return SHIFT_ORDER.find((shift) => (shifts[shift] || []).length > 0) || 'A';
  }

  const minutes = targetDate.getHours() * 60 + targetDate.getMinutes();
  if (minutes < 8 * 60) {
    return 'C';
  }
  if (minutes < 11 * 60) {
    return 'A';
  }
  if (minutes < 15 * 60) {
    return 'M';
  }
  return 'B';
}

function getAssignedPeopleForShift(daySchedule, shiftCode) {
  const shifts = getShiftEntries(daySchedule);
  const entries = shifts[shiftCode];
  if (!Array.isArray(entries)) {
    return [];
  }
  // Entries may be UUIDs (new) or names (legacy).
  // Return display *names* so all callers can do .join(' & ') unchanged.
  // Deduplication is by resolved name.
  const seen = new Set();
  const names = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'string' || !entry.trim()) {
      continue;
    }
    const name = resolvePersonName(entry);
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

let _peopleCache = []; // populated by _refreshPeopleCache below

async function _refreshPeopleCache() {
  try {
    _peopleCache = await DB.getUsers();
  } catch {
    // keep existing cache on error
  }
}

function resolvePersonName(entry) {
  if (!entry) {
    return '';
  }
  const s = String(entry).trim();
  // Try by id first
  const byId = _peopleCache.find((p) => String(p.id) === s);
  if (byId) {
    return byId.name;
  }
  // Legacy: already a name
  return s;
}

// Get people from database
async function getUsers() {
  await ensureDB();
  const users = await DB.getUsers();
  _peopleCache = users;
  return users;
}

// Get schedule from database
async function getSchedule(date = null) {
  await ensureDB();
  if (date) {
    // load a small window around the date to reduce data
    const d = new Date(date);
    const from = d.toISOString().split('T')[0];
    const toDate = new Date(d);
    toDate.setDate(toDate.getDate() + 7); // small buffer
    const to = toDate.toISOString().split('T')[0];
    return await DB.getSchedule(from, to);
  }
  return await DB.getSchedule();
}

// Get handover notes from database
async function getHandoverNotes() {
  await ensureDB();
  return await DB.getHandoverNotes();
}

// Save handover notes to database
async function saveHandoverNotes(notes) {
  await ensureDB();
  await DB.saveHandoverNotes(notes);
  // Invalidate cache since data changed
  invalidateRenderCache();
}

// Invalidate render cache
function invalidateRenderCache() {
  cachedDateData = null;
  cachedDateKey = null;
}

// Get notes for current date
async function getNotesForDate(dateKey) {
  const allNotes = await getHandoverNotes();
  const dateData = allNotes[dateKey];
  if (!dateData) {
    return { notes: [], sortOrder: [] };
  }
  if (Array.isArray(dateData)) {
    // Backward compatibility: wrap array
    return { notes: dateData, sortOrder: dateData.map((n) => n.id) };
  }
  return dateData;
}

async function renderHandoverNotes(skipCache = false) {
  const dateKey = currentDate.toISOString().split('T')[0];

  // If searching, get all notes across all dates
  if (searchQuery && searchQuery.trim()) {
    const allNotes = await getHandoverNotes();
    const schedule = await getSchedule();
    const shiftPeople = await getCurrentShiftPeople();

    // Flatten all notes from all dates
    const allNotesFlat = { notes: [], sortOrder: [] };
    for (const [date, dateData] of Object.entries(allNotes)) {
      if (dateData && dateData.notes) {
        // Add date info to each note for display
        allNotesFlat.notes.push(...dateData.notes.map((n) => ({ ...n, _date: date })));
        allNotesFlat.sortOrder.push(...dateData.sortOrder);
      }
    }

    renderHandoverNotesSync(allNotesFlat, schedule, shiftPeople);
    return;
  }

  // Use cache if available and date hasn't changed
  if (!skipCache && cachedDateKey === dateKey && cachedDateData) {
    renderHandoverNotesSync(cachedDateData, cachedSchedule, cachedShiftPeople);
    return;
  }

  // Load data and cache it
  const dateData = await getNotesForDate(dateKey);
  const schedule = await getSchedule(currentDate);
  const daySchedule = schedule[dateKey] || {};
  const shiftPeople = await getCurrentShiftPeople();

  // Cache for next render
  cachedDateKey = dateKey;
  cachedDateData = dateData;
  cachedSchedule = schedule;
  cachedShiftPeople = shiftPeople;

  renderHandoverNotesSync(dateData, schedule, shiftPeople);
}

// Synchronous render that doesn't do any async calls
function renderHandoverNotesSync(dateData, schedule, shiftPeople) {
  const dateKey = currentDate.toISOString().split('T')[0];
  let notes = dateData.notes || [];
  const sortOrder = dateData.sortOrder || [];

  const unresolvedList = document.getElementById('unresolved-list');
  const generalList = document.getElementById('general-list');

  // Update active states for sort and filter controls
  updateSortFilterActiveStates();
  const actionsList = document.getElementById('actions-list');
  const emptyState = document.getElementById('empty-state');
  
  // Apply search filter (includes staff name)
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    notes = notes.filter(
      (n) =>
        n.text.toLowerCase().includes(query) ||
        (n.room && n.room.toLowerCase().includes(query)) ||
        (n.guestName && n.guestName.toLowerCase().includes(query)) ||
        n.category.toLowerCase().includes(query) ||
        (n.addedBy && n.addedBy.toLowerCase().includes(query)) ||
        (n.editedBy && n.editedBy.toLowerCase().includes(query))
    );
  }

  // Apply category filter
  if (currentFilter === 'promised') {
    notes = notes.filter((n) => n.promised);
  } else if (currentFilter === 'followup') {
    notes = notes.filter((n) => n.followup);
  } else if (currentFilter === 'overdue') {
    const now = new Date();
    notes = notes.filter((n) => {
      if (!n.dueDate) {
        return false;
      }
      const dueDt = new Date(`${n.dueDate}T${n.dueTime || '00:00'}`);
      return dueDt < now;
    });
  } else if (currentFilter === 'urgent') {
    notes = notes.filter((n) => n.promised && n.followup);
  } else if (currentFilter === 'completed') {
    notes = notes.filter((n) => n.completed);
  } else if (currentFilter === 'pending') {
    notes = notes.filter((n) => !n.completed);
  }
  // Apply quick filters
  // Need schedule/currentShift for 'myShift'
  const daySchedule = schedule[dateKey] || {};
  const currentShift = getCurrentShiftCode(currentDate, daySchedule);
  if (currentQuickFilter === 'myShift') {
    notes = notes.filter((n) => (n.shift || currentShift) === currentShift);
  } else if (currentQuickFilter === 'todaysUrgent') {
    notes = notes.filter((n) => n.promised || n.followup);
  } else if (currentQuickFilter === 'promised') {
    notes = notes.filter((n) => n.promised);
  } else if (currentQuickFilter === 'followup') {
    notes = notes.filter((n) => n.followup);
  } else if (currentQuickFilter === 'openItems') {
    notes = notes.filter((n) => !n.completed);
  } else if (currentQuickFilter === 'completed') {
    notes = notes.filter((n) => n.completed);
  }

  // Apply sorting
  if (currentSort === 'priority') {
    // Sort by: overdue first, then items with due dates soon, then promised/followup, then newest
    notes.sort((a, b) => {
      const now = new Date();

      // Get due date priority for each note
      const getUrgency = (note) => {
        if (note.dueDate) {
          const dueDt = new Date(`${note.dueDate}T${note.dueTime || '00:00'}`);
          const diffMs = dueDt - now;
          if (diffMs < 0) {
            return 0;
          } // Overdue
          if (diffMs < 3600000) {
            return 1;
          } // < 1 hour
          if (diffMs < 86400000) {
            return 2;
          } // < 24 hours
          return 3; // > 24 hours
        }
        if (note.promised && note.followup) {
          return 1.5;
        }
        if (note.promised || note.followup) {
          return 2.5;
        }
        return 4;
      };

      const urgencyA = getUrgency(a);
      const urgencyB = getUrgency(b);

      if (urgencyA !== urgencyB) {
        return urgencyA - urgencyB;
      }
      return b.timestamp - a.timestamp; // Then by newest
    });
  } else if (currentSort === 'custom' && sortOrder.length > 0) {
    // Sort notes by sortOrder array
    const notesById = Object.fromEntries(notes.map((n) => [n.id, n]));
    notes = sortOrder.map((id) => notesById[id]).filter(Boolean);
    // Add any notes not in sortOrder (new notes)
    const missingNotes = notes.filter((n) => !sortOrder.includes(n.id));
    notes = notes.concat(missingNotes);
  } else if (currentSort === 'newest') {
    notes.sort((a, b) => b.timestamp - a.timestamp);
  } else if (currentSort === 'oldest') {
    notes.sort((a, b) => a.timestamp - b.timestamp);
  } else if (currentSort === 'room') {
    notes.sort((a, b) => {
      const roomA = a.room || '';
      const roomB = b.room || '';
      return roomA.localeCompare(roomB, undefined, { numeric: true });
    });
  } else if (currentSort === 'staff') {
    notes.sort((a, b) => {
      const staffA = a.addedBy || 'Staff';
      const staffB = b.addedBy || 'Staff';
      return staffA.localeCompare(staffB);
    });
  } else if (currentSort === 'dueDate') {
    notes.sort((a, b) => {
      // Items without due dates go to bottom
      if (!a.dueDate && !b.dueDate) {
        return a.timestamp - b.timestamp;
      }
      if (!a.dueDate) {
        return 1;
      }
      if (!b.dueDate) {
        return -1;
      }

      const dueDtA = new Date(`${a.dueDate}T${a.dueTime || '00:00'}`);
      const dueDtB = new Date(`${b.dueDate}T${b.dueTime || '00:00'}`);
      return dueDtA - dueDtB;
    });
  }

  if (notes.length === 0) {
    unresolvedList.innerHTML = '';
    generalList.innerHTML = '';
    actionsList.innerHTML = '';
    emptyState.classList.remove('hidden');
    
    updateBulkUI();
    return;
  }

  emptyState.classList.add('hidden');

  // Sort notes into groups but keep them in saved order (don't re-sort by timestamp)
  const unresolved = notes.filter((n) => !n.completed && (n.promised || n.followup));
  const general = notes.filter((n) => !n.completed && !n.promised && !n.followup);
  const actions = notes.filter((n) => n.completed);

  // Render each group, preserving note order for drag-drop
  unresolvedList.innerHTML =
    unresolved.length > 0
      ? unresolved.map((n) => renderNote(n, shiftPeople)).join('')
      : `<div class="empty-group">${'No Unresolved / Important Notes'}</div>`;
  generalList.innerHTML =
    general.length > 0
      ? general.map((n) => renderNote(n, shiftPeople)).join('')
      : `<div class="empty-group">${'No General Notes'}</div>`;
  actionsList.innerHTML =
    actions.length > 0
      ? actions.map((n) => renderNote(n, shiftPeople)).join('')
      : `<div class="empty-group">${'No Completed Notes'}</div>`;

  // Update bulk UI after render
  updateBulkUI();
}

// Render individual note
function renderNote(note, shiftPeople = '') {
  const timestamp = new Date(note.timestamp);
  const timeStr = timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const safeCategory = escapeHtml(note.category || 'Info');
  const safeText = escapeHtml(note.text || '');
  const safePromiseText = escapeHtml(note.promiseText || '');
  const safeEditedBy = escapeHtml(note.editedBy || 'Staff');
  const safePeopleDisplay = escapeHtml(note.addedBy || shiftPeople || 'Staff');
  const safeShiftInfo = escapeHtml(note.shift || 'A');

  const classes = ['handover-item'];
  if (note.completed) {
    classes.push('completed');
  }
  if (note.promised) {
    classes.push('has-promise');
  }
  if (note.followup) {
    classes.push('has-followup');
  }
  if (note.promised && note.followup) {
    classes.push('has-both-warnings');
  }

  // Top badges (category, promise, followup)
  const catClass = `category-${(note.category || 'info')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')}`;
  const topBadges = [];
  topBadges.push(`<span class="category-badge ${catClass}">${safeCategory}</span>`);
  if (note.promised) {
    topBadges.push(
      `<span class="warning-badge promise">${'promised'.toUpperCase()}</span>`
    );
  }
  if (note.followup) {
    topBadges.push(
      `<span class="warning-badge followup">${'follow-up'.toUpperCase()}</span>`
    );
  }

  // Add date badge when searching across all dates
  if (note._date) {
    const noteDate = new Date(note._date);
    const dateStr = noteDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    topBadges.push(`<span class="date-badge">${escapeHtml(dateStr)}</span>`);
  }

  // Inline badges (room, guest) - will appear near the text
  const inlineBadges = [];
  if (note.room) {
    // Split rooms by comma and create a badge for each
    const rooms = note.room
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r);
    rooms.forEach((room) => {
      inlineBadges.push(`<span class="room-badge-inline">${escapeHtml(room)}</span>`);
    });
  }
  if (note.guestName) {
    // Split guest names by comma and create a badge for each
    const guests = note.guestName
      .split(',')
      .map((g) => g.trim())
      .filter((g) => g);
    guests.forEach((guest) => {
      inlineBadges.push(`<span class="guest-badge-inline">${escapeHtml(guest)}</span>`);
    });
  }

  const editInfo = note.editedAt
    ? `<div class="edit-info">Edited: ${escapeHtml(new Date(note.editedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))} by ${safeEditedBy}</div>`
    : '';
  const attachments =
    note.attachments && note.attachments.length > 0
      ? `<div class="attachments">${note.attachments
          .map((att) => {
            // Support both old format (url) and new format (file_key)
            // Allowed types: images (jpg, jpeg, png, gif, webp, svg) and PDF
            const isAllowedType = (att) => {
              const filename = (att.filename || att.name || '').toLowerCase();
              const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
              const isPdfExtension = filename.endsWith('.pdf');
              const isImageExtension = imageExtensions.some((ext) => filename.endsWith(ext));
              const mimeType = att.mime_type || '';
              const isImageMime = mimeType.startsWith('image/');
              const isPdfMime = mimeType === 'application/pdf';
              return isImageExtension || isPdfExtension || isImageMime || isPdfMime;
            };

            if (!isAllowedType(att)) {
              return ''; // Skip non-allowed file types
            }

            const filename = att.filename || att.name || 'attachment';
            const safeFilename = escapeHtml(filename);
            const isImage = filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

            if (att.file_key) {
              // New Minio format - open in browser with auth header
              const safeNameForJs = escapeJsString(filename);
              const safeFileKeyForJs = escapeJsString(att.file_key);
              return `<a href="#" onclick="openAttachment('${safeFileKeyForJs}','${safeNameForJs}','${isImage ? 'image' : 'pdf'}'); return false;" class="attachment-link" title="${safeFilename}">${isImage ? '🖼️' : '📄'} ${safeFilename}</a>`;
            } else if (att.url && att.url.startsWith('data:image')) {
              // Old base64 format (image)
              return `<a href="${escapeHtml(att.url)}" target="_blank" class="attachment-link" title="${safeFilename}">🖼️ ${safeFilename}</a>`;
            } else if (att.url && att.url.includes('data:application/pdf')) {
              // Old base64 format (PDF)
              return `<a href="${escapeHtml(att.url)}" target="_blank" class="attachment-link" title="${safeFilename}">📄 ${safeFilename}</a>`;
            }
            return ''; // Skip other file types
          })
          .filter(Boolean)
          .join('')}</div>`
      : '';

  // Due label
  let dueLabel = 'No Due Date';
  if (note.dueDate) {
    const dueDt = new Date(`${note.dueDate}T${note.dueTime || '00:00'}`);
    const now = new Date();
    const diffMs = dueDt - now;
    const hrs = diffMs / (1000 * 60 * 60);

    let className = 'due-label';
    let text = '';

    if (diffMs < 0) {
      // Overdue - red
      className += ' due-overdue';
      const absDiffMs = Math.abs(diffMs);
      const absHrs = Math.floor(absDiffMs / (1000 * 60 * 60));
      const absMins = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (absHrs < 1) {
        text = `OVERDUE by ${absMins}m`;
      } else {
        text = `OVERDUE by ${absHrs}h`;
      }
    } else if (hrs <= 1) {
      // Close (1 hour or less) - orange
      className += ' due-close';
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      text = `Due in ${mins}m`;
    } else if (hrs <= 48) {
      // Within 48 hours - show hours
      const floorHrs = Math.floor(hrs);
      text = `Due in ${floorHrs}h`;
    } else {
      // More than 48 hours - show full date and time
      const dateStr = dueDt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const timeStr = dueDt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      text = `Due ${dateStr} ${timeStr}`;
    }

    dueLabel = `<span class="${className}">${text}</span>`;
  }

  return `
        <div class="${classes.join(' ')}" data-note-id="${note.id}" onclick="toggleSelect('${note.id}', this)">
            <div class="handover-header">
                <div class="handover-meta">
                    ${topBadges.join('')}
                </div>
                <div class="handover-actions">
                    <button class="btn-icon btn-complete" onclick="event.stopPropagation(); toggleComplete('${note.id}')" title="${note.completed ? 'Mark incomplete' : 'Mark complete'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${note.completed ? '<path d="M3 12l6 6 12-12"/>' : '<polyline points="20 6 9 17 4 12"/>'}
                        </svg>
                    </button>
                    <button class="btn-icon btn-edit" onclick="event.stopPropagation(); editNote('${note.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="handover-text">${safeText}</div>
            ${inlineBadges.length > 0 ? `<div class="inline-badges">${inlineBadges.join('')}</div>` : ''}
            ${note.promiseText ? `<div class="promise-text"><span style="color: var(--text-tertiary); font-style: italic; font-weight: normal;";>Promised to...</span> → ${safePromiseText}</div>` : ''}
            ${attachments}
            ${editInfo}
            <div class="handover-footer">
                <span>${escapeHtml(timeStr)} | ${safeShiftInfo} ${'shift'} | ${safePeopleDisplay}</span>
                <span>${dueLabel}</span>
            </div>
        </div>
    `;
}

// Open add note modal
function openAddNote() {
  currentEditingNoteId = null;
  document.getElementById('modal-title').textContent = 'Add Note';
  document.getElementById('note-form').reset();
  document.getElementById('promise-text-group').style.display = 'none';
  document.getElementById('attachments-list').innerHTML = '';
  document.getElementById('draft-indicator').classList.add('hidden');
  // Load draft if present
  loadDraftIntoForm();
  attachAutosaveListeners();
  document.getElementById('note-modal').classList.remove('hidden');
  // Focus note field and add Enter key handler
  const noteTextarea = document.getElementById('note-text');
  noteTextarea.focus();
  noteTextarea.addEventListener('keydown', handleNoteTextareaEnter, {
    once: true,
  });
}

// Handle Enter key in note textarea to submit
function handleNoteTextareaEnter(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('note-form').dispatchEvent(new Event('submit'));
  } else if (e.key === 'Escape') {
    closeNoteModal();
  } else {
    // Re-attach listener if other keys pressed
    e.target.addEventListener('keydown', handleNoteTextareaEnter, {
      once: true,
    });
  }
}

// Add attachment
function addAttachment() {
  const url = document.getElementById('attachment-url').value.trim();
  if (!url) {
    return;
  }

  const attachmentsList = document.getElementById('attachments-list');
  const name = url.split('/').pop().substring(0, 30);
  const attachmentDiv = document.createElement('div');
  attachmentDiv.className = 'attachment-item';
  attachmentDiv.innerHTML = `
        <span>📎 ${escapeHtml(name)}</span>
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
    `;
  attachmentDiv.dataset.url = url;
  attachmentsList.appendChild(attachmentDiv);
  document.getElementById('attachment-url').value = '';
}

// Handle file selection and upload to Minio
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  // Check file size (limit to 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showAlert('File Too Large', 'File size must be less than 5MB');
    return;
  }

  try {
    // Show loading indicator
    const uploadStatus = document.getElementById('upload-status');
    if (uploadStatus) {
      uploadStatus.textContent = 'Uploading...';
      uploadStatus.style.display = 'block';
    }

    // Upload file to backend/Minio
    const uploadResponse = await DB.uploadFile(file);

    if (!uploadResponse || !uploadResponse.file_key) {
      showAlert('Upload Failed', 'File upload failed');
      return;
    }

    // Add attachment item to list
    const attachmentsList = document.getElementById('attachments-list');
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'attachment-item';
    attachmentDiv.innerHTML = `
            <span>📎 ${escapeHtml(file.name)}</span>
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
        `;
    attachmentDiv.dataset.fileKey = uploadResponse.file_key;
    attachmentDiv.dataset.filename = file.name;
    attachmentDiv.dataset.size = uploadResponse.size;
    attachmentDiv.dataset.contentType = uploadResponse.content_type;
    attachmentsList.appendChild(attachmentDiv);

    // Reset file input and clear status
    event.target.value = '';
    if (uploadStatus) {
      uploadStatus.style.display = 'none';
      uploadStatus.textContent = '';
    }
  } catch (error) {
    showAlert('Upload Error', 'Upload failed: ' + error.message);
    console.error('Upload error:', error);
    const uploadStatus = document.getElementById('upload-status');
    if (uploadStatus) {
      uploadStatus.textContent = 'Upload failed: ' + error.message;
      uploadStatus.style.color = 'red';
    }
  }
}

// Store current attachment for download
let currentAttachmentBlob = null;
let currentAttachmentFilename = null;

// Open attachment in modal
async function openAttachment(fileKey, filename, type) {
  try {
    currentAttachmentFilename = filename;
    currentAttachmentBlob = null;

    const modal = document.getElementById('attachment-modal');
    const preview = document.getElementById('attachment-preview');
    const title = document.getElementById('attachment-modal-title');

    title.textContent = filename;
    preview.innerHTML = ''; // Clear previous content

    const blob = await DB.downloadFile(fileKey);
    currentAttachmentBlob = blob;

    if (type === 'image' || filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      preview.appendChild(img);
    } else if (type === 'pdf' || filename.toLowerCase().endsWith('.pdf')) {
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.minHeight = '500px';
      iframe.src = URL.createObjectURL(blob);
      preview.appendChild(iframe);
    }

    // Show modal
    modal.classList.remove('hidden');
  } catch (error) {
    console.error('Failed to open attachment:', error);
    showAlert('Error', 'Failed to open attachment: ' + error.message);
  }
}

// Download current attachment (Save As)
function downloadCurrentAttachment() {
  if (!currentAttachmentBlob || !currentAttachmentFilename) {
    showAlert('Error', 'No attachment loaded');
    return;
  }

  const url = URL.createObjectURL(currentAttachmentBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentAttachmentFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Close attachment modal
function closeAttachmentModal() {
  const modal = document.getElementById('attachment-modal');
  modal.classList.add('hidden');
  const preview = document.getElementById('attachment-preview');

  // Cleanup blob URLs
  const iframes = preview.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    if (iframe.src) {
      URL.revokeObjectURL(iframe.src);
    }
  });
  const imgs = preview.querySelectorAll('img');
  imgs.forEach((img) => {
    if (img.src) {
      URL.revokeObjectURL(img.src);
    }
  });

  currentAttachmentBlob = null;
  currentAttachmentFilename = null;
}

// Deprecated: kept for backwards compatibility
async function downloadAttachment(fileKey, filename) {
  await openAttachment(fileKey, filename, 'file');
}

// Close note modal
function closeNoteModal() {
  document.getElementById('note-modal').classList.add('hidden');
  currentEditingNoteId = null;
}

// Open shortcuts modal
function openShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.remove('hidden');
}

// Close shortcuts modal
function closeShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.add('hidden');
}

// Save note
async function saveNote(event) {
  event.preventDefault();
  const dateKey = currentDate.toISOString().split('T')[0];
  const allNotes = await getHandoverNotes();
  let dateData = allNotes[dateKey];
  if (!dateData || Array.isArray(dateData)) {
    dateData = {
      notes: dateData || [],
      sortOrder: (dateData || []).map((n) => n.id),
    };
  }
  const dateNotes = dateData.notes;
  const sortOrder = dateData.sortOrder;
  const schedule = await getSchedule();
  const daySchedule = schedule[dateKey] || {};
  const currentShift = getCurrentShiftCode(currentDate, daySchedule);
  const assignedPeople = getAssignedPeopleForShift(daySchedule, currentShift);
  const people = await getUsers();
  // Collect attachments with file keys
  const attachmentItems = document.querySelectorAll('#attachments-list .attachment-item');
  const attachments = Array.from(attachmentItems).map((item) => {
    if (item.dataset.fileKey) {
      return {
        file_key: item.dataset.fileKey,
        filename: item.dataset.filename,
        size: parseInt(item.dataset.size) || 0,
        content_type: item.dataset.contentType || 'application/octet-stream',
      };
    }
    return {
      url: item.dataset.url,
      name: item.dataset.url?.split('/').pop() || 'attachment',
    };
  });
  const noteData = {
    id: currentEditingNoteId || generateUUID(),
    category: document.getElementById('note-category').value,
    room: document.getElementById('note-room').value,
    guestName: document.getElementById('note-guest').value,
    text: document.getElementById('note-text').value,
    followup: document.getElementById('note-followup').checked,
    promised: document.getElementById('note-promised').checked,
    promiseText: document.getElementById('note-promised').checked
      ? document.getElementById('promise-text').value
      : '',
    attachments: attachments,
    timestamp: currentEditingNoteId
      ? dateNotes.find((n) => n.id === currentEditingNoteId)?.timestamp || Date.now()
      : Date.now(),
    completed: false,
    addedBy:
      assignedPeople.length > 0
        ? assignedPeople.join(' & ')
        : currentUser?.full_name || currentUser?.email || people[0]?.name || 'Staff',
    dueDate: document.getElementById('note-due-date').value || '',
    dueTime: document.getElementById('note-due-time').value || '',
    shift: currentEditingNoteId
      ? dateNotes.find((n) => n.id === currentEditingNoteId)?.shift || currentShift
      : currentShift,
  };
  if (currentEditingNoteId) {
    const index = dateNotes.findIndex((n) => n.id === currentEditingNoteId);
    if (index !== -1) {
      noteData.editedAt = Date.now();
      // Get current shift people for editedBy
      if (assignedPeople.length > 0) {
        noteData.editedBy = assignedPeople.join(' & ');
      } else if (currentUser?.full_name || currentUser?.email) {
        noteData.editedBy = currentUser.full_name || currentUser.email;
      } else if (people.length >= 2) {
        noteData.editedBy = people
          .slice(0, 2)
          .map((p) => p.name)
          .join(' & ');
      } else {
        noteData.editedBy = people[0]?.name || 'Staff';
      }
      dateNotes[index] = { ...dateNotes[index], ...noteData };
    }
  } else {
    dateNotes.push(noteData);
    // Add to sortOrder if not present
    if (!sortOrder.includes(noteData.id)) {
      sortOrder.push(noteData.id);
    }
  }
  allNotes[dateKey] = { notes: dateNotes, sortOrder };

  // Clear draft and close modal immediately
  clearDraftForCurrentContext();
  closeNoteModal();

  // Save to database and re-render in background
  saveHandoverNotes(allNotes).then(() => {
    renderHandoverNotes();
  });
}

// Edit note
async function editNote(noteId) {
  // Show modal immediately
  currentEditingNoteId = noteId;
  document.getElementById('modal-title').textContent = 'Edit Note';
  document.getElementById('note-modal').classList.remove('hidden');

  // Focus note field immediately
  const noteTextarea = document.getElementById('note-text');
  noteTextarea.focus();

  // Load data in background and populate
  const dateKey = currentDate.toISOString().split('T')[0];
  const dateData = await getNotesForDate(dateKey);
  const notes = Array.isArray(dateData) ? dateData : dateData.notes || [];
  const note = notes.find((n) => n.id === noteId);

  if (!note) {
    document.getElementById('note-modal').classList.add('hidden');
    return;
  }

  document.getElementById('note-category').value = note.category;
  document.getElementById('note-room').value = note.room || '';
  document.getElementById('note-guest').value = note.guestName || '';
  document.getElementById('note-text').value = note.text;
  document.getElementById('note-followup').checked = note.followup || false;
  document.getElementById('note-promised').checked = note.promised || false;
  document.getElementById('promise-text').value = note.promiseText || '';

  // Load attachments
  const attachmentsList = document.getElementById('attachments-list');
  attachmentsList.innerHTML = '';
  if (note.attachments && note.attachments.length > 0) {
    note.attachments.forEach((att) => {
      const attachmentDiv = document.createElement('div');
      attachmentDiv.className = 'attachment-item';
      const displayName = att.filename || att.name || att.url?.split('/').pop() || 'attachment';
      attachmentDiv.innerHTML = `
                <span>📎 ${escapeHtml(displayName)}</span>
                <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
            `;
      if (att.file_key) {
        attachmentDiv.dataset.fileKey = att.file_key;
        attachmentDiv.dataset.filename = displayName;
        attachmentDiv.dataset.size = att.size || 0;
        attachmentDiv.dataset.contentType = att.content_type || 'application/octet-stream';
      } else if (att.url) {
        attachmentDiv.dataset.url = att.url;
      }
      attachmentsList.appendChild(attachmentDiv);
    });
  }

  if (note.promised) {
    document.getElementById('promise-text-group').style.display = 'block';
  }
  // Populate due date/time if present
  document.getElementById('note-due-date').value = note.dueDate || '';
  document.getElementById('note-due-time').value = note.dueTime || '';
  document.getElementById('draft-indicator').classList.add('hidden');
  attachAutosaveListeners();

  // Add Enter key handler
  noteTextarea.addEventListener('keydown', handleNoteTextareaEnter, {
    once: true,
  });
}

// Delete note
async function deleteNote(noteId) {
  showConfirm('Delete Note', 'Are you sure you want to delete this note?', async () => {
    // Remove from DOM immediately
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    if (noteElement) {
      noteElement.remove();
    }

    // Remove from selection if selected
    selectedNotes.delete(noteId);
    updateBulkUI();

    // Save in background
    const dateKey = currentDate.toISOString().split('T')[0];
    getHandoverNotes().then((allNotes) => {
      return getNotesForDate(dateKey).then((dateData) => {
        const notes = dateData.notes || [];
        dateData.notes = notes.filter((n) => n.id !== noteId);
        dateData.sortOrder = dateData.sortOrder.filter((id) => id !== noteId);
        allNotes[dateKey] = dateData;
        return saveHandoverNotes(allNotes);
      });
    });
  });
}

// Toggle complete status
async function toggleComplete(noteId) {
  // Immediate UI feedback - update DOM directly
  const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
  if (!noteElement) {
    return;
  }

  const isCompleted = noteElement.classList.contains('completed');
  noteElement.classList.toggle('completed');

  // Update button icon immediately
  const btn = noteElement.querySelector('.btn-complete svg path, .btn-complete svg polyline');
  if (btn) {
    btn.outerHTML = isCompleted
      ? '<polyline points="20 6 9 17 4 12"/>'
      : '<path d="M3 12l6 6 12-12"/>';
  }

  // Move element to correct section immediately
  const unresolvedList = document.getElementById('unresolved-list');
  const generalList = document.getElementById('general-list');
  const actionsList = document.getElementById('actions-list');

  if (!isCompleted) {
    // Moving to completed
    actionsList.appendChild(noteElement);
  } else {
    // Moving back - need to check if it has promised/followup
    const hasWarnings =
      noteElement.classList.contains('has-promise') ||
      noteElement.classList.contains('has-followup');
    if (hasWarnings) {
      unresolvedList.appendChild(noteElement);
    } else {
      generalList.appendChild(noteElement);
    }
  }

  // Save in background (no await to keep it fast)
  const dateKey = currentDate.toISOString().split('T')[0];
  getHandoverNotes().then((allNotes) => {
    return getNotesForDate(dateKey).then((dateData) => {
      const notes = dateData.notes || [];
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        note.completed = !isCompleted;
        allNotes[dateKey] = dateData;
        return saveHandoverNotes(allNotes);
      }
    });
  });
}

// Update people block with gradient
async function getCurrentShiftPeople() {
  const dateKey = currentDate.toISOString().split('T')[0];
  const schedule = await getSchedule();
  const daySchedule = schedule[dateKey] || {};
  const currentShift = getCurrentShiftCode(currentDate, daySchedule);
  const assignedPeople = getAssignedPeopleForShift(daySchedule, currentShift);

  if (assignedPeople.length > 0) {
    return assignedPeople.join(' & ');
  }
  return '';
}

async function updatePeopleBlock() {
  const people = await getUsers();
  const dateKey = currentDate.toISOString().split('T')[0];
  const schedule = await getSchedule();
  const daySchedule = schedule[dateKey] || {};

  const currentShift = getCurrentShiftCode(currentDate, daySchedule);
  const assignedPeople = getAssignedPeopleForShift(daySchedule, currentShift);

  const peopleNames = document.getElementById('people-names');
  const shiftName = document.getElementById('shift-name');
  const headerInfo = document.querySelector('.header-info');

  if (headerInfo) {
    headerInfo.classList.toggle('hidden', assignedPeople.length === 0);
  }

  if (assignedPeople.length > 0) {
    // Find people objects
    const selectedPeople = assignedPeople
      .map((name) => people.find((p) => p.name === name))
      .filter((p) => p);

    if (selectedPeople.length === 1) {
      peopleNames.textContent = selectedPeople[0].name.toUpperCase();
    } else if (selectedPeople.length >= 2) {
      peopleNames.textContent = selectedPeople.map((p) => p.name.toUpperCase()).join(' & ');
    }
  } else if (peopleNames) {
    peopleNames.textContent = '';
  }

  // Update shift name
  if (shiftName) {
    shiftName.textContent = assignedPeople.length > 0 ? currentShift.toUpperCase() + ' SHIFT' : '';
  }
}

// Update active states for sort and filter controls
function updateSortFilterActiveStates() {
  const sortSelect = document.getElementById('sort-select');
  const filterSelect = document.getElementById('filter-select');

  // Update sort select active state
  if (sortSelect) {
    if (currentSort !== 'newest') {
      sortSelect.classList.add('active');
    } else {
      sortSelect.classList.remove('active');
    }
  }

  // Update filter select active state
  if (filterSelect) {
    if (currentFilter !== 'all') {
      filterSelect.classList.add('active');
    } else {
      filterSelect.classList.remove('active');
    }
  }

  // Update quick filter button active states
  document.querySelectorAll('.quick-filters .btn-primary').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === currentQuickFilter);
  });
}

// Quick filter application
function applyQuickFilter(filter) {
  // Toggle off if clicking the same filter again
  if (currentQuickFilter === filter) {
    currentQuickFilter = '';
  } else {
    currentQuickFilter = filter;
  }
  updateSortFilterActiveStates();
  renderHandoverNotes();
}

// Bulk selection UI
function updateBulkUI() {
  const bulkControls = document.querySelector('.bulk-controls');
  const count = selectedNotes.size;
  const bulkCount = document.getElementById('bulk-count');
  if (count > 0) {
    bulkControls.classList.remove('unavailable');
    bulkCount.textContent = `${count} selected`;
  } else {
    bulkControls.classList.add('unavailable');
    bulkCount.textContent = '0 selected';
  }
}

function toggleSelect(id, element) {
  if (selectedNotes.has(id)) {
    selectedNotes.delete(id);
    if (element) {
      element.classList.remove('selected');
    }
  } else {
    selectedNotes.add(id);
    if (element) {
      element.classList.add('selected');
    }
  }
  updateBulkUI();
}

function clearSelection() {
  selectedNotes.forEach((noteId) => {
    const element = document.querySelector(`[data-note-id="${noteId}"]`);
    if (element) {
      element.classList.remove('selected');
    }
  });
  selectedNotes.clear();
  updateBulkUI();
}

async function bulkDelete() {
  if (selectedNotes.size === 0) {
    return;
  }

  showConfirm(
    'Delete Notes',
    `Are you sure you want to delete ${selectedNotes.size} selected notes? This action cannot be undone.`,
    async () => {
      const noteIds = Array.from(selectedNotes);

      // Remove from DOM immediately
      noteIds.forEach((noteId) => {
        const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteElement) {
          noteElement.remove();
        }
      });

      selectedNotes.clear();
      updateBulkUI();

      // Save in background
      const dateKey = currentDate.toISOString().split('T')[0];
      getHandoverNotes().then((allNotes) => {
        return getNotesForDate(dateKey).then((dateData) => {
          const notes = dateData.notes || [];
          dateData.notes = notes.filter((n) => !noteIds.includes(n.id));
          dateData.sortOrder = dateData.sortOrder.filter((id) => !noteIds.includes(id));
          allNotes[dateKey] = dateData;
          return saveHandoverNotes(allNotes);
        });
      });
    }
  );
}

async function bulkToggleComplete() {
  if (selectedNotes.size === 0) {
    return;
  }

  const unresolvedList = document.getElementById('unresolved-list');
  const generalList = document.getElementById('general-list');
  const actionsList = document.getElementById('actions-list');

  // Store selected IDs before clearing
  const noteIds = Array.from(selectedNotes);

  // Update UI immediately for all selected notes
  noteIds.forEach((noteId) => {
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!noteElement) {
      return;
    }

    const isCompleted = noteElement.classList.contains('completed');
    noteElement.classList.toggle('completed');

    // Update button icon
    const btn = noteElement.querySelector('.btn-complete svg path, .btn-complete svg polyline');
    if (btn) {
      btn.outerHTML = isCompleted
        ? '<polyline points="20 6 9 17 4 12"/>'
        : '<path d="M3 12l6 6 12-12"/>';
    }

    // Move to correct section
    if (!isCompleted) {
      actionsList.appendChild(noteElement);
    } else {
      const hasWarnings =
        noteElement.classList.contains('has-promise') ||
        noteElement.classList.contains('has-followup');
      if (hasWarnings) {
        unresolvedList.appendChild(noteElement);
      } else {
        generalList.appendChild(noteElement);
      }
    }
  });

  selectedNotes.clear();
  updateBulkUI();

  // Save in background
  const dateKey = currentDate.toISOString().split('T')[0];
  getHandoverNotes().then((allNotes) => {
    return getNotesForDate(dateKey).then((dateData) => {
      const notes = dateData.notes || [];
      notes.forEach((n) => {
        if (noteIds.includes(n.id)) {
          n.completed = !n.completed;
        }
      });
      allNotes[dateKey] = dateData;
      return saveHandoverNotes(allNotes);
    });
  });
}

// Draft autosave
function saveDraft() {
  const draft = {
    category: document.getElementById('note-category').value,
    room: document.getElementById('note-room').value,
    guestName: document.getElementById('note-guest').value,
    text: document.getElementById('note-text').value,
    followup: document.getElementById('note-followup').checked,
    promised: document.getElementById('note-promised').checked,
    promiseText: document.getElementById('promise-text').value,
    dueDate: document.getElementById('note-due-date').value,
    dueTime: document.getElementById('note-due-time').value,
  };
  if (!isMeaningfulDraft(draft)) {
    clearDraftForCurrentContext();
    return;
  }

  localStorage.setItem(
    getCurrentDraftKey(),
    JSON.stringify({
      version: DRAFT_SCHEMA_VERSION,
      updatedAt: Date.now(),
      data: draft,
    })
  );
  setDraftSavedIndicator();
}

let _draftTimeout = null;
function getCurrentDraftKey() {
  const dateKey = currentDate.toISOString().split('T')[0];
  const userKey = currentUser?.id || currentUser?.email || 'anon';
  return `${DRAFT_KEY}:${userKey}:${dateKey}:new`;
}

function isMeaningfulDraft(draft) {
  return Boolean(
    (draft.text && draft.text.trim().length >= 3) ||
      (draft.room && draft.room.trim()) ||
      (draft.guestName && draft.guestName.trim()) ||
      (draft.promiseText && draft.promiseText.trim()) ||
      draft.followup ||
      draft.promised ||
      draft.dueDate ||
      draft.dueTime
  );
}

function clearDraftForCurrentContext() {
  localStorage.removeItem(getCurrentDraftKey());
  const indicator = document.getElementById('draft-indicator');
  if (!indicator) {
    return;
  }
  indicator.textContent = 'Draft saved';
  indicator.classList.add('hidden');
}

function setDraftSavedIndicator(message = 'Draft saved') {
  const indicator = document.getElementById('draft-indicator');
  if (!indicator) {
    return;
  }
  indicator.textContent = message;
  indicator.classList.remove('hidden');
}

function renderDraftActions() {
  const indicator = document.getElementById('draft-indicator');
  if (!indicator) {
    return;
  }
  indicator.innerHTML = `
    <button type="button" class="btn-icon" id="draft-restore-btn">Use draft</button>
    <button type="button" class="btn-icon btn-danger" id="draft-discard-btn">Discard draft</button>
  `;
  indicator.classList.remove('hidden');
  document.getElementById('draft-restore-btn')?.addEventListener('click', () => {
    loadDraftIntoForm({ force: true });
    setDraftSavedIndicator();
  });
  document.getElementById('draft-discard-btn')?.addEventListener('click', clearDraftForCurrentContext);
}

function getDraftPayloadForCurrentContext() {
  const key = getCurrentDraftKey();
  const raw = localStorage.getItem(key) || localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const payload = parsed?.data ? parsed : { version: 0, updatedAt: Date.now(), data: parsed };
    if (Date.now() - payload.updatedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return payload;
  } catch (error) {
    console.warn('Invalid draft payload', error);
    localStorage.removeItem(key);
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

function saveDraftDebounced() {
  if (_draftTimeout) {
    clearTimeout(_draftTimeout);
  }
  _draftTimeout = setTimeout(saveDraft, 500);
}

function loadDraftIntoForm({ force = false } = {}) {
  const payload = getDraftPayloadForCurrentContext();
  if (!payload) {
    return;
  }
  if (!force) {
    renderDraftActions();
    return;
  }

  const draft = payload.data;
  document.getElementById('note-category').value = draft.category || 'info';
  document.getElementById('note-room').value = draft.room || '';
  document.getElementById('note-guest').value = draft.guestName || '';
  document.getElementById('note-text').value = draft.text || '';
  document.getElementById('note-followup').checked = !!draft.followup;
  document.getElementById('note-promised').checked = !!draft.promised;
  document.getElementById('promise-text').value = draft.promiseText || '';
  document.getElementById('note-due-date').value = draft.dueDate || '';
  document.getElementById('note-due-time').value = draft.dueTime || '';
  if (draft.promised) {
    document.getElementById('promise-text-group').style.display = 'block';
  }
}

function attachAutosaveListeners() {
  [
    'note-category',
    'note-room',
    'note-guest',
    'note-text',
    'note-followup',
    'note-promised',
    'promise-text',
    'note-due-date',
    'note-due-time',
    'attachment-url',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.removeEventListener('input', saveDraftDebounced);
    el.addEventListener('input', saveDraftDebounced);
    el.removeEventListener('change', saveDraftDebounced);
    el.addEventListener('change', saveDraftDebounced);
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts if user is typing in input fields
  const active = document.activeElement;
  const isInputFocused = active && (
    active.tagName === 'INPUT' ||
    active.tagName === 'TEXTAREA' ||
    active.tagName === 'SELECT' ||
    active.isContentEditable ||
    (active.getAttribute && active.getAttribute('contenteditable') === 'true')
  );

  // Alt + N: Add new note
  if (e.altKey && e.key.toLowerCase() === 'n' && !isInputFocused) {
    e.preventDefault();
    openAddNote();
  }

  // Alt + F: Focus search (allow in input fields)
  if (e.altKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }

  // Escape: Close modal
  if (e.key === 'Escape') {
    closeNoteModal();
    closeShortcutsModal();
  }

  // Alt + S: Save note (when modal is open)
  if (
    e.altKey &&
    e.key.toLowerCase() === 's' &&
    !document.getElementById('note-modal').classList.contains('hidden')
  ) {
    e.preventDefault();
    document.getElementById('note-form').dispatchEvent(new Event('submit'));
  }

  // Alt + D: Toggle date picker
  if (e.altKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    toggleDatePicker();
  }

  // Alt + K: Toggle theme
  if (e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggleTheme();
  }

  // ?: Show shortcuts help
  if (e.key === '?' && !isInputFocused) {
    e.preventDefault();
    openShortcutsModal();
  }
});

// Update time every second
function updateTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('current-time').textContent = `${hours}:${minutes}`;
}

// Update footer date
function updateFooterDate() {
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('footer-date').textContent = now.toLocaleDateString('en-US', options);
}

// Initialize date to today
let currentDate = new Date();
// Reset time to noon to avoid timezone issues
currentDate.setHours(12, 0, 0, 0);

function updateDateDisplay() {
  const options = { month: 'long', day: 'numeric' };
  document.getElementById('current-date').textContent = currentDate.toLocaleDateString(
    'en-US',
    options
  );
  updatePeopleBlock();
  renderHandoverNotes();
}

// Date navigation throttling to prevent rate limit issues
let lastDateChangeTime = 0;
const DATE_CHANGE_COOLDOWN = 300; // milliseconds
let isLoadingDate = false;

function changeDate(days) {
  const now = Date.now();

  // Prevent rapid-fire clicks
  if (now - lastDateChangeTime < DATE_CHANGE_COOLDOWN || isLoadingDate) {
    return;
  }

  lastDateChangeTime = now;
  isLoadingDate = true;

  // Disable navigation buttons during load
  const leftBtn = document.querySelector('.date-nav .nav-btn:first-child');
  const rightBtn = document.querySelector('.date-nav .nav-btn:last-child');
  if (leftBtn) {
    leftBtn.disabled = true;
  }
  if (rightBtn) {
    rightBtn.disabled = true;
  }

  try {
    currentDate.setDate(currentDate.getDate() + days);
    invalidateRenderCache(); // Cache is date-specific
    updateDateDisplay();
  } finally {
    // Re-enable buttons after a brief delay to ensure UI updates
    setTimeout(() => {
      if (leftBtn) {
        leftBtn.disabled = false;
      }
      if (rightBtn) {
        rightBtn.disabled = false;
      }
      isLoadingDate = false;
    }, 100);
  }
}

// Theme toggle
async function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  await DB.saveSetting(STORAGE_KEY_THEME, newTheme);
  updateThemeIcon(newTheme);
}

// Update theme icon
function updateThemeIcon(theme) {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    if (theme === 'dark') {
      themeBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    } else {
      themeBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
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
async function loadTheme() {
  const savedTheme = (await DB.getSetting(STORAGE_KEY_THEME)) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

// Date picker functions
let pickerDate = new Date();

function toggleDatePicker() {
  const picker = document.getElementById('custom-date-picker');
  if (picker.style.display === 'none') {
    pickerDate = new Date(currentDate);
    // Initialize select values before rendering
    document.getElementById('picker-month').value = pickerDate.getMonth();
    document.getElementById('picker-year').value = pickerDate.getFullYear();
    renderCalendar();
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

function updateCalendar() {
  const month = parseInt(document.getElementById('picker-month').value) || 0;
  const year = parseInt(document.getElementById('picker-year').value) || new Date().getFullYear();
  pickerDate = new Date(year, month, 1);
  renderCalendar();
}

function renderCalendar() {
  const year = pickerDate.getFullYear();
  const month = pickerDate.getMonth();

  // Get first day and number of days in month
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const daysContainer = document.getElementById('picker-days');
  daysContainer.innerHTML = '';

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dayEl = createDayElement(day, 'other-month', new Date(year, month - 1, day));
    daysContainer.appendChild(dayEl);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    let className = '';

    if (
      day === currentDate.getDate() &&
      month === currentDate.getMonth() &&
      year === currentDate.getFullYear()
    ) {
      className = 'selected';
    }

    const dayEl = createDayElement(day, className, date);
    daysContainer.appendChild(dayEl);
  }

  // Next month days
  const totalCells = daysContainer.children.length;
  const remainingCells = 42 - totalCells; // 6 weeks * 7 days
  for (let day = 1; day <= remainingCells; day++) {
    const dayEl = createDayElement(day, 'other-month', new Date(year, month + 1, day));
    daysContainer.appendChild(dayEl);
  }
}

function createDayElement(day, className, date) {
  const dayEl = document.createElement('div');
  dayEl.className = `date-picker-day ${className}`;
  dayEl.textContent = day;

  if (!className.includes('other-month')) {
    dayEl.onclick = () => selectDateFromPicker(date);
  }

  return dayEl;
}

function selectDateFromPicker(date) {
  currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  updateDateDisplay();
  document.getElementById('custom-date-picker').style.display = 'none';
}

function previousMonth() {
  pickerDate.setMonth(pickerDate.getMonth() - 1);
  document.getElementById('picker-month').value = pickerDate.getMonth();
  document.getElementById('picker-year').value = pickerDate.getFullYear();
  renderCalendar();
}

function nextMonth() {
  pickerDate.setMonth(pickerDate.getMonth() + 1);
  document.getElementById('picker-month').value = pickerDate.getMonth();
  document.getElementById('picker-year').value = pickerDate.getFullYear();
  renderCalendar();
}

function selectDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  currentDate = new Date(year, month - 1, day, 12, 0, 0, 0);
  updateDateDisplay();
  document.getElementById('custom-date-picker').style.display = 'none';
}

// Close date picker on outside click
document.addEventListener('click', (e) => {
  const picker = document.getElementById('custom-date-picker');
  const dateDisplay = document.getElementById('current-date');
  const dateNav = document.querySelector('.date-nav');

  if (picker && picker.style.display !== 'none') {
    // Close if click is outside the picker and date navigation area
    if (!dateNav?.contains(e.target)) {
      picker.style.display = 'none';
    }
  }
});

// Make functions available globally for inline event handlers
window.handleFileSelect = handleFileSelect;
window.addAttachment = addAttachment;
window.downloadAttachment = downloadAttachment;

// Close modal on outside click
document.addEventListener('DOMContentLoaded', async () => {
  await ensureDB();
  await loadCurrentUser();
  await _refreshPeopleCache();
  await loadTheme();
  applyRoleUI();
  resetPersonForm();

  // Initial render
  await updatePeopleBlock();
  await renderHandoverNotes();

  // Simple polling replacement for previous SSE live updates.
  // Refresh current view (handovers + people block) every 30s.
  const POLL_INTERVAL_MS = 30000;
  let pollTimer = null;
  function startDataPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      (async () => {
        try {
          if (typeof invalidateRenderCache === 'function') invalidateRenderCache();
          if (typeof renderHandoverNotes === 'function') await renderHandoverNotes(true);
          if (typeof updatePeopleBlock === 'function') await updatePeopleBlock();
        } catch (e) {
          console.warn('Background poll failed (will retry):', e?.message || e);
        }
      })();
    }, POLL_INTERVAL_MS);
  }
  function stopDataPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  window.stopDataPolling = stopDataPolling;
  startDataPolling();

  // Ensure polling stops on unload
  window.addEventListener('beforeunload', () => {
    if (typeof window.stopDataPolling === 'function') window.stopDataPolling();
  });

  document.getElementById('note-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'note-modal') {
      closeNoteModal();
    }
  });

  document.getElementById('shortcuts-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'shortcuts-modal') {
      closeShortcutsModal();
    }
  });

  // Toggle promise text field visibility
  document.getElementById('note-promised')?.addEventListener('change', (e) => {
    document.getElementById('promise-text-group').style.display = e.target.checked
      ? 'block'
      : 'none';
  });

  // Search handler
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    window.searchQuery = searchQuery;
    renderHandoverNotes();
  });

  // Sort handler
  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    updateSortFilterActiveStates();
    renderHandoverNotes();
  });

  // Filter handler
  document.getElementById('filter-select')?.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    updateSortFilterActiveStates();
    renderHandoverNotes();
  });
});

// Update time immediately and then every second
updateTime();
setInterval(updateTime, 1000);
updateDateDisplay();
// updateFooterDate();

// ============ People Management ============

async function openPeopleModal() {
  if (!currentUser?.is_admin) {
    showAlert('Access Denied', 'Only admins can manage staff.');
    return;
  }

  const modal = document.getElementById('people-modal');
  if (modal) {
    modal.style.display = 'flex';

    await loadPositions();
    if (typeof populatePositionOptions === 'function') populatePositionOptions();

    await renderPeopleList();
    resetPersonForm();
  }
}

function closePeopleModal() {
  const modal = document.getElementById('people-modal');
  if (modal) modal.style.display = 'none';
  resetPersonForm();
}

async function renderPeopleList() {
  const people = await getUsers();
  const peopleList = document.getElementById('people-list');

  if (people.length === 0) {
    peopleList.innerHTML = '<div class="empty-state">No staff members yet. Add one below!</div>';
    return;
  }

  peopleList.innerHTML = '';

  people.forEach((person) => {
    const personEl = document.createElement('div');
    personEl.className = 'person-item';

    const initials = getInitials(person.name);
    personEl.innerHTML = `
            <div class="person-avatar" style="background:${person.color}18;border:1px solid ${person.color}44;color:${person.color}">
              ${initials}
            </div>
            <div class="person-info">
                <div class="person-name">${person.name}</div>
                <div class="person-color-code">${person.color}</div>
            </div>
            <div class="person-actions">
                <button class="btn-icon" onclick='startPersonEdit(${JSON.stringify(String(person.id))})'>Edit</button>
                <button class="btn-icon btn-active-toggle" onclick='toggleUserActive(${JSON.stringify(String(person.id))}, ${!!person.isActive}, ${JSON.stringify(person.name)})'>${person.isActive !== false ? 'Deactivate' : 'Activate'}</button>
                <button class="btn-icon btn-danger" onclick='deletePerson(${JSON.stringify(String(person.id))}, ${JSON.stringify(person.name)})'>Delete</button>
            </div>
        `;

    peopleList.appendChild(personEl);
  });
}

async function savePerson() {
  const nameInput = document.getElementById('new-person-name');
  const colorInput = document.getElementById('new-person-color');

  const name = nameInput.value.trim();
  const color = colorInput.value || DEFAULT_PERSON_COLOR;

  if (!name) {
    showAlert('Validation Error', 'Please enter a name');
    return;
  }

  try {
    if (editingPersonId) {
      await DB.updateUser(editingPersonId, { full_name: name, color });
      const passwordInput = document.getElementById('new-person-password');
      if (passwordInput && passwordInput.value) {
        const newPass = passwordInput.value;
        if (newPass.length < 8) {
          showAlert('Validation Error', 'Password must be at least 8 characters long.');
          return;
        }
        await DB.resetUserPassword(editingPersonId, newPass);
      }
    } else {
      await UsersAPI.create({
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@letsee.local`,
        password: 'temppass123',
        full_name: name,
        color,
        is_admin: false,
      });
    }

    resetPersonForm();
    await refreshPeopleViews();
  } catch (error) {
    console.error('Error saving person:', error);
    const msg = error.message || '';
    if (msg.includes('same as the current') || msg.includes('New password cannot')) {
      showAlert('Validation Error', msg);
    } else {
      showAlert('Error', error.message || 'Failed to save staff member. Please try again.');
    }
  }
}

async function deletePerson(id, name) {
  showConfirm(
    'Delete Staff Member',
    `Are you sure you want to delete ${name}? This action cannot be undone.`,
    async () => {
      try {
        await UsersAPI.delete(id);
        if (String(editingPersonId) === String(id)) {
          resetPersonForm();
        }
        await refreshPeopleViews();
      } catch (error) {
        console.error('Error deleting person:', error);
        showAlert('Error', error.message || 'Failed to delete staff member. Please try again.');
      }
    }
  );
}
