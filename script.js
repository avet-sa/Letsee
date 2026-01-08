// Storage keys
const STORAGE_KEY_PEOPLE = 'letsee_people';
const STORAGE_KEY_SCHEDULE = 'letsee_schedule';
const STORAGE_KEY_HANDOVER = 'letsee_handover';
const STORAGE_KEY_THEME = 'letsee_theme';

// Shift colors
const SHIFT_COLORS = {
    'A': 'rgba(255, 200, 100, 0.5)', // Morning - warm yellow
    'M': 'rgba(150, 200, 255, 0.5)', // Middle - sky blue
    'B': 'rgba(255, 150, 150, 0.5)', // Afternoon - soft red
    'C': 'rgba(150, 150, 200, 0.5)'  // Night - dark blue
};

let currentEditingNoteId = null;

// Get people from localStorage
function getPeople() {
    const stored = localStorage.getItem(STORAGE_KEY_PEOPLE);
    return stored ? JSON.parse(stored) : [];
}

// Get schedule from localStorage
function getSchedule() {
    const stored = localStorage.getItem(STORAGE_KEY_SCHEDULE);
    return stored ? JSON.parse(stored) : {};
}

// Get handover notes from localStorage
function getHandoverNotes() {
    const stored = localStorage.getItem(STORAGE_KEY_HANDOVER);
    return stored ? JSON.parse(stored) : {};
}

// Save handover notes to localStorage
function saveHandoverNotes(notes) {
    localStorage.setItem(STORAGE_KEY_HANDOVER, JSON.stringify(notes));
}

// Get notes for current date
function getNotesForDate(dateKey) {
    const allNotes = getHandoverNotes();
    return allNotes[dateKey] || [];
}

// Render handover notes with grouping
function renderHandoverNotes() {
    const dateKey = currentDate.toISOString().split('T')[0];
    const notes = getNotesForDate(dateKey);
    
    const unresolvedList = document.getElementById('unresolved-list');
    const generalList = document.getElementById('general-list');
    const actionsList = document.getElementById('actions-list');
    const emptyState = document.getElementById('empty-state');
    
    if (notes.length === 0) {
        unresolvedList.innerHTML = '';
        generalList.innerHTML = '';
        actionsList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Group notes
    const unresolved = notes.filter(n => !n.completed && (n.promised || n.followup));
    const general = notes.filter(n => !n.completed && !n.promised && !n.followup);
    const actions = notes.filter(n => n.completed);
    
    // Render each group
    unresolvedList.innerHTML = unresolved.length > 0 ? unresolved.map(renderNote).join('') : '<div class="empty-group">No unresolved items</div>';
    generalList.innerHTML = general.length > 0 ? general.map(renderNote).join('') : '<div class="empty-group">No general notes</div>';
    actionsList.innerHTML = actions.length > 0 ? actions.map(renderNote).join('') : '<div class="empty-group">No completed actions</div>';
}

// Render individual note
function renderNote(note) {
    const timestamp = new Date(note.timestamp);
    const timeStr = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const classes = ['handover-item'];
    if (note.completed) classes.push('completed');
    if (note.promised) classes.push('has-promise');
    if (note.followup) classes.push('has-followup');
    
    const badges = [];
    badges.push(`<span class="category-badge">${note.category}</span>`);
    if (note.room) badges.push(`<span class="room-badge">${note.room}</span>`);
    if (note.promised) badges.push(`<span class="promise-badge">PROMISED</span>`);
    if (note.followup) badges.push(`<span class="followup-badge">FOLLOW-UP</span>`);
    
    const shiftInfo = note.shift || 'A';
    const editInfo = note.editedAt ? `<div class="edit-info">Edited: ${new Date(note.editedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} by ${note.editedBy || 'Staff'}</div>` : '';
    
    return `
        <div class="${classes.join(' ')}" data-note-id="${note.id}">
            <div class="handover-header">
                <div class="handover-meta">
                    ${badges.join('')}
                </div>
                <div class="handover-actions">
                    <button class="btn-icon" onclick="toggleComplete('${note.id}')" title="${note.completed ? 'Mark incomplete' : 'Mark complete'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${note.completed ? '<path d="M3 12l6 6 12-12"/>' : '<polyline points="20 6 9 17 4 12"/>'}
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="editNote('${note.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="deleteNote('${note.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="handover-text">${note.text}</div>
            ${note.promiseText ? `<div class="promise-text">→ ${note.promiseText}</div>` : ''}
            ${editInfo}
            <div class="handover-footer">
                <span>${timeStr} | ${shiftInfo} Shift</span>
                <span>${getCurrentShiftPeople()}</span>
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
    document.getElementById('note-modal').classList.remove('hidden');
}

// Close note modal
function closeNoteModal() {
    document.getElementById('note-modal').classList.add('hidden');
    currentEditingNoteId = null;
}

// Save note
function saveNote(event) {
    event.preventDefault();
    
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    const schedule = getSchedule();
    const daySchedule = schedule[dateKey] || {};
    const currentShift = daySchedule.shift || 'A';
    
    const noteData = {
        id: currentEditingNoteId || Date.now().toString(),
        category: document.getElementById('note-category').value,
        room: document.getElementById('note-room').value,
        text: document.getElementById('note-text').value,
        followup: document.getElementById('note-followup').checked,
        promised: document.getElementById('note-promised').checked,
        promiseText: document.getElementById('note-promised').checked ? document.getElementById('promise-text').value : '',
        timestamp: currentEditingNoteId ? 
            dateNotes.find(n => n.id === currentEditingNoteId)?.timestamp || Date.now() : 
            Date.now(),
        completed: false,
        addedBy: getPeople()[0]?.name || 'Staff',
        shift: currentEditingNoteId ? 
            dateNotes.find(n => n.id === currentEditingNoteId)?.shift || currentShift : 
            currentShift
    };
    
    if (currentEditingNoteId) {
        const index = dateNotes.findIndex(n => n.id === currentEditingNoteId);
        if (index !== -1) {
            noteData.editedAt = Date.now();
            noteData.editedBy = getPeople()[0]?.name || 'Staff';
            dateNotes[index] = { ...dateNotes[index], ...noteData };
        }
    } else {
        dateNotes.push(noteData);
    }
    
    allNotes[dateKey] = dateNotes;
    saveHandoverNotes(allNotes);
    
    closeNoteModal();
    renderHandoverNotes();
}

// Edit note
function editNote(noteId) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const notes = getNotesForDate(dateKey);
    const note = notes.find(n => n.id === noteId);
    
    if (!note) return;
    
    currentEditingNoteId = noteId;
    document.getElementById('modal-title').textContent = 'Edit Note';
    document.getElementById('note-category').value = note.category;
    document.getElementById('note-room').value = note.room || '';
    document.getElementById('note-text').value = note.text;
    document.getElementById('note-followup').checked = note.followup || false;
    document.getElementById('note-promised').checked = note.promised || false;
    document.getElementById('promise-text').value = note.promiseText || '';
    
    if (note.promised) {
        document.getElementById('promise-text-group').style.display = 'block';
    }
    
    document.getElementById('note-modal').classList.remove('hidden');
}

// Delete note
function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return;
    
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    
    allNotes[dateKey] = dateNotes.filter(n => n.id !== noteId);
    saveHandoverNotes(allNotes);
    
    renderHandoverNotes();
}

// Toggle complete status
function toggleComplete(noteId) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    
    const note = dateNotes.find(n => n.id === noteId);
    if (note) {
        note.completed = !note.completed;
        allNotes[dateKey] = dateNotes;
        saveHandoverNotes(allNotes);
        renderHandoverNotes();
    }
}

// Update people block with gradient
function getCurrentShiftPeople() {
    const people = getPeople();
    const dateKey = currentDate.toISOString().split('T')[0];
    const schedule = getSchedule();
    const daySchedule = schedule[dateKey] || {};
    const assignedPeople = daySchedule.people || [];
    
    if (assignedPeople.length > 0) {
        return assignedPeople.join(' & ');
    } else if (people.length >= 2) {
        return people.slice(0, 2).map(p => p.name).join(' & ');
    }
    return '';
}

function updatePeopleBlock() {
    const people = getPeople();
    const dateKey = currentDate.toISOString().split('T')[0];
    const schedule = getSchedule();
    const daySchedule = schedule[dateKey] || {};
    
    // Get current shift (default to 'A')
    const currentShift = daySchedule.shift || 'A';
    const assignedPeople = daySchedule.people || [];
    
    const peopleNames = document.getElementById('people-names');
    const shiftName = document.getElementById('shift-name');
    
    if (assignedPeople.length > 0) {
        // Find people objects
        const selectedPeople = assignedPeople.map(name => 
            people.find(p => p.name === name)
        ).filter(p => p);
        
        if (selectedPeople.length === 1) {
            peopleNames.textContent = selectedPeople[0].name.toUpperCase();
        } else if (selectedPeople.length >= 2) {
            peopleNames.textContent = selectedPeople.map(p => p.name.toUpperCase()).join(' & ');
        }
    } else if (people.length >= 2) {
        // Default: show first two people
        peopleNames.textContent = `${people[0].name.toUpperCase()} & ${people[1].name.toUpperCase()}`;
    }
    
    // Update shift name
    shiftName.textContent = currentShift.toUpperCase() + ' SHIFT';
}

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
    document.getElementById('current-date').textContent = currentDate.toLocaleDateString('en-US', options);
    updatePeopleBlock();
    renderHandoverNotes();
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    updateDateDisplay();
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
}

// Load theme on startup
function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Date picker functions
function toggleDatePicker() {
    const picker = document.getElementById('date-picker');
    const dateKey = currentDate.toISOString().split('T')[0];
    picker.value = dateKey;
    picker.style.display = 'block';
    picker.style.position = 'absolute';
    picker.focus();
    picker.showPicker();
}

function selectDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    currentDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    updateDateDisplay();
    document.getElementById('date-picker').style.display = 'none';
}

// Close modal on outside click
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    
    document.getElementById('note-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'note-modal') {
            closeNoteModal();
        }
    });
    
    // Toggle promise text field visibility
    document.getElementById('note-promised')?.addEventListener('change', (e) => {
        document.getElementById('promise-text-group').style.display = e.target.checked ? 'block' : 'none';
    });
});

// Update time immediately and then every second
updateTime();
setInterval(updateTime, 1000);
updateDateDisplay();
// updateFooterDate();
