// Schedule Management Script

// ============================================
// DEVELOPMENT MODE TOGGLE
// Set to false when backend is ready
// ============================================
const DEV_MODE = true;

// State
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let selectedShift = 'A'; // Track which shift is currently selected
let scheduleData = {};
let peopleData = [];
let currentUser = null;
let openDayCell = null;

// Shift definitions
const SHIFTS = {
    A: { name: 'Morning', time: '08:00 - 17:00', color: 'rgba(255, 200, 100, 0.7)' },
    M: { name: 'Middle', time: '11:00 - 20:00', color: 'rgba(150, 200, 255, 0.7)' },
    B: { name: 'Late', time: '15:00 - 00:00', color: 'rgba(255, 150, 150, 0.7)' },
    C: { name: 'Night', time: '00:00 - 08:00', color: 'rgba(150, 150, 200, 0.7)' }
};

// ============================================
// MOCK DATA (for development)
// ============================================
const MOCK_PEOPLE = [
    { id: 1, name: 'Alice Johnson', color: '#3498db' },
    { id: 2, name: 'Bob Smith', color: '#e74c3c' },
    { id: 3, name: 'Carol Davis', color: '#2ecc71' },
    { id: 4, name: 'David Wilson', color: '#f39c12' },
    { id: 5, name: 'Emma Brown', color: '#9b59b6' }
];

const MOCK_SCHEDULES = {
    // Example: '2025-03-15': { shifts: { A: ['Alice Johnson'], M: ['Bob Smith'], B: [], C: [] } }
};

// Mock current user
const MOCK_USER = { id: 1, name: 'Admin User' };

// ============================================
// MOCK API (for development)
// ============================================
const MockDB = {
    init: async () => {
        console.log('[MOCK] DB initialized');
        return Promise.resolve();
    },
    getCurrentUser: async () => {
        console.log('[MOCK] Getting current user');
        return Promise.resolve(MOCK_USER);
    },
    getPeople: async () => {
        console.log('[MOCK] Getting people');
        return Promise.resolve([...MOCK_PEOPLE]);
    },
    getSchedule: async () => {
        console.log('[MOCK] Getting schedules');
        return Promise.resolve({ ...MOCK_SCHEDULES });
    },
    saveSchedule: async (schedule) => {
        console.log('[MOCK] Saving schedule:', schedule);
        // Update mock data
        Object.assign(MOCK_SCHEDULES, schedule);
        return Promise.resolve(schedule);
    },
    logout: () => {
        console.log('[MOCK] Logging out');
        window.location.href = '/';
    }
};

const MockPeopleAPI = {
    create: async (name, color) => {
        console.log('[MOCK] Creating person:', name, color);
        const newPerson = {
            id: MOCK_PEOPLE.length + 1,
            name,
            color
        };
        MOCK_PEOPLE.push(newPerson);
        return Promise.resolve(newPerson);
    },
    list: async () => {
        console.log('[MOCK] Listing people');
        return Promise.resolve([...MOCK_PEOPLE]);
    },
    delete: async (id) => {
        console.log('[MOCK] Deleting person:', id);
        const index = MOCK_PEOPLE.findIndex(p => p.id === id);
        if (index > -1) {
            MOCK_PEOPLE.splice(index, 1);
        }
        return Promise.resolve({ id });
    }
};

const MockSchedulesAPI = {
    list: async (dateStr) => {
        console.log('[MOCK] Listing schedules for:', dateStr);
        const schedule = MOCK_SCHEDULES[dateStr];
        return Promise.resolve(schedule ? [{ id: dateStr, ...schedule }] : []);
    },
    delete: async (id) => {
        console.log('[MOCK] Deleting schedule:', id);
        delete MOCK_SCHEDULES[id];
        return Promise.resolve({ id });
    }
};

// ============================================
// API SELECTOR (switches between mock and real)
// ============================================
const DB = DEV_MODE ? MockDB : window.DB;
const PeopleAPI = DEV_MODE ? MockPeopleAPI : window.PeopleAPI;
const SchedulesAPI = DEV_MODE ? MockSchedulesAPI : window.SchedulesAPI;

// Initialize
async function init() {
    if (DEV_MODE) {
        await MockDB.init();
    } else {
        // PRODUCTION: Uncomment when backend is ready
        // await DB.init();
    }

    await loadCurrentUser();
    await loadPeople();
    await loadSchedules();
    renderCalendar();
    updateClock();
    setInterval(updateClock, 1000);
    applyTheme();
}

// Load current user
async function loadCurrentUser() {
    try {
        currentUser = await DB.getCurrentUser();
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

// Load people
async function loadPeople() {
    try {
        peopleData = await DB.getPeople();
    } catch (error) {
        console.error('Error loading people:', error);
        peopleData = [];
    }
}

// Load schedules for current month
async function loadSchedules() {
    try {
        const allSchedules = await DB.getSchedule();
        scheduleData = allSchedules;
    } catch (error) {
        console.error('Error loading schedules:', error);
        scheduleData = {};
    }
}

// Render calendar
function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYearDisplay = document.getElementById('month-year-display');
    if (monthYearDisplay) {
        monthYearDisplay.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Get first day of month and total days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    // Get previous month days
    const prevLastDay = new Date(currentYear, currentMonth, 0);
    const prevDaysInMonth = prevLastDay.getDate();

    // Today
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    // Render previous month's trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const day = prevDaysInMonth - i;
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const dayEl = createDayElement(day, dateStr, true);
        grid.appendChild(dayEl);
    }

    // Render current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = day === todayDay && currentMonth === todayMonth && currentYear === todayYear;
        const isSelected = dateStr === selectedDate;

        const dayEl = createDayElement(day, dateStr, false, isToday, isSelected);
        grid.appendChild(dayEl);
    }

    // Render next month's leading days
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

    for (let i = 1; i <= remainingCells; i++) {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        const dayEl = createDayElement(i, dateStr, true);
        grid.appendChild(dayEl);
    }
}

// Create day element
function createDayElement(day, dateStr, isOtherMonth, isToday = false, isSelected = false) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';

    if (isOtherMonth) dayEl.classList.add('other-month');
    if (isToday) dayEl.classList.add('today');
    if (isSelected) dayEl.classList.add('selected');

    dayEl.dataset.date = dateStr;
    dayEl.onclick = () => !isOtherMonth && openDayModal(dateStr, dayEl);
    dayEl.onmouseenter = (e) => !isOtherMonth && showHoverPreview(dateStr, e);
    dayEl.onmouseleave = () => hideHoverPreview();

    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayEl.appendChild(dayNumber);

    // Schedule info - Show assignments as pills with initials + shift code
    const schedule = scheduleData[dateStr];
    if (schedule && !isOtherMonth && schedule.shifts) {
        // Create container for assignments
        const gridContainer = document.createElement('div');
        gridContainer.className = 'day-shifts-grid';

        // Show assignments for each shift
        ['A', 'M', 'B', 'C'].forEach(shift => {
            const people = schedule.shifts[shift] || [];

            people.forEach(personName => {
                const person = peopleData.find(p => p.name === personName);
                if (!person) return;

                const initials = getInitials(personName);
                const shiftInfo = SHIFTS[shift];

                const dayShift = document.createElement('div');
                dayShift.className = 'day-shift has-assignment';
                dayShift.style.background = shiftInfo.color.replace('0.7', '0.2');
                dayShift.style.borderLeftColor = person.color;

                // Initials circle
                const initialsCircle = document.createElement('div');
                initialsCircle.className = 'shift-initials-circle';
                initialsCircle.style.background = person.color + '18';
                initialsCircle.style.border = `1px solid ${person.color}44`;
                initialsCircle.style.color = person.color;
                initialsCircle.textContent = initials;
                dayShift.appendChild(initialsCircle);

                // Shift badge
                const shiftBadge = document.createElement('span');
                shiftBadge.className = 'shift-count';
                shiftBadge.style.color = shiftInfo.color.replace('0.7', '1');
                shiftBadge.textContent = shift;
                dayShift.appendChild(shiftBadge);

                gridContainer.appendChild(dayShift);
            });
        });

        dayEl.appendChild(gridContainer);
    }

    return dayEl;
}

// Get initials from name
function getInitials(name) {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// Hover preview state
let hoverPreviewState = null;
const PREVIEW_PAGE_SIZE = 4;

// Show hover preview
function showHoverPreview(dateStr, event) {
    if (selectedDate === dateStr) {
        return;
    }

    const schedule = scheduleData[dateStr] || { shifts: { A: [], M: [], B: [], C: [] } };
    const preview = document.getElementById('hover-preview');
    
    // Initialize or update hover preview state
    if (!hoverPreviewState || hoverPreviewState.dateStr !== dateStr) {
        hoverPreviewState = { dateStr, page: 0 };
    }
    
    // Extract day and month from dateStr
    const dateParts = dateStr.split('-');
    const day = parseInt(dateParts[2]);
    const monthIndex = parseInt(dateParts[1]) - 1;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Set header
    document.getElementById('hover-preview-day').textContent = day;
    document.getElementById('hover-preview-month').textContent = monthNames[monthIndex].toUpperCase();

    // Build staff rows sorted by shift (A, M, B, C)
    const assignedStaff = [];
    
    // Sort by shift order
    ['A', 'M', 'B', 'C'].forEach(shift => {
        const people = schedule.shifts[shift] || [];
        people.forEach(personName => {
            const person = peopleData.find(p => p.name === personName);
            if (person) {
                assignedStaff.push({ person, shift });
            }
        });
    });

    // Render with pagination
    renderHoverPreviewContent(assignedStaff);

    // Show preview temporarily to get actual dimensions
    preview.style.display = 'block';
    preview.style.visibility = 'hidden';

    // Position preview like modal - centered below the cell
    const cellEl = event.target.closest('.calendar-day');
    if (cellEl) {
        const rect = cellEl.getBoundingClientRect();
        const previewDialog = preview.querySelector('.hover-preview-dialog');
        const pw = 240;
        const ph = previewDialog ? previewDialog.offsetHeight : 200;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = rect.left + rect.width / 2 - pw / 2;
        let top = rect.bottom + 8;

        // Keep within viewport horizontally
        if (left + pw > vw - 8) left = vw - pw - 8;
        if (left < 8) left = 8;

        // Keep within viewport vertically - position above if needed
        if (top + ph > vh - 8) {
            // Position above the cell, not at the top of viewport
            top = rect.top - ph - 8;
        }

        // If still doesn't fit, position at top with small margin
        if (top < 8) {
            top = 8;
        }

        preview.style.left = left + 'px';
        preview.style.top = top + 'px';
    }

    // Make preview visible
    preview.style.visibility = 'visible';
}

// Render hover preview content with pagination
function renderHoverPreviewContent(assignedStaff) {
    const content = document.getElementById('hover-preview-content');
    const pagination = document.getElementById('hover-preview-pagination');
    
    if (assignedStaff.length === 0) {
        content.innerHTML = '<div class="preview-no-data">No shifts assigned</div>';
        pagination.style.display = 'none';
        return;
    }
    
    const totalPages = Math.ceil(assignedStaff.length / PREVIEW_PAGE_SIZE);
    const page = hoverPreviewState.page;
    const pageStaff = assignedStaff.slice(page * PREVIEW_PAGE_SIZE, (page + 1) * PREVIEW_PAGE_SIZE);
    
    let html = '';
    pageStaff.forEach((item, idx) => {
        const { person, shift } = item;
        const shiftInfo = SHIFTS[shift];
        const initials = getInitials(person.name);
        
        html += `
            <div class="preview-staff-row">
                <div class="preview-staff-name-row">
                    <div class="preview-staff-avatar"
                        style="background:${person.color}18;border:1px solid ${person.color}44;color:${person.color}">
                        ${initials}
                    </div>
                    <span class="preview-staff-name">${person.name}</span>
                    <span class="preview-staff-shift-badge" style="color:${shiftInfo.color.replace('0.7', '1')}">${shift}</span>
                </div>
            </div>
        `;
        
        // Add divider if not last item on this page
        if (idx < pageStaff.length - 1) {
            html += '<div class="preview-staff-divider"></div>';
        }
    });
    
    content.innerHTML = html;
    
    // Show/hide pagination
    if (totalPages > 1) {
        pagination.style.display = 'flex';
        document.getElementById('preview-page-label').textContent = `${page + 1} / ${totalPages}`;
        document.getElementById('preview-page-prev').disabled = page === 0;
        document.getElementById('preview-page-next').disabled = page === totalPages - 1;
    } else {
        pagination.style.display = 'none';
    }
}

// Hide hover preview
function hideHoverPreview() {
    document.getElementById('hover-preview').style.display = 'none';
    hoverPreviewState = null;
}

// Open day modal
function openDayModal(dateStr, dayEl) {
    if (selectedDate === dateStr) {
        closeDayModal();
        return;
    }

    selectedDate = dateStr;
    openDayCell = dayEl;
    hideHoverPreview();
    modalPageState = 0; // Reset pagination when opening modal
    
    // Extract day and month
    const dateParts = dateStr.split('-');
    const day = parseInt(dateParts[2]);
    const monthIndex = parseInt(dateParts[1]) - 1;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Render modal content
    renderDayModalContent(dateStr, day, monthNames[monthIndex]);

    // Show modal
    const modal = document.getElementById('day-modal');
    modal.style.display = 'flex';

    renderCalendar();
    openDayCell = document.querySelector(`.calendar-day[data-date="${selectedDate}"]`);
    requestAnimationFrame(positionDayModal);
}

// Separate function to render modal content
let modalPageState = 0;
const MODAL_PAGE_SIZE = 4;

function renderDayModalContent(dateStr, day, monthName) {
    const schedule = scheduleData[dateStr] || {
        shifts: { A: [], M: [], B: [], C: [] }
    };
    
    const modalContent = document.getElementById('modal-content');
    
    // Calculate pagination
    const totalStaff = peopleData.length;
    const totalPages = Math.ceil(totalStaff / MODAL_PAGE_SIZE);
    const pageStaff = peopleData.slice(modalPageState * MODAL_PAGE_SIZE, (modalPageState + 1) * MODAL_PAGE_SIZE);
    
    let html = `
        <div class="modal-header">
            <span class="hover-preview-day">${day}</span>
            <span class="hover-preview-month">${monthName.toUpperCase()}</span>
        </div>
        <div class="modal-staff-content">
    `;

    pageStaff.forEach((person, idx) => {
        const initials = getInitials(person.name);
        
        // Find current shift for this person
        let currentShift = 'off';
        for (const [shift, people] of Object.entries(schedule.shifts)) {
            if (people && people.includes(person.name)) {
                currentShift = shift;
                break;
            }
        }
        
        const shiftInfo = currentShift !== 'off' ? SHIFTS[currentShift] : null;
        const badgeHtml = shiftInfo
            ? `<span class="staff-shift-badge" style="color:${shiftInfo.color.replace('0.7', '1')}">${currentShift}</span>`
            : "";

        // Shift option buttons
        const optsHtml = ['A', 'M', 'B', 'C'].map(shift => {
            const shiftData = SHIFTS[shift];
            const isActive = currentShift === shift;
            return `
                <button class="shift-opt${isActive ? ' active' : ''}"
                    style="background:${isActive ? shiftData.color.replace('0.7', '0.2') : 'var(--bg-primary)'};
                           border-color:${isActive ? shiftData.color.replace('0.7', '0.5') : 'var(--border-secondary)'};
                           color:${isActive ? shiftData.color.replace('0.7', '1') : 'var(--text-tertiary)'}"
                    data-person="${person.name}" data-shift="${shift}">
                    ${shift}
                </button>`;
        }).join('');

        const divider = idx < pageStaff.length - 1
            ? `<div class="staff-divider"></div>` : "";

        html += `
            <div class="staff-row">
                <div class="staff-name-row">
                    <div class="staff-avatar"
                        style="background:${person.color}18;border:1px solid ${person.color}44;color:${person.color}">
                        ${initials}
                    </div>
                    <span class="staff-name">${person.name}</span>
                    ${badgeHtml}
                </div>
                <div class="shift-opts">${optsHtml}</div>
                ${divider}
            </div>`;
    });

    html += '</div>';
    
    // Add pagination if needed
    if (totalPages > 1) {
        html += `
            <div class="hover-preview-pagination">
                <button class="preview-page-btn" id="modal-page-prev">‹</button>
                <span class="preview-page-label">${modalPageState + 1} / ${totalPages}</span>
                <button class="preview-page-btn" id="modal-page-next">›</button>
            </div>
        `;
    }
    
    modalContent.innerHTML = html;
    
    // Re-attach event listeners for shift buttons
    modalContent.querySelectorAll('.shift-opt').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const personName = btn.dataset.person;
            const shift = btn.dataset.shift;
            
            if (!scheduleData[selectedDate]) {
                scheduleData[selectedDate] = { shifts: { A: [], M: [], B: [], C: [] } };
            }
            
            const currentSchedule = scheduleData[selectedDate];
            for (const s of ['A', 'M', 'B', 'C']) {
                if (!currentSchedule.shifts[s]) currentSchedule.shifts[s] = [];
            }
            
            for (const s of ['A', 'M', 'B', 'C']) {
                currentSchedule.shifts[s] = currentSchedule.shifts[s].filter(name => name !== personName);
            }
            
            const isCurrentlyActive = btn.classList.contains('active');
            if (!isCurrentlyActive) {
                currentSchedule.shifts[shift].push(personName);
            }
            
            await saveDaySchedule();
            renderDayModalContent(selectedDate, day, monthName);
        });
    });
    
    // Attach pagination handlers
    const prevBtn = document.getElementById('modal-page-prev');
    const nextBtn = document.getElementById('modal-page-next');
    
    if (prevBtn) {
        prevBtn.disabled = modalPageState === 0;
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (modalPageState > 0) {
                modalPageState--;
                renderDayModalContent(dateStr, day, monthName);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.disabled = modalPageState === totalPages - 1;
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (modalPageState < totalPages - 1) {
                modalPageState++;
                renderDayModalContent(dateStr, day, monthName);
            }
        });
    }
}

// Toggle shift section in modal
function toggleShiftSection(header) {
    const staff = header.nextElementSibling;
    staff.style.display = staff.style.display === 'flex' ? 'none' : 'flex';
    header.classList.toggle('collapsed');
}

// Close day modal
function closeDayModal(event) {
    // Only close if clicking on the overlay itself, not the modal dialog
    if (event && event.target.id !== 'day-modal') return;

    document.getElementById('day-modal').style.display = 'none';
    selectedDate = null;
    openDayCell = null;
    renderCalendar();
}

function positionDayModal() {
    const modal = document.getElementById('day-modal');
    const modalDialog = modal.querySelector('.modal-dialog');

    if (!modalDialog || !openDayCell || !selectedDate || modal.style.display === 'none') {
        return;
    }

    const rect = openDayCell.getBoundingClientRect();
    const modalWidth = modalDialog.offsetWidth || 280;
    const modalHeight = modalDialog.offsetHeight || 400;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left + (rect.width / 2) - (modalWidth / 2);
    let top = rect.bottom + 8;

    if (left + modalWidth > viewportWidth - 8) {
        left = viewportWidth - modalWidth - 8;
    }

    if (left < 8) {
        left = 8;
    }

    if (top + modalHeight > viewportHeight - 8) {
        top = rect.top - modalHeight - 8;
    }

    if (top < 8) {
        top = 8;
    }

    modalDialog.style.left = `${left}px`;
    modalDialog.style.top = `${top}px`;
}

// Save day schedule from modal
async function saveDaySchedule() {
    if (!selectedDate) return;

    try {
        // Ensure the schedule exists
        const currentSchedule = scheduleData[selectedDate] || {
            shifts: { A: [], M: [], B: [], C: [] }
        };

        const scheduleToSave = {};
        scheduleToSave[selectedDate] = { shifts: currentSchedule.shifts };

        await DB.saveSchedule(scheduleToSave);

        // Reload schedules and update calendar (keep modal open)
        await loadSchedules();
        renderCalendar();
    } catch (error) {
        console.error('Error saving schedule:', error);
        alert('Failed to save schedule. Please try again.');
    }
}

// Clear day schedule
async function clearDaySchedule() {
    if (!selectedDate) return;

    showConfirm('Clear Schedule', `Are you sure you want to clear all shifts for this day?`, async () => {
        try {
            // Delete from backend
            const existing = await SchedulesAPI.list(selectedDate);
            if (existing && existing.length > 0) {
                await SchedulesAPI.delete(existing[0].id);
            }

            // Remove from local data
            delete scheduleData[selectedDate];

            renderCalendar();
            closeDayModal();
        } catch (error) {
            console.error('Error clearing schedule:', error);
            alert('Failed to clear schedule. Please try again.');
        }
    });
}

// Render staff list (no longer used in modal, kept for compatibility)
function renderStaffList(selectedPeople = []) {
    // This function is no longer used with the new modal approach
}

// Month navigation
function previousMonth() {
    closeDayModal();
    if (currentMonth === 0) {
        currentMonth = 11;
        currentYear--;
    } else {
        currentMonth--;
    }
    renderCalendar();
}

function nextMonth() {
    closeDayModal();
    if (currentMonth === 11) {
        currentMonth = 0;
        currentYear++;
    } else {
        currentMonth++;
    }
    renderCalendar();
}

// Update calendar when month/year changed
document.addEventListener('DOMContentLoaded', () => {
    const monthYearDisplay = document.getElementById('month-year-display');
    if (monthYearDisplay) {
        monthYearDisplay.addEventListener('change', (e) => {
            currentMonth = parseInt(e.target.value);
            renderCalendar();
        });

        monthYearDisplay.addEventListener('change', (e) => {
            currentYear = parseInt(e.target.value);
            renderCalendar();
        });
    }
});

// Clock
function updateClock() {
    const clockEl = document.getElementById('current-time');
    if (clockEl) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${hours}:${minutes}`;
    }
}

// Theme
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('letsee_theme', newTheme);
    updateFavicon(newTheme);
}

function applyTheme() {
    const savedTheme = localStorage.getItem('letsee_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateFavicon(savedTheme);
}

function updateFavicon(theme) {
    const favicon = document.getElementById('favicon');
    if (favicon) {
        const color = theme === 'dark' ? '%23ffffff' : '%23333';
        favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='${color}'>L</text></svg>`;
    }
}

// Logout
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

function handleLogout() {
    showConfirm('Sign Out', 'Are you sure you want to sign out?', () => {
        DB.logout();
    });
}

// ============ People Management ============

async function openPeopleModal() {
    document.getElementById('people-modal').style.display = 'flex';
    await renderPeopleList();
}

document.addEventListener('mousedown', (event) => {
    if (!selectedDate) {
        return;
    }

    const modal = document.getElementById('day-modal');
    const dialog = modal?.querySelector('.modal-dialog');
    const clickedDay = event.target.closest('.calendar-day');

    if (dialog?.contains(event.target)) {
        return;
    }

    if (clickedDay && clickedDay.dataset.date === selectedDate) {
        return;
    }

    closeDayModal();
});

window.addEventListener('resize', () => {
    if (selectedDate) {
        positionDayModal();
    }
});

function closePeopleModal() {
    document.getElementById('people-modal').style.display = 'none';
    document.getElementById('new-person-name').value = '';
    document.getElementById('new-person-color').value = '#3498db';
    // Reload people data
    loadPeople();
}

async function renderPeopleList() {
    await loadPeople();
    const peopleList = document.getElementById('people-list');

    if (peopleData.length === 0) {
        peopleList.innerHTML = '<div class="empty-state">No staff members yet. Add one below!</div>';
        return;
    }

    peopleList.innerHTML = '';

    peopleData.forEach((person, index) => {
        const personEl = document.createElement('div');
        personEl.className = 'person-item';

        personEl.innerHTML = `
            <div class="person-color" style="background-color: ${person.color}"></div>
            <div class="person-info">
                <div class="person-name">${person.name}</div>
                <div class="person-color-code">${person.color}</div>
            </div>
            <div class="person-actions">
                <button class="btn-icon btn-danger" onclick="deletePerson(${person.id}, '${person.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
        `;

        peopleList.appendChild(personEl);
    });
}

async function addPerson() {
    const nameInput = document.getElementById('new-person-name');
    const colorInput = document.getElementById('new-person-color');

    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) {
        alert('Please enter a name');
        return;
    }

    try {
        await PeopleAPI.create(name, color);
        nameInput.value = '';
        colorInput.value = '#3498db';
        await renderPeopleList();
    } catch (error) {
        console.error('Error adding person:', error);
        alert('Failed to add staff member. Please try again.');
    }
}

async function deletePerson(id, name) {
    showConfirm('Delete Staff Member', `Are you sure you want to delete ${name}? This action cannot be undone.`, async () => {
        try {
            await PeopleAPI.delete(id);
            await renderPeopleList();
        } catch (error) {
            console.error('Error deleting person:', error);
            alert('Failed to delete staff member. Please try again.');
        }
    });
}

// Initialize on load
init();

// Hover preview pagination handlers
document.getElementById('preview-page-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    if (hoverPreviewState && hoverPreviewState.page > 0) {
        hoverPreviewState.page--;
        const schedule = scheduleData[hoverPreviewState.dateStr] || { shifts: { A: [], M: [], B: [], C: [] } };
        const assignedStaff = [];
        ['A', 'M', 'B', 'C'].forEach(shift => {
            const people = schedule.shifts[shift] || [];
            people.forEach(personName => {
                const person = peopleData.find(p => p.name === personName);
                if (person) assignedStaff.push({ person, shift });
            });
        });
        renderHoverPreviewContent(assignedStaff);
    }
});

document.getElementById('preview-page-next').addEventListener('click', (e) => {
    e.stopPropagation();
    if (hoverPreviewState) {
        const schedule = scheduleData[hoverPreviewState.dateStr] || { shifts: { A: [], M: [], B: [], C: [] } };
        const assignedStaff = [];
        ['A', 'M', 'B', 'C'].forEach(shift => {
            const people = schedule.shifts[shift] || [];
            people.forEach(personName => {
                const person = peopleData.find(p => p.name === personName);
                if (person) assignedStaff.push({ person, shift });
            });
        });
        const totalPages = Math.ceil(assignedStaff.length / PREVIEW_PAGE_SIZE);
        if (hoverPreviewState.page < totalPages - 1) {
            hoverPreviewState.page++;
            renderHoverPreviewContent(assignedStaff);
        }
    }
});