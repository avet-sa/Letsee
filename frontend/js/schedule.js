// Schedule Management Script

// State
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let selectedShift = 'A'; // Track which shift is currently selected
let scheduleData = {};
let peopleData = [];
let currentUser = null;

// Shift definitions
const SHIFTS = {
    A: { name: 'Morning', time: '08:00 - 17:00', color: 'rgba(255, 200, 100, 0.7)' },
    M: { name: 'Middle', time: '11:00 - 20:00', color: 'rgba(150, 200, 255, 0.7)' },
    B: { name: 'Late', time: '15:00 - 00:00', color: 'rgba(255, 150, 150, 0.7)' },
    C: { name: 'Night', time: '00:00 - 08:00', color: 'rgba(150, 150, 200, 0.7)' }
};

// Initialize
async function init() {
    await DB.init();
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
    const todayStr = today.toISOString().split('T')[0];
    
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
        const isToday = dateStr === todayStr;
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
    dayEl.onclick = (e) => !isOtherMonth && openDayModal(dateStr, e);
    dayEl.onmouseenter = (e) => !isOtherMonth && showHoverPreview(dateStr, e);
    dayEl.onmouseleave = () => hideHoverPreview();
    
    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayEl.appendChild(dayNumber);
    
    // Schedule info - Create 2x2 grid for shift badges
    const schedule = scheduleData[dateStr];
    if (schedule && !isOtherMonth && schedule.shifts) {
        // Create grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'day-shifts-grid';
        
        // Always show all 4 shifts in order A, M, B, C
        ['A', 'M', 'B', 'C'].forEach(shift => {
            const people = schedule.shifts[shift] || [];
            const dayShift = document.createElement('div');
            dayShift.className = 'day-shift';
            
            const badge = document.createElement('span');
            badge.className = `shift-badge shift-${shift.toLowerCase()}`;
            badge.textContent = shift;
            dayShift.appendChild(badge);
            
            // Show count if people assigned
            if (people.length > 0) {
                const count = document.createElement('span');
                count.className = 'shift-count';
                count.textContent = people.length;
                dayShift.appendChild(count);
            }
            
            gridContainer.appendChild(dayShift);
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

// Show hover preview
function showHoverPreview(dateStr, event) {
    const schedule = scheduleData[dateStr] || { shifts: { A: [], M: [], B: [], C: [] } };
    const preview = document.getElementById('hover-preview');
    const content = document.getElementById('hover-preview-content');
    
    let html = '';
    const hasAnyShifts = Object.values(schedule.shifts).some(people => people && people.length > 0);
    
    if (!hasAnyShifts) {
        html = '<div class="preview-no-data">No shifts assigned</div>';
    } else {
        for (const [shift, people] of Object.entries(schedule.shifts)) {
            if (people && people.length > 0) {
                const shiftInfo = SHIFTS[shift];
                html += `
                    <div class="preview-shift">
                        <span class="preview-shift-badge shift-${shift.toLowerCase()}">${shift}</span>
                        <span>${shiftInfo.name}</span>
                    </div>
                    <div class="preview-staff">
                        ${people.map(name => {
                            const person = peopleData.find(p => p.name === name);
                            return `<div style="color: ${person ? person.color : 'inherit'}">${name}</div>`;
                        }).join('')}
                    </div>
                `;
            }
        }
    }
    
    content.innerHTML = html;
    
    // Position preview near cursor
    const x = event.clientX + 10;
    const y = event.clientY + 10;
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
    preview.style.display = 'block';
}

// Hide hover preview
function hideHoverPreview() {
    document.getElementById('hover-preview').style.display = 'none';
}

// Open day modal
function openDayModal(dateStr, event) {
    selectedDate = dateStr;
    hideHoverPreview();
    
    const schedule = scheduleData[dateStr] || { 
        shifts: { A: [], M: [], B: [], C: [] }, 
        edited_by: null, 
        edited_at: null 
    };
    
    // Render shifts in modal
    const modalContent = document.getElementById('modal-content');
    let html = '';
    
    for (const [shift, people] of Object.entries(schedule.shifts)) {
        const shiftInfo = SHIFTS[shift];
        const staffCount = people && people.length > 0 ? people.length : 0;
        
        html += `
            <div class="modal-shift-section">
                <div class="modal-shift-header">
                    <span class="modal-shift-badge shift-${shift.toLowerCase()}">${shift}</span>
                    <span class="modal-shift-name">${shiftInfo.name}</span>
                </div>
                <div class="modal-shift-staff">
                    ${peopleData.map(person => {
                        const isAssigned = people && people.includes(person.name);
                        return `
                            <div class="modal-staff-item">
                                <input type="checkbox" id="staff-${shift}-${person.name}" 
                                       value="${person.name}" ${isAssigned ? 'checked' : ''}>
                                <label for="staff-${shift}-${person.name}">
                                    <span class="modal-staff-color" style="background-color: ${person.color}"></span>
                                    ${person.name}
                                </label>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    modalContent.innerHTML = html;
    
    // Show modal
    const modal = document.getElementById('day-modal');
    modal.style.display = 'flex';
    
    // Position next to cursor (after element is rendered)
    if (event) {
        requestAnimationFrame(() => {
            const x = event.clientX + 15;
            const y = event.clientY + 10;
            const modalDialog = modal.querySelector('.modal-dialog');
            
            let finalX = x;
            let finalY = y;
            
            // Get modal dimensions
            const modalWidth = modalDialog.offsetWidth || 500;
            const modalHeight = modalDialog.offsetHeight || 400;
            
            // Check right edge
            if (x + modalWidth > window.innerWidth) {
                finalX = window.innerWidth - modalWidth - 20;
            }
            
            // Check bottom edge
            if (y + modalHeight > window.innerHeight) {
                finalY = window.innerHeight - modalHeight - 20;
            }
            
            // Ensure minimum position
            finalX = Math.max(10, finalX);
            finalY = Math.max(10, finalY);
            
            modalDialog.style.left = finalX + 'px';
            modalDialog.style.top = finalY + 'px';
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
}

// Save day schedule from modal
async function saveDaySchedule() {
    if (!selectedDate) return;
    
    try {
        const existingSchedule = scheduleData[selectedDate] || { 
            shifts: { A: [], M: [], B: [], C: [] } 
        };
        
        const updatedShifts = {};
        
        for (const shift of ['A', 'M', 'B', 'C']) {
            const checkboxes = document.querySelectorAll(`input[id^="staff-${shift}-"]`);
            const people = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            updatedShifts[shift] = people;
        }
        
        const scheduleToSave = {};
        scheduleToSave[selectedDate] = { shifts: updatedShifts };
        
        await DB.saveSchedule(scheduleToSave);
        
        // Reload schedules
        await loadSchedules();
        renderCalendar();
        closeDayModal();
        
        // Show success feedback
        const saveBtn = document.querySelector('.btn-save');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✓ Saved';
        setTimeout(() => {
            saveBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        console.error('Error saving schedule:', error);
        alert('Failed to save schedule. Please try again.');
    }
}

// Clear day schedule
async function clearDaySchedule() {
    if (!selectedDate) return;
    
    if (!confirm(`Are you sure you want to clear all shifts for this day?`)) return;
    
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
}

// Render staff list (no longer used in modal, kept for compatibility)
function renderStaffList(selectedPeople = []) {
    // This function is no longer used with the new modal approach
}

// Month navigation
function previousMonth() {
    if (currentMonth === 0) {
        currentMonth = 11;
        currentYear--;
    } else {
        currentMonth--;
    }
    renderCalendar();
}

function nextMonth() {
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
    document.getElementById('calendar-month').addEventListener('change', (e) => {
        currentMonth = parseInt(e.target.value);
        renderCalendar();
    });
    
    document.getElementById('calendar-year').addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        renderCalendar();
    });
});

// Clock
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('current-time').textContent = `${hours}:${minutes}`;
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
    const color = theme === 'dark' ? '%23ffffff' : '%23333';
    favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='${color}'>L</text></svg>`;
}

// Logout
function handleLogout() {
    if (confirm('Are you sure you want to sign out?')) {
        DB.logout();
    }
}

// ============ People Management ============

async function openPeopleModal() {
    document.getElementById('people-modal').style.display = 'flex';
    await renderPeopleList();
}

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
                <button class="btn-icon btn-danger" onclick="deletePerson(${index}, '${person.name.replace(/'/g, "\\'")}')">Delete</button>
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

async function deletePerson(index, name) {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    
    try {
        // Get current people from API to get the ID
        const allPeople = await PeopleAPI.list();
        const personToDelete = allPeople.find(p => p.name === name);
        
        if (personToDelete) {
            await PeopleAPI.delete(personToDelete.id);
            await renderPeopleList();
        }
    } catch (error) {
        console.error('Error deleting person:', error);
        alert('Failed to delete staff member. Please try again.');
    }
}

// Initialize on load
init();
