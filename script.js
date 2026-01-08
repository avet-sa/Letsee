// Storage keys
const STORAGE_KEY_PEOPLE = 'letsee_people';
const STORAGE_KEY_SCHEDULE = 'letsee_schedule';
const STORAGE_KEY_HANDOVER = 'letsee_handover';
const STORAGE_KEY_THEME = 'letsee_theme';
const STORAGE_KEY_LANGUAGE = 'letsee_language';

// Translations
const TRANSLATIONS = {
    en: {
        handover: 'Handover',
        addNote: '+ Add',
        unresolvedImportant: 'UNRESOLVED / IMPORTANT',
        generalNotes: 'GENERAL NOTES',
        actionItems: 'ACTION ITEMS',
        noUnresolved: 'No unresolved items',
        noGeneral: 'No general notes',
        noCompleted: 'No completed actions',
        addNoteTitle: 'Add Note',
        editNoteTitle: 'Edit Note',
        guestName: 'Guest Name',
        roomNumber: 'Room Number',
        type: 'Type',
        note: 'Note',
        followupRequired: 'Follow-up required',
        promisedToGuest: 'Promised to guest',
        whatPromised: 'What was promised?',
        attachments: 'Attachments',
        cancel: 'Cancel',
        save: 'Save',
        edit: 'Edit',
        delete: 'Delete',
        deleteConfirm: 'Delete this note?',
        edited: 'Edited',
        shift: 'Shift',
        search: 'Search notes...',
        sortBy: 'Sort by',
        filterBy: 'Filter',
        sortNewest: 'Newest first',
        sortOldest: 'Oldest first',
        sortRoom: 'Room number',
        filterAll: 'All',
        filterPromised: 'Promised',
        filterFollowup: 'Follow-up',
        optional: 'Optional',
        complaint: 'Complaint',
        request: 'Request',
        billing: 'Billing',
        lateCheckout: 'Late Checkout',
        vip: 'VIP',
        incident: 'Incident',
        info: 'Info'
    },
    ru: {
        handover: 'Передача смены',
        addNote: '+ Добавить',
        unresolvedImportant: 'НЕРЕШЁННОЕ / ВАЖНОЕ',
        generalNotes: 'ОБЩИЕ ЗАМЕТКИ',
        actionItems: 'ВЫПОЛНЕННЫЕ ЗАДАЧИ',
        noUnresolved: 'Нет нерешённых задач',
        noGeneral: 'Нет общих заметок',
        noCompleted: 'Нет выполненных задач',
        addNoteTitle: 'Добавить заметку',
        editNoteTitle: 'Редактировать заметку',
        guestName: 'Имя гостя',
        roomNumber: 'Номер комнаты',
        type: 'Тип',
        note: 'Заметка',
        followupRequired: 'Требуется дальнейшая работа',
        promisedToGuest: 'Обещано гостю',
        whatPromised: 'Что было обещано?',
        attachments: 'Вложения',
        cancel: 'Отмена',
        save: 'Сохранить',
        edit: 'Редактировать',
        delete: 'Удалить',
        deleteConfirm: 'Удалить эту заметку?',
        edited: 'Изменено',
        shift: 'Смена',
        search: 'Поиск заметок...',
        sortBy: 'Сортировать',
        filterBy: 'Фильтр',
        sortNewest: 'Сначала новые',
        sortOldest: 'Сначала старые',
        sortRoom: 'По номеру комнаты',
        filterAll: 'Все',
        filterPromised: 'Обещанные',
        filterFollowup: 'К исполнению',
        optional: 'Необязательно',
        complaint: 'Жалоба',
        request: 'Запрос',
        billing: 'Оплата',
        lateCheckout: 'Поздний выезд',
        vip: 'VIP',
        incident: 'Инцидент',
        info: 'Информация'
    }
};

let currentLanguage = 'en';
let searchQuery = '';
let currentSort = 'newest';
let currentFilter = 'all';
// Quick filter and selection state
let currentQuickFilter = '';
let selectedNotes = new Set();
const DRAFT_KEY = 'letsee_note_draft';

// Initialize database on load
let dbInitialized = false;
async function ensureDB() {
    if (!dbInitialized) {
        await DB.init();
        dbInitialized = true;
    }
}

// Shift colors
const SHIFT_COLORS = {
    'A': 'rgba(255, 200, 100, 0.5)', // Morning - warm yellow
    'M': 'rgba(150, 200, 255, 0.5)', // Middle - sky blue
    'B': 'rgba(255, 150, 150, 0.5)', // Afternoon - soft red
    'C': 'rgba(150, 150, 200, 0.5)'  // Night - dark blue
};

let currentEditingNoteId = null;

// Translation helper
function t(key) {
    return TRANSLATIONS[currentLanguage][key] || key;
}

// Toggle language
async function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'ru' : 'en';
    await DB.saveSetting(STORAGE_KEY_LANGUAGE, currentLanguage);
    updateLanguageUI();
    renderHandoverNotes();
}

// Update UI text
function updateLanguageUI() {
    document.querySelector('.section-header h2').textContent = t('handover');
    document.querySelector('.btn-primary').textContent = t('addNote');
    document.querySelectorAll('.group-header')[0].textContent = t('unresolvedImportant');
    document.querySelectorAll('.group-header')[1].textContent = t('generalNotes');
    document.querySelectorAll('.group-header')[2].textContent = t('actionItems');
    document.getElementById('search-input').placeholder = t('search');
    document.getElementById('sort-select').options[0].text = t('sortNewest');
    document.getElementById('sort-select').options[1].text = t('sortOldest');
    document.getElementById('sort-select').options[2].text = t('sortRoom');
    document.getElementById('filter-select').options[0].text = t('filterAll');
    document.getElementById('filter-select').options[1].text = t('filterPromised');
    document.getElementById('filter-select').options[2].text = t('filterFollowup');
}

// Get people from database
async function getPeople() {
    await ensureDB();
    return await DB.getPeople();
}

// Get schedule from database
async function getSchedule() {
    await ensureDB();
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
}

// Get notes for current date
async function getNotesForDate(dateKey) {
    const allNotes = await getHandoverNotes();
    return allNotes[dateKey] || [];
}

async function renderHandoverNotes() {
    const dateKey = currentDate.toISOString().split('T')[0];
    let notes = await getNotesForDate(dateKey);
    
    const unresolvedList = document.getElementById('unresolved-list');
    const generalList = document.getElementById('general-list');
    const actionsList = document.getElementById('actions-list');
    const emptyState = document.getElementById('empty-state');
    
    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        notes = notes.filter(n => 
            n.text.toLowerCase().includes(query) ||
            (n.room && n.room.toLowerCase().includes(query)) ||
            (n.guestName && n.guestName.toLowerCase().includes(query)) ||
            n.category.toLowerCase().includes(query)
        );
    }
    
    // Apply category filter
    if (currentFilter === 'promised') {
        notes = notes.filter(n => n.promised);
    } else if (currentFilter === 'followup') {
        notes = notes.filter(n => n.followup);
    }
    // Apply quick filters
    // Need schedule/currentShift for 'myShift'
    const schedule = await getSchedule();
    const daySchedule = schedule[dateKey] || {};
    const currentShift = daySchedule.shift || 'A';
    if (currentQuickFilter === 'myShift') {
        notes = notes.filter(n => (n.shift || currentShift) === currentShift);
    } else if (currentQuickFilter === 'todaysUrgent') {
        notes = notes.filter(n => n.promised || n.followup);
    } else if (currentQuickFilter === 'openItems') {
        notes = notes.filter(n => !n.completed);
    }
    
    // Apply sorting
    if (currentSort === 'newest') {
        notes.sort((a, b) => b.timestamp - a.timestamp);
    } else if (currentSort === 'oldest') {
        notes.sort((a, b) => a.timestamp - b.timestamp);
    } else if (currentSort === 'room') {
        notes.sort((a, b) => {
            const roomA = a.room || '';
            const roomB = b.room || '';
            return roomA.localeCompare(roomB, undefined, { numeric: true });
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
    
    // Get shift people once for all notes
    const shiftPeople = await getCurrentShiftPeople();
    
    // Group notes
    const unresolved = notes.filter(n => !n.completed && (n.promised || n.followup));
    const general = notes.filter(n => !n.completed && !n.promised && !n.followup);
    const actions = notes.filter(n => n.completed);
    
    // Render each group
    unresolvedList.innerHTML = unresolved.length > 0 ? unresolved.map(n => renderNote(n, shiftPeople)).join('') : `<div class="empty-group">${t('noUnresolved')}</div>`;
    generalList.innerHTML = general.length > 0 ? general.map(n => renderNote(n, shiftPeople)).join('') : `<div class="empty-group">${t('noGeneral')}</div>`;
    actionsList.innerHTML = actions.length > 0 ? actions.map(n => renderNote(n, shiftPeople)).join('') : `<div class="empty-group">${t('noCompleted')}</div>`;

    // Update bulk UI after render
    updateBulkUI();
}

// Render individual note
function renderNote(note, shiftPeople = '') {
    const timestamp = new Date(note.timestamp);
    const timeStr = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const classes = ['handover-item'];
    if (note.completed) classes.push('completed');
    if (note.promised) classes.push('has-promise');
    if (note.followup) classes.push('has-followup');
    if (note.promised && note.followup) classes.push('has-both-warnings');

    // Top badges (category, promise, followup)
    const catClass = `category-${(note.category || 'info').toString().toLowerCase().replace(/\s+/g, '-')}`;
    const topBadges = [];
    topBadges.push(`<span class="category-badge ${catClass}">${t(note.category)}</span>`);
    if (note.promised) topBadges.push(`<span class="warning-badge promise">${t('promisedToGuest').toUpperCase()}</span>`);
    if (note.followup) topBadges.push(`<span class="warning-badge followup">${t('followupRequired').toUpperCase()}</span>`);

    // Inline badges (room, guest) - will appear near the text
    const inlineBadges = [];
    if (note.room) inlineBadges.push(`<span class="room-badge-inline">${note.room}</span>`);
    if (note.guestName) inlineBadges.push(`<span class="guest-badge-inline">${note.guestName}</span>`);

    const shiftInfo = note.shift || 'A';
    // Use note's addedBy if shiftPeople is empty
    const peopleDisplay = shiftPeople || note.addedBy || 'Staff';
    const editInfo = note.editedAt ? `<div class="edit-info">${t('edited')}: ${new Date(note.editedAt).toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} by ${note.editedBy || 'Staff'}</div>` : '';
    const attachments = note.attachments && note.attachments.length > 0 ? `<div class="attachments">${note.attachments.map(att => {
        if (att.url && att.url.startsWith && att.url.startsWith('data:image')) {
            return `<a href="${att.url}" target="_blank" class="attachment-link" title="${att.name}">🖼️ ${att.name}</a>`;
        } else {
            return `<a href="${att.url}" target="_blank" class="attachment-link">📎 ${att.name}</a>`;
        }
    }).join('')}</div>` : '';

    // Due label
    let dueLabel = '';
    if (note.dueDate) {
        const dueDt = new Date(`${note.dueDate}T${note.dueTime || '00:00'}`);
        const now = new Date();
        if (dueDt < now) {
            dueLabel = `<span class="due-label">OVERDUE ${dueDt.toLocaleString()}</span>`;
        } else {
            const diffMs = dueDt - now;
            const hrs = Math.floor(diffMs / (1000 * 60 * 60));
            dueLabel = `<span class="due-label">Due in ${hrs}h</span>`;
        }
    }

    const isChecked = selectedNotes.has(note.id) ? 'checked' : '';

    return `
        <div class="${classes.join(' ')}" data-note-id="${note.id}" draggable="true" ondragstart="onDragStart(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondragover="onDragOver(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)">
            <div class="handover-header">
                <div class="handover-meta">
                    <input type="checkbox" class="select-checkbox" ${isChecked} onchange="toggleSelect('${note.id}', this.checked)">
                    ${topBadges.join('')}
                </div>
                <div class="handover-actions">
                    <button class="btn-icon btn-complete" onclick="toggleComplete('${note.id}')" title="${note.completed ? 'Mark incomplete' : 'Mark complete'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${note.completed ? '<path d="M3 12l6 6 12-12"/>' : '<polyline points="20 6 9 17 4 12"/>'}
                        </svg>
                    </button>
                    <button class="btn-icon btn-edit" onclick="editNote('${note.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteNote('${note.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            ${inlineBadges.length > 0 ? `<div class="inline-badges">${inlineBadges.join('')}</div>` : ''}
            <div class="handover-text">${note.text} ${dueLabel}</div>
            ${note.promiseText ? `<div class="promise-text">→ ${note.promiseText}</div>` : ''}
            ${attachments}
            ${editInfo}
            <div class="handover-footer">
                <span>${timeStr} | ${shiftInfo} ${t('shift')}</span>
                <span>${peopleDisplay}</span>
            </div>
        </div>
    `;
}

// Open add note modal
function openAddNote() {
    currentEditingNoteId = null;
    document.getElementById('modal-title').textContent = t('addNoteTitle');
    document.getElementById('note-form').reset();
    document.getElementById('promise-text-group').style.display = 'none';
    document.getElementById('attachments-list').innerHTML = '';
    // Load draft if present
    loadDraftIntoForm();
    attachAutosaveListeners();
    document.getElementById('draft-indicator').classList.toggle('hidden', !localStorage.getItem(DRAFT_KEY));
    document.getElementById('note-modal').classList.remove('hidden');
}

// Add attachment
function addAttachment() {
    const url = document.getElementById('attachment-url').value.trim();
    if (!url) return;
    
    const attachmentsList = document.getElementById('attachments-list');
    const name = url.split('/').pop().substring(0, 30);
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'attachment-item';
    attachmentDiv.innerHTML = `
        <span>📎 ${name}</span>
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
    `;
    attachmentDiv.dataset.url = url;
    attachmentsList.appendChild(attachmentDiv);
    document.getElementById('attachment-url').value = '';
}

// Handle file selection and convert to data URL
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const attachmentsList = document.getElementById('attachments-list');
        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'attachment-item';
        attachmentDiv.innerHTML = `
            <span>📎 ${file.name}</span>
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
        `;
        attachmentDiv.dataset.url = dataUrl;
        attachmentsList.appendChild(attachmentDiv);
        
        // Reset file input
        event.target.value = '';
    };
    reader.readAsDataURL(file);
}

// Close note modal
function closeNoteModal() {
    document.getElementById('note-modal').classList.add('hidden');
    currentEditingNoteId = null;
}

// Save note
async function saveNote(event) {
    event.preventDefault();
    
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = await getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    const schedule = await getSchedule();
    const daySchedule = schedule[dateKey] || {};
    const currentShift = daySchedule.shift || 'A';
    const people = await getPeople();
    
    // Collect attachments
    const attachmentItems = document.querySelectorAll('#attachments-list .attachment-item');
    const attachments = Array.from(attachmentItems).map(item => ({
        url: item.dataset.url,
        name: item.querySelector('span').textContent.replace('📎 ', '')
    }));
    
    const assignedPeople = daySchedule.people || [];
    const noteData = {
        id: currentEditingNoteId || Date.now().toString(),
        category: document.getElementById('note-category').value,
        room: document.getElementById('note-room').value,
        guestName: document.getElementById('note-guest').value,
        text: document.getElementById('note-text').value,
        followup: document.getElementById('note-followup').checked,
        promised: document.getElementById('note-promised').checked,
        promiseText: document.getElementById('note-promised').checked ? document.getElementById('promise-text').value : '',
        attachments: attachments,
        timestamp: currentEditingNoteId ? 
            dateNotes.find(n => n.id === currentEditingNoteId)?.timestamp || Date.now() : 
            Date.now(),
        completed: false,
        addedBy: assignedPeople.length > 0 ? assignedPeople.join(' & ') : (people[0]?.name || 'Staff'),
        dueDate: document.getElementById('note-due-date').value || '',
        dueTime: document.getElementById('note-due-time').value || '',
        shift: currentEditingNoteId ? 
            dateNotes.find(n => n.id === currentEditingNoteId)?.shift || currentShift : 
            currentShift
    };
    
    if (currentEditingNoteId) {
        const index = dateNotes.findIndex(n => n.id === currentEditingNoteId);
        if (index !== -1) {
            noteData.editedAt = Date.now();
            // Get current shift people for editedBy
            const assignedPeople = daySchedule.people || [];
            if (assignedPeople.length > 0) {
                noteData.editedBy = assignedPeople.join(' & ');
            } else if (people.length >= 2) {
                noteData.editedBy = people.slice(0, 2).map(p => p.name).join(' & ');
            } else {
                noteData.editedBy = people[0]?.name || 'Staff';
            }
            dateNotes[index] = { ...dateNotes[index], ...noteData };
        }
    } else {
        dateNotes.push(noteData);
    }
    
    allNotes[dateKey] = dateNotes;
    await saveHandoverNotes(allNotes);
    // Clear draft after successful save
    localStorage.removeItem(DRAFT_KEY);
    document.getElementById('draft-indicator').classList.add('hidden');
    closeNoteModal();
    renderHandoverNotes();
}

// Edit note
async function editNote(noteId) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const notes = await getNotesForDate(dateKey);
    const note = notes.find(n => n.id === noteId);
    
    if (!note) return;
    
    currentEditingNoteId = noteId;
    document.getElementById('modal-title').textContent = t('editNoteTitle');
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
        note.attachments.forEach(att => {
            const attachmentDiv = document.createElement('div');
            attachmentDiv.className = 'attachment-item';
            attachmentDiv.innerHTML = `
                <span>📎 ${att.name}</span>
                <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
            `;
            attachmentDiv.dataset.url = att.url;
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
    
    document.getElementById('note-modal').classList.remove('hidden');
}

// Delete note
async function deleteNote(noteId) {
    if (!confirm(t('deleteConfirm'))) return;
    
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = await getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    
    allNotes[dateKey] = dateNotes.filter(n => n.id !== noteId);
    await saveHandoverNotes(allNotes);
    
    renderHandoverNotes();
}

// Toggle complete status
async function toggleComplete(noteId) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = await getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    
    const note = dateNotes.find(n => n.id === noteId);
    if (note) {
        note.completed = !note.completed;
        allNotes[dateKey] = dateNotes;
        await saveHandoverNotes(allNotes);
        renderHandoverNotes();
    }
}

// Update people block with gradient
async function getCurrentShiftPeople() {
    const people = await getPeople();
    const dateKey = currentDate.toISOString().split('T')[0];
    const schedule = await getSchedule();
    const daySchedule = schedule[dateKey] || {};
    const assignedPeople = daySchedule.people || [];
    
    if (assignedPeople.length > 0) {
        return assignedPeople.join(' & ');
    } else if (people.length >= 2) {
        return people.slice(0, 2).map(p => p.name).join(' & ');
    }
    return '';
}

async function updatePeopleBlock() {
    const people = await getPeople();
    const dateKey = currentDate.toISOString().split('T')[0];
    const schedule = await getSchedule();
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

// Quick filter application
function applyQuickFilter(filter) {
    currentQuickFilter = filter || '';
    // Update active button styles
    document.querySelectorAll('.quick-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderHandoverNotes();
}

// Bulk selection UI
function updateBulkUI() {
    const bulk = document.getElementById('bulk-actions');
    const count = selectedNotes.size;
    const bulkCount = document.getElementById('bulk-count');
    if (count > 0) {
        bulk.classList.remove('hidden');
        bulkCount.textContent = `${count} selected`;
    } else {
        bulk.classList.add('hidden');
        bulkCount.textContent = '0 selected';
    }
}

function toggleSelect(id, checked) {
    if (checked) selectedNotes.add(id);
    else selectedNotes.delete(id);
    updateBulkUI();
}

function clearSelection() {
    selectedNotes.clear();
    // Re-render to remove check marks
    renderHandoverNotes();
}

async function bulkDelete() {
    if (selectedNotes.size === 0) return;
    if (!confirm(`Delete ${selectedNotes.size} selected notes?`)) return;
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = await getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    allNotes[dateKey] = dateNotes.filter(n => !selectedNotes.has(n.id));
    await saveHandoverNotes(allNotes);
    selectedNotes.clear();
    renderHandoverNotes();
}

async function bulkToggleComplete() {
    if (selectedNotes.size === 0) return;
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = await getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    dateNotes.forEach(n => {
        if (selectedNotes.has(n.id)) n.completed = !n.completed;
    });
    allNotes[dateKey] = dateNotes;
    await saveHandoverNotes(allNotes);
    selectedNotes.clear();
    renderHandoverNotes();
}

// Reorder notes (drag-drop)
async function reorderNotes(draggedId, targetId) {
    if (draggedId === targetId) return;
    const dateKey = currentDate.toISOString().split('T')[0];
    const allNotes = await getHandoverNotes();
    const dateNotes = allNotes[dateKey] || [];
    const from = dateNotes.findIndex(n => n.id === draggedId);
    const to = dateNotes.findIndex(n => n.id === targetId);
    if (from === -1 || to === -1) return;
    const [item] = dateNotes.splice(from, 1);
    dateNotes.splice(to, 0, item);
    allNotes[dateKey] = dateNotes;
    await saveHandoverNotes(allNotes);
    renderHandoverNotes();
}

// Drag handlers (delegated via attributes)
function onDragStart(e) {
    const el = e.target.closest('.handover-item');
    if (!el) return;
    e.dataTransfer.setData('text/plain', el.dataset.noteId);
    try { e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    el.classList.add('dragging');
}
function onDragEnter(e) {
    e.preventDefault();
    const el = e.target.closest('.handover-item');
    if (el) el.classList.add('drag-over');
}

function onDragOver(e) {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
    const el = e.target.closest('.handover-item');
    if (el && !el.classList.contains('drag-over')) el.classList.add('drag-over');
}

function onDragLeave(e) {
    const el = e.target.closest('.handover-item');
    if (el) el.classList.remove('drag-over');
}

function onDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.handover-item');
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!target || !draggedId) return;
    const targetId = target.dataset.noteId;
    // remove visual
    document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
    document.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging'));
    reorderNotes(draggedId, targetId);
}

function onDragEnd(e) {
    document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
    document.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging'));
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
        dueTime: document.getElementById('note-due-time').value
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    document.getElementById('draft-indicator').classList.remove('hidden');
}

let _draftTimeout = null;
function saveDraftDebounced() {
    if (_draftTimeout) clearTimeout(_draftTimeout);
    _draftTimeout = setTimeout(saveDraft, 500);
}

function loadDraftIntoForm() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
        const draft = JSON.parse(raw);
        document.getElementById('note-category').value = draft.category || 'info';
        document.getElementById('note-room').value = draft.room || '';
        document.getElementById('note-guest').value = draft.guestName || '';
        document.getElementById('note-text').value = draft.text || '';
        document.getElementById('note-followup').checked = !!draft.followup;
        document.getElementById('note-promised').checked = !!draft.promised;
        document.getElementById('promise-text').value = draft.promiseText || '';
        document.getElementById('note-due-date').value = draft.dueDate || '';
        document.getElementById('note-due-time').value = draft.dueTime || '';
        if (draft.promised) document.getElementById('promise-text-group').style.display = 'block';
    } catch (e) {
        console.warn('Invalid draft', e);
    }
}

function attachAutosaveListeners() {
    ['note-category','note-room','note-guest','note-text','note-followup','note-promised','promise-text','note-due-date','note-due-time','attachment-url'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeEventListener('input', saveDraftDebounced);
        el.addEventListener('input', saveDraftDebounced);
        el.removeEventListener('change', saveDraftDebounced);
        el.addEventListener('change', saveDraftDebounced);
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); openAddNote(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('search-input').focus(); }
    if (e.key === 'Escape') { closeNoteModal(); }
    // quick category selection while modal open
    if (!document.getElementById('note-modal').classList.contains('hidden')) {
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && n >=1 && n <=7) {
            const sel = document.getElementById('note-category');
            if (sel && sel.options[n-1]) sel.selectedIndex = n-1;
        }
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
    document.getElementById('current-date').textContent = currentDate.toLocaleDateString('en-US', options);
    updatePeopleBlock();
    renderHandoverNotes();
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    updateDateDisplay();
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
            themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        } else {
            themeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
        }
    }
}

// Load theme on startup
async function loadTheme() {
    const savedTheme = await DB.getSetting(STORAGE_KEY_THEME) || 'light';
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
document.addEventListener('DOMContentLoaded', async () => {
    await ensureDB();
    await loadTheme();
    
    // Load language
    currentLanguage = await DB.getSetting(STORAGE_KEY_LANGUAGE) || 'en';
    updateLanguageUI();
    
    // Initial render
    await updatePeopleBlock();
    await renderHandoverNotes();
    
    document.getElementById('note-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'note-modal') {
            closeNoteModal();
        }
    });
    
    // Toggle promise text field visibility
    document.getElementById('note-promised')?.addEventListener('change', (e) => {
        document.getElementById('promise-text-group').style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Search handler
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderHandoverNotes();
    });
    
    // Sort handler
    document.getElementById('sort-select')?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderHandoverNotes();
    });
    
    // Filter handler
    document.getElementById('filter-select')?.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderHandoverNotes();
    });
});

// Update time immediately and then every second
updateTime();
setInterval(updateTime, 1000);
updateDateDisplay();
// updateFooterDate();
