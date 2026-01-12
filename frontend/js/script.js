// Storage keys
const STORAGE_KEY_PEOPLE = 'letsee_people';
const STORAGE_KEY_SCHEDULE = 'letsee_schedule';
const STORAGE_KEY_HANDOVER = 'letsee_handover';
const STORAGE_KEY_THEME = 'letsee_theme';

let searchQuery = '';
let currentSort = 'newest';
let currentFilter = 'all';
// Quick filter and selection state
let currentQuickFilter = '';
let selectedNotes = new Set();
const DRAFT_KEY = 'letsee_note_draft';

// Cache for render performance
let cachedDateData = null;
let cachedDateKey = null;
let cachedSchedule = null;
let cachedShiftPeople = null;

// Initialize database on load
let dbInitialized = false;
async function ensureDB() {
    if (!dbInitialized) {
        await DB.init();
        dbInitialized = true;
    }
}

// Open native date/time picker when clicking custom icon wrapper
function openPicker(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    if (typeof el.showPicker === 'function') {
        el.showPicker();
    } else {
        el.focus();
        el.click();
    }
}

// Logout function
function handleLogout() {
    showConfirm('Sign Out', 'Are you sure you want to sign out?', () => {
        localStorage.removeItem('letsee_access_token');
        localStorage.removeItem('letsee_refresh_token');
        window.location.href = '/login.html';
    });
}

// Shift colors
const SHIFT_COLORS = {
    'A': 'rgba(255, 200, 100, 0.5)', // Morning - warm yellow
    'M': 'rgba(150, 200, 255, 0.5)', // Middle - sky blue
    'B': 'rgba(255, 150, 150, 0.5)', // Afternoon - soft red
    'C': 'rgba(150, 150, 200, 0.5)'  // Night - dark blue
};

let currentEditingNoteId = null;

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
    if (!dateData) return { notes: [], sortOrder: [] };
    if (Array.isArray(dateData)) {
        // Backward compatibility: wrap array
        return { notes: dateData, sortOrder: dateData.map(n => n.id) };
    }
    return dateData;
}

async function renderHandoverNotes(skipCache = false) {
    const dateKey = currentDate.toISOString().split('T')[0];
    
    // Use cache if available and date hasn't changed
    if (!skipCache && cachedDateKey === dateKey && cachedDateData) {
        renderHandoverNotesSync(cachedDateData, cachedSchedule, cachedShiftPeople);
        return;
    }
    
    // Load data and cache it
    const dateData = await getNotesForDate(dateKey);
    const schedule = await getSchedule();
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
    let sortOrder = dateData.sortOrder || [];

    const unresolvedList = document.getElementById('unresolved-list');
    const generalList = document.getElementById('general-list');
    
    // Update active states for sort and filter controls
    updateSortFilterActiveStates();
    const actionsList = document.getElementById('actions-list');
    const emptyState = document.getElementById('empty-state');

    // Apply search filter (includes staff name)
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        notes = notes.filter(n => 
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
        notes = notes.filter(n => n.promised);
    } else if (currentFilter === 'followup') {
        notes = notes.filter(n => n.followup);
    } else if (currentFilter === 'overdue') {
        const now = new Date();
        notes = notes.filter(n => {
            if (!n.dueDate) return false;
            const dueDt = new Date(`${n.dueDate}T${n.dueTime || '00:00'}`);
            return dueDt < now;
        });
    } else if (currentFilter === 'urgent') {
        notes = notes.filter(n => n.promised && n.followup);
    } else if (currentFilter === 'completed') {
        notes = notes.filter(n => n.completed);
    } else if (currentFilter === 'pending') {
        notes = notes.filter(n => !n.completed);
    }
    // Apply quick filters
    // Need schedule/currentShift for 'myShift'
    const daySchedule = schedule[dateKey] || {};
    const currentShift = daySchedule.shift || 'A';
    if (currentQuickFilter === 'myShift') {
        notes = notes.filter(n => (n.shift || currentShift) === currentShift);
    } else if (currentQuickFilter === 'todaysUrgent') {
        notes = notes.filter(n => n.promised || n.followup);
    } else if (currentQuickFilter === 'promised') {
        notes = notes.filter(n => n.promised);
    } else if (currentQuickFilter === 'followup') {
        notes = notes.filter(n => n.followup);
    } else if (currentQuickFilter === 'openItems') {
        notes = notes.filter(n => !n.completed);
    } else if (currentQuickFilter === 'completed') {
        notes = notes.filter(n => n.completed);
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
                    if (diffMs < 0) return 0; // Overdue
                    if (diffMs < 3600000) return 1; // < 1 hour
                    if (diffMs < 86400000) return 2; // < 24 hours
                    return 3; // > 24 hours
                }
                if (note.promised && note.followup) return 1.5;
                if (note.promised || note.followup) return 2.5;
                return 4;
            };
            
            const urgencyA = getUrgency(a);
            const urgencyB = getUrgency(b);
            
            if (urgencyA !== urgencyB) return urgencyA - urgencyB;
            return b.timestamp - a.timestamp; // Then by newest
        });
    } else if (currentSort === 'custom' && sortOrder.length > 0) {
        // Sort notes by sortOrder array
        const notesById = Object.fromEntries(notes.map(n => [n.id, n]));
        notes = sortOrder.map(id => notesById[id]).filter(Boolean);
        // Add any notes not in sortOrder (new notes)
        const missingNotes = notes.filter(n => !sortOrder.includes(n.id));
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
            if (!a.dueDate && !b.dueDate) return a.timestamp - b.timestamp;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            
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
    const unresolved = notes.filter(n => !n.completed && (n.promised || n.followup));
    const general = notes.filter(n => !n.completed && !n.promised && !n.followup);
    const actions = notes.filter(n => n.completed);

    // Render each group, preserving note order for drag-drop
    unresolvedList.innerHTML = unresolved.length > 0 ? unresolved.map(n => renderNote(n, shiftPeople)).join('') : `<div class="empty-group">${'No Unresolved / Important Notes'}</div>`;
    generalList.innerHTML = general.length > 0 ? general.map(n => renderNote(n, shiftPeople)).join('') : `<div class="empty-group">${'No General Notes'}</div>`;
    actionsList.innerHTML = actions.length > 0 ? actions.map(n => renderNote(n, shiftPeople)).join('') : `<div class="empty-group">${'No Completed Notes'}</div>`;

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
    topBadges.push(`<span class="category-badge ${catClass}">${(note.category)}</span>`);
    if (note.promised) topBadges.push(`<span class="warning-badge promise">${('promised To Guest').toUpperCase()}</span>`);
    if (note.followup) topBadges.push(`<span class="warning-badge followup">${('follow-up Required').toUpperCase()}</span>`);

    // Inline badges (room, guest) - will appear near the text
    const inlineBadges = [];
    if (note.room) inlineBadges.push(`<span class="room-badge-inline">${note.room}</span>`);
    if (note.guestName) inlineBadges.push(`<span class="guest-badge-inline">${note.guestName}</span>`);

    const shiftInfo = note.shift || 'A';
    // Use note's addedBy if shiftPeople is empty
    const peopleDisplay = shiftPeople || note.addedBy || 'Staff';
    const editInfo = note.editedAt ? `<div class="edit-info">Edited: ${new Date(note.editedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} by ${note.editedBy || 'Staff'}</div>` : '';
    const attachments = note.attachments && note.attachments.length > 0 ? `<div class="attachments">${note.attachments.map(att => {
        // Support both old format (url) and new format (file_key)
        // Allowed types: images (jpg, jpeg, png, gif, webp, svg) and PDF
        const isAllowedType = att => {
            const filename = (att.filename || att.name || '').toLowerCase();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
            const isPdfExtension = filename.endsWith('.pdf');
            const isImageExtension = imageExtensions.some(ext => filename.endsWith(ext));
            const mimeType = att.mime_type || '';
            const isImageMime = mimeType.startsWith('image/');
            const isPdfMime = mimeType === 'application/pdf';
            return (isImageExtension || isPdfExtension || isImageMime || isPdfMime);
        };

        if (!isAllowedType(att)) {
            return ''; // Skip non-allowed file types
        }

        const filename = att.filename || att.name || 'attachment';
        const isImage = filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

        if (att.file_key) {
            // New Minio format - open in browser with auth header
            const safeName = filename.replace(/'/g, "\\'");
            return `<a href="#" onclick="openAttachment('${att.file_key}','${safeName}','${isImage ? 'image' : 'pdf'}'); return false;" class="attachment-link" title="${safeName}">${isImage ? '🖼️' : '📄'} ${safeName}</a>`;
        } else if (att.url && att.url.startsWith('data:image')) {
            // Old base64 format (image)
            return `<a href="${att.url}" target="_blank" class="attachment-link" title="${filename}">🖼️ ${filename}</a>`;
        } else if (att.url && att.url.includes('data:application/pdf')) {
            // Old base64 format (PDF)
            return `<a href="${att.url}" target="_blank" class="attachment-link" title="${filename}">📄 ${filename}</a>`;
        }
        return ''; // Skip other file types
    }).filter(Boolean).join('')}</div>` : '';

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
            const dateStr = dueDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = dueDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
            <div class="handover-text">${note.text}</div>
            ${inlineBadges.length > 0 ? `<div class="inline-badges">${inlineBadges.join('')}</div>` : ''}
            ${note.promiseText ? `<div class="promise-text">→ ${note.promiseText}</div>` : ''}
            ${attachments}
            ${editInfo}
            <div class="handover-footer">
                <span>${timeStr} | ${shiftInfo} ${'shift'} | ${peopleDisplay}</span>
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
    // Load draft if present
    loadDraftIntoForm();
    attachAutosaveListeners();
    document.getElementById('draft-indicator').classList.toggle('hidden', !localStorage.getItem(DRAFT_KEY));
    document.getElementById('note-modal').classList.remove('hidden');
    // Focus note field and add Enter key handler
    const noteTextarea = document.getElementById('note-text');
    noteTextarea.focus();
    noteTextarea.addEventListener('keydown', handleNoteTextareaEnter, { once: true });
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
        e.target.addEventListener('keydown', handleNoteTextareaEnter, { once: true });
    }
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

// Handle file selection and upload to Minio
async function handleFileSelect(event) {
    console.log('handleFileSelect called', event.target.files);
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    console.log('File selected:', file.name, file.size, file.type);
    
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
            <span>📎 ${file.name}</span>
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
        const blob = await DB.downloadFile(fileKey);
        currentAttachmentBlob = blob;
        currentAttachmentFilename = filename;
        
        const modal = document.getElementById('attachment-modal');
        const preview = document.getElementById('attachment-preview');
        const title = document.getElementById('attachment-modal-title');
        
        title.textContent = filename;
        preview.innerHTML = ''; // Clear previous content
        
        if (type === 'image' || filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            // Display image
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            preview.appendChild(img);
        } else if (type === 'pdf' || filename.toLowerCase().endsWith('.pdf')) {
            // Display PDF in iframe
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
    iframes.forEach(iframe => {
        if (iframe.src) URL.revokeObjectURL(iframe.src);
    });
    const imgs = preview.querySelectorAll('img');
    imgs.forEach(img => {
        if (img.src) URL.revokeObjectURL(img.src);
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
        dateData = { notes: dateData || [], sortOrder: (dateData || []).map(n => n.id) };
    }
    const dateNotes = dateData.notes;
    const sortOrder = dateData.sortOrder;
    const schedule = await getSchedule();
    const daySchedule = schedule[dateKey] || {};
    const currentShift = daySchedule.shift || 'A';
    const people = await getPeople();
    // Collect attachments with file keys
    const attachmentItems = document.querySelectorAll('#attachments-list .attachment-item');
    const attachments = Array.from(attachmentItems).map(item => {
        if (item.dataset.fileKey) {
            return {
                file_key: item.dataset.fileKey,
                filename: item.dataset.filename,
                size: parseInt(item.dataset.size) || 0,
                content_type: item.dataset.contentType || 'application/octet-stream'
            };
        }
        return {
            url: item.dataset.url,
            name: item.dataset.url?.split('/').pop() || 'attachment'
        };
    });
    const assignedPeople = daySchedule.people || [];
    const noteData = {
        id: currentEditingNoteId || generateUUID(),
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
        // Add to sortOrder if not present
        if (!sortOrder.includes(noteData.id)) sortOrder.push(noteData.id);
    }
    allNotes[dateKey] = { notes: dateNotes, sortOrder };
    
    // Clear draft and close modal immediately
    localStorage.removeItem(DRAFT_KEY);
    document.getElementById('draft-indicator').classList.add('hidden');
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
    const notes = Array.isArray(dateData) ? dateData : (dateData.notes || []);
    const note = notes.find(n => n.id === noteId);
    
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
        note.attachments.forEach(att => {
            const attachmentDiv = document.createElement('div');
            attachmentDiv.className = 'attachment-item';
            const displayName = att.filename || att.name || att.url?.split('/').pop() || 'attachment';
            attachmentDiv.innerHTML = `
                <span>📎 ${displayName}</span>
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
    noteTextarea.addEventListener('keydown', handleNoteTextareaEnter, { once: true });
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
        getHandoverNotes().then(allNotes => {
            return getNotesForDate(dateKey).then(dateData => {
                const notes = dateData.notes || [];
                dateData.notes = notes.filter(n => n.id !== noteId);
                dateData.sortOrder = dateData.sortOrder.filter(id => id !== noteId);
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
    if (!noteElement) return;
    
    const isCompleted = noteElement.classList.contains('completed');
    noteElement.classList.toggle('completed');
    
    // Update button icon immediately
    const btn = noteElement.querySelector('.btn-complete svg path, .btn-complete svg polyline');
    if (btn) {
        btn.outerHTML = isCompleted ? 
            '<polyline points="20 6 9 17 4 12"/>' : 
            '<path d="M3 12l6 6 12-12"/>';
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
        const hasWarnings = noteElement.classList.contains('has-promise') || noteElement.classList.contains('has-followup');
        if (hasWarnings) {
            unresolvedList.appendChild(noteElement);
        } else {
            generalList.appendChild(noteElement);
        }
    }
    
    // Save in background (no await to keep it fast)
    const dateKey = currentDate.toISOString().split('T')[0];
    getHandoverNotes().then(allNotes => {
        return getNotesForDate(dateKey).then(dateData => {
            const notes = dateData.notes || [];
            const note = notes.find(n => n.id === noteId);
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
    document.querySelectorAll('.quick-filters .btn-primary').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === currentQuickFilter);
    });
}

// Quick filter application
function applyQuickFilter(filter) {
    currentQuickFilter = filter || '';
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
        if (element) element.classList.remove('selected');
    } else {
        selectedNotes.add(id);
        if (element) element.classList.add('selected');
    }
    updateBulkUI();
}

function clearSelection() {
    selectedNotes.forEach(noteId => {
        const element = document.querySelector(`[data-note-id="${noteId}"]`);
        if (element) element.classList.remove('selected');
    });
    selectedNotes.clear();
    updateBulkUI();
}

async function bulkDelete() {
    if (selectedNotes.size === 0) return;
    if (!confirm(`Delete ${selectedNotes.size} selected notes?`)) return;
    
    const noteIds = Array.from(selectedNotes);
    
    // Remove from DOM immediately
    noteIds.forEach(noteId => {
        const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteElement) {
            noteElement.remove();
        }
    });
    
    selectedNotes.clear();
    updateBulkUI();
    
    // Save in background
    const dateKey = currentDate.toISOString().split('T')[0];
    getHandoverNotes().then(allNotes => {
        return getNotesForDate(dateKey).then(dateData => {
            const notes = dateData.notes || [];
            dateData.notes = notes.filter(n => !noteIds.includes(n.id));
            dateData.sortOrder = dateData.sortOrder.filter(id => !noteIds.includes(id));
            allNotes[dateKey] = dateData;
            return saveHandoverNotes(allNotes);
        });
    });
}

async function bulkToggleComplete() {
    if (selectedNotes.size === 0) return;
    
    const unresolvedList = document.getElementById('unresolved-list');
    const generalList = document.getElementById('general-list');
    const actionsList = document.getElementById('actions-list');
    
    // Store selected IDs before clearing
    const noteIds = Array.from(selectedNotes);
    
    // Update UI immediately for all selected notes
    noteIds.forEach(noteId => {
        const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (!noteElement) return;
        
        const isCompleted = noteElement.classList.contains('completed');
        noteElement.classList.toggle('completed');
        
        // Update button icon
        const btn = noteElement.querySelector('.btn-complete svg path, .btn-complete svg polyline');
        if (btn) {
            btn.outerHTML = isCompleted ? 
                '<polyline points="20 6 9 17 4 12"/>' : 
                '<path d="M3 12l6 6 12-12"/>';
        }
        
        // Move to correct section
        if (!isCompleted) {
            actionsList.appendChild(noteElement);
        } else {
            const hasWarnings = noteElement.classList.contains('has-promise') || noteElement.classList.contains('has-followup');
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
    getHandoverNotes().then(allNotes => {
        return getNotesForDate(dateKey).then(dateData => {
            const notes = dateData.notes || [];
            notes.forEach(n => {
                if (noteIds.includes(n.id)) n.completed = !n.completed;
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
    // Don't trigger shortcuts if user is typing in input fields
    const isInputFocused = document.activeElement.tagName === 'INPUT' || 
                          document.activeElement.tagName === 'TEXTAREA' ||
                          document.activeElement.tagName === 'SELECT';
    
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
    if (e.altKey && e.key.toLowerCase() === 's' && 
        !document.getElementById('note-modal').classList.contains('hidden')) {
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
    if ((e.shiftKey && e.key === '?') || (e.key === '?' && !isInputFocused)) {
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
    document.getElementById('current-date').textContent = currentDate.toLocaleDateString('en-US', options);
    updatePeopleBlock();
    renderHandoverNotes();
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    invalidateRenderCache(); // Cache is date-specific
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
    
    // Update favicon color
    const favicon = document.getElementById('favicon');
    if (favicon) {
        const color = theme === 'dark' ? '%23eee' : '%23333';
        favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='${color}'>L</text></svg>`;
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

// Make functions available globally for inline event handlers
window.handleFileSelect = handleFileSelect;
window.addAttachment = addAttachment;
window.downloadAttachment = downloadAttachment;

// Close modal on outside click
document.addEventListener('DOMContentLoaded', async () => {
    await ensureDB();
    await loadTheme();
    
    // Initial render
    await updatePeopleBlock();
    await renderHandoverNotes();
    
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

// Alert Modal Functions
function showAlert(title, message) {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-modal').style.display = 'flex';
}

function closeAlertModal() {
    document.getElementById('alert-modal').style.display = 'none';
}

// Confirmation Modal Functions
let confirmAction = null;

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').style.display = 'flex';
    confirmAction = onConfirm;
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    confirmAction = null;
}

function executeConfirmAction() {
    if (confirmAction) {
        confirmAction();
    }
    closeConfirmModal();
}

// Update time immediately and then every second
updateTime();
setInterval(updateTime, 1000);
updateDateDisplay();
// updateFooterDate();
