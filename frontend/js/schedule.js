// Schedule Management Script

/** @type {number} */
let currentMonth = new Date().getMonth();
/** @type {number} */
let currentYear = new Date().getFullYear();
/** @type {string|null} */
let selectedDate = null;
/** @type {Object} */
let scheduleData = {};
/** @type {Array} */
let peopleData = [];
/** @type {Object|null} */
let currentUser = null;
/** @type {HTMLElement|null} */
let openDayCell = null;

// Shift definitions
const SHIFTS = {
  A: {
    name: 'Morning',
    time: '08:00 - 17:00',
    color: 'rgba(255, 200, 100, 0.7)',
  },
  M: {
    name: 'Middle',
    time: '11:00 - 20:00',
    color: 'rgba(150, 200, 255, 0.7)',
  },
  B: { name: 'Late', time: '15:00 - 00:00', color: 'rgba(255, 150, 150, 0.7)' },
  C: {
    name: 'Night',
    time: '00:00 - 08:00',
    color: 'rgba(150, 150, 200, 0.7)',
  },
};
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
const SHIFT_ORDER = ['A', 'M', 'B', 'C'];

function getLocalDateKey(d = new Date()) {
  let date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) {
    date = new Date();
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function findPersonByScheduleEntry(entry) {
  const value = String(entry ?? '').trim();
  if (!value) {
    return null;
  }

  return peopleData.find((person) => String(person.id) === value || person.name === value) || null;
}

function getShiftEntries(daySchedule) {
  return daySchedule?.shifts || { A: [], M: [], B: [], C: [] };
}

function getCurrentShiftCode(date = currentDate, daySchedule = null) {
  const targetDate = date instanceof Date ? new Date(date) : new Date(date);
  const targetDateKey = getLocalDateKey(targetDate);
  const todayDateKey = getLocalDateKey();

  if (targetDateKey !== todayDateKey) {
    const shifts = getShiftEntries(daySchedule);
    return SHIFT_ORDER.find((shift) => (shifts[shift] || []).length > 0) || 'A';
  }

  // real now for live shift, independent of viewed date's time component
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
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
  const seen = new Set();
  const names = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'string' || !entry.trim()) {
      continue;
    }
    const person = findPersonByScheduleEntry(entry);
    const name = person ? person.name : String(entry).trim();
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

async function updatePeopleBlock() {
  // Always show live current shift's assigned people using *today's* data, regardless of viewed month
  const todayKey = getLocalDateKey();
  let daySchedule = scheduleData[todayKey] || {};

  if (!daySchedule.shifts || Object.keys(daySchedule.shifts || {}).length === 0) {
    try {
      const todayScheds = await DB.getSchedule(todayKey, todayKey);
      scheduleData = { ...scheduleData, ...todayScheds };
      daySchedule = scheduleData[todayKey] || {};
    } catch (e) {
      // no data
    }
  }

  const currentShift = getCurrentShiftCode(new Date(), daySchedule);
  const assignedPeople = getAssignedPeopleForShift(daySchedule, currentShift);

  const peopleNames = document.getElementById('people-names');
  const shiftName = document.getElementById('shift-name');
  const headerInfo = document.querySelector('.header-info');

  if (headerInfo) {
    headerInfo.classList.toggle('hidden', assignedPeople.length === 0);
  }

  if (assignedPeople.length > 0) {
    if (peopleNames) {
      if (assignedPeople.length === 1) {
        peopleNames.textContent = assignedPeople[0].toUpperCase();
      } else {
        peopleNames.textContent = assignedPeople.map((n) => n.toUpperCase()).join(' & ');
      }
    }
  } else if (peopleNames) {
    peopleNames.textContent = '';
  }

  if (shiftName) {
    shiftName.textContent = assignedPeople.length > 0 ? currentShift.toUpperCase() + ' SHIFT' : '';
  }
}

function personMatchesScheduleEntry(person, entry) {
  const value = String(entry ?? '').trim();
  return value === String(person.id) || value === person.name;
}

function getAssignedStaff(schedule) {
  const assignedStaff = [];

  ['A', 'M', 'B', 'C'].forEach((shift) => {
    const entries = schedule.shifts[shift] || [];
    entries.forEach((entry) => {
      const person = findPersonByScheduleEntry(entry);
      if (person) {
        assignedStaff.push({ person, shift });
      }
    });
  });

  return assignedStaff;
}

// setPersonAccountFormState provided by staff.js (shared)

// initPersonColorPicker provided by staff.js

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

// resetPersonForm, toggleFormAdmin, startPersonEdit, renderPeopleList, savePerson moved to staff.js for sharing

// Position helpers (selectPosition, toggle..., populate...) now in staff.js

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



// startPersonEdit + cancelPersonEdit provided by staff.js (shared)

async function refreshPeopleViews() {
  await loadPeople();
  await loadSchedules();
  renderCalendar();
  await updatePeopleBlock();

  if (selectedDate && document.getElementById('day-modal').style.display !== 'none') {
    const dateParts = selectedDate.split('-');
    const day = parseInt(dateParts[2], 10);
    const monthIndex = parseInt(dateParts[1], 10) - 1;

    openDayCell = document.querySelector(`.calendar-day[data-date="${selectedDate}"]`);
    renderDayModalContent(selectedDate, day, MONTH_NAMES[monthIndex]);
    requestAnimationFrame(positionDayModal);
  }

  await renderPeopleList();
}

// Initialize
async function init() {
  await loadCurrentUser();
  applyAdminUI();
  await loadPeople();
  await loadSchedules();
  renderCalendar();
  await updatePeopleBlock();
  updateClock();
  setInterval(updateClock, 1000);
  applyTheme();
  resetPersonForm();
  // keep navbar people/shift live
  setInterval(() => { if (typeof updatePeopleBlock === 'function') updatePeopleBlock(); }, 60000);

  // Simple polling for live schedule/staff updates (30s)
  const POLL_INTERVAL_MS = 30000;
  let pollTimer = null;
  function startSchedulePolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      try {
        await loadSchedules();
        renderCalendar();
        await updatePeopleBlock();
        // Also keep people fresh
        if (typeof loadPeople === 'function') await loadPeople();
        if (typeof renderPeopleList === 'function') await renderPeopleList();
      } catch (e) {
        console.warn('Schedule poll failed (will retry):', e?.message || e);
      }
    }, POLL_INTERVAL_MS);
  }
  function stopSchedulePolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  startSchedulePolling();
  window.addEventListener('beforeunload', stopSchedulePolling);
}

// Load current user
async function loadCurrentUser() {
  try {
    currentUser = await DB.getCurrentUser();
  } catch (error) {
    console.error('Error loading user:', error);
  }
}

function applyAdminUI() {
  const manageStaffBtn = document.getElementById('manage-staff-btn');
  const isAdmin = Boolean(currentUser?.is_admin);

  if (manageStaffBtn) {
    manageStaffBtn.style.display = isAdmin ? '' : 'none';
  }
}

// Load users (staff members)
async function loadPeople() {
  try {
    peopleData = await DB.getUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    peopleData = [];
  }
}

// Load schedules for current month
async function loadSchedules() {
  try {
    // Load only the schedules for the current visible month (and adjacent for navigation)
    const firstDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDayDate = new Date(currentYear, currentMonth + 1, 0);
    const lastDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
    const monthSchedules = await DB.getSchedule(firstDay, lastDay);
    // Merge into existing (to support multi-month if needed, but prefer current)
    scheduleData = { ...scheduleData, ...monthSchedules };
  } catch (error) {
    console.error('Error loading schedules:', error);
    scheduleData = {};
  }
}



// Render calendar
function renderCalendar() {
  const monthYearDisplay = document.getElementById('month-year-display');
  if (monthYearDisplay) {
    monthYearDisplay.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
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

  if (isOtherMonth) {
    dayEl.classList.add('other-month');
  }
  if (isToday) {
    dayEl.classList.add('today');
  }
  if (isSelected) {
    dayEl.classList.add('selected');
  }

  dayEl.dataset.date = dateStr;
  dayEl.onclick = () => !isOtherMonth && currentUser?.is_admin && openDayModal(dateStr, dayEl);
  dayEl.onmouseenter = (e) => !isOtherMonth && showHoverPreview(dateStr, e);
  dayEl.onmouseleave = () => hideHoverPreview();

  // Day number wrapper collapses on hover so schedule items can move up.
  const dayNumberSlot = document.createElement('div');
  dayNumberSlot.className = 'day-number-slot';

  const dayNumber = document.createElement('div');
  dayNumber.className = 'day-number';
  dayNumber.textContent = day;
  dayNumberSlot.dataset.day = String(day);

  dayNumberSlot.appendChild(dayNumber);
  dayEl.appendChild(dayNumberSlot);

  // Schedule info - 2x2 shift grid, one quadrant per shift.
  const schedule = scheduleData[dateStr];
  if (schedule && !isOtherMonth && schedule.shifts) {
    const gridContainer = document.createElement('div');
    gridContainer.className = 'day-shifts-grid';

    ['A', 'M', 'B', 'C'].forEach((shift) => {
      const shiftInfo = SHIFTS[shift];
      const people = (schedule.shifts[shift] || []).map(findPersonByScheduleEntry).filter(Boolean);

      const shiftLane = document.createElement('div');
      shiftLane.className = 'day-shift-quadrant';
      shiftLane.style.background = shiftInfo.color.replace('0.7', '0.10');
      shiftLane.style.borderColor = shiftInfo.color.replace('0.7', '0.28');

      const shiftLabel = document.createElement('span');
      shiftLabel.className = 'day-shift-quadrant-label';
      shiftLabel.textContent = shift;
      shiftLabel.style.color = shiftInfo.color.replace('0.7', '1');
      shiftLane.appendChild(shiftLabel);

      const shiftPeople = document.createElement('div');
      shiftPeople.className = 'day-shift-quadrant-people';

      people.slice(0, DAY_CELL_SHIFT_VISIBLE_LIMIT).forEach((person) => {
        const personCircle = document.createElement('span');
        personCircle.className = 'day-shift-person';
        personCircle.textContent = getInitials(person.name);
        personCircle.title = `${person.name} (${shift})`;
        personCircle.style.setProperty('--person-color', person.color);
        personCircle.style.setProperty('--person-bg', person.color + '20');
        personCircle.style.setProperty('--person-border', person.color + '55');
        shiftPeople.appendChild(personCircle);
      });

      if (people.length > DAY_CELL_SHIFT_VISIBLE_LIMIT) {
        const overflowIndicator = document.createElement('span');
        overflowIndicator.className = 'day-shift-person-more';
        overflowIndicator.textContent = `+${people.length - DAY_CELL_SHIFT_VISIBLE_LIMIT}`;
        overflowIndicator.title = `${people.length - DAY_CELL_SHIFT_VISIBLE_LIMIT} more on ${shift}`;
        shiftPeople.appendChild(overflowIndicator);
      }

      if (people.length === 0) {
        const emptyIndicator = document.createElement('span');
        emptyIndicator.className = 'day-shift-quadrant-empty';
        emptyIndicator.textContent = '';
        shiftPeople.appendChild(emptyIndicator);
      }

      shiftLane.appendChild(shiftPeople);
      gridContainer.appendChild(shiftLane);
    });

    dayEl.appendChild(gridContainer);
  }

  return dayEl;
}

// Get initials from name
function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Hover preview state
/** @type {{dateStr: string, page: number}|null} */
let hoverPreviewState = null;
const PREVIEW_PAGE_SIZE = 4;
/** @type {HTMLElement|null} */
let hoverPreviewCell = null;
const DAY_CELL_SHIFT_VISIBLE_LIMIT = 4;

// Show hover preview
function showHoverPreview(dateStr, event) {
  if (selectedDate === dateStr) {
    return;
  }

  const schedule = scheduleData[dateStr] || {
    shifts: { A: [], M: [], B: [], C: [] },
  };
  const preview = document.getElementById('hover-preview');

  // Initialize or update hover preview state
  if (!hoverPreviewState || hoverPreviewState.dateStr !== dateStr) {
    hoverPreviewState = { dateStr, page: 0 };
  }

  // Extract day and month from dateStr
  const dateParts = dateStr.split('-');
  const day = parseInt(dateParts[2]);
  const monthIndex = parseInt(dateParts[1]) - 1;
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Set header
  document.getElementById('hover-preview-day').textContent = day;
  document.getElementById('hover-preview-month').textContent = monthNames[monthIndex].toUpperCase();

  // Build staff rows sorted by shift (A, M, B, C)
  const assignedStaff = getAssignedStaff(schedule);

  // Render with pagination
  renderHoverPreviewContent(assignedStaff);

  // Show preview temporarily to get actual dimensions
  preview.style.display = 'block';
  preview.style.visibility = 'hidden';

  // Position preview like modal - centered below the cell
  const cellEl = event.target.closest('.calendar-day');

  if (hoverPreviewCell && hoverPreviewCell !== cellEl) {
    hoverPreviewCell.classList.remove('preview-open');
  }

  hoverPreviewCell = cellEl;

  if (hoverPreviewCell) {
    hoverPreviewCell.classList.add('preview-open');
  }

  if (cellEl) {
    const rect = cellEl.getBoundingClientRect();
    const previewDialog = preview.querySelector('.hover-preview-dialog');
    const pw = 240;
    const ph = previewDialog ? previewDialog.offsetHeight : 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left + rect.width / 2 - pw / 2;
    let top = rect.bottom + 25;

    // Keep within viewport horizontally
    if (left + pw > vw - 8) {
      left = vw - pw - 8;
    }
    if (left < 8) {
      left = 8;
    }

    // Keep within viewport vertically - position above if needed
    if (top + ph > vh - 8) {
      // Position above the cell, not at the top of viewport
      top = rect.top - ph - 45;
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

    // Add divider if not last item on this page and next person has different shift
    if (idx < pageStaff.length - 1 && pageStaff[idx + 1]?.shift !== shift) {
      html += '<div class="staff-divider"></div>';
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

  if (hoverPreviewCell) {
    hoverPreviewCell.classList.remove('preview-open');
    hoverPreviewCell = null;
  }

  hoverPreviewState = null;
}

// Open day modal
function openDayModal(dateStr, dayEl) {
  if (!currentUser?.is_admin) {
    return;
  }

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

  // Render modal content
  renderDayModalContent(dateStr, day, MONTH_NAMES[monthIndex]);

  // Show modal
  const modal = document.getElementById('day-modal');
  modal.style.display = 'flex';

  renderCalendar();
  openDayCell = document.querySelector(`.calendar-day[data-date="${selectedDate}"]`);
  requestAnimationFrame(positionDayModal);
}

// Separate function to render modal content
/** @type {number} */
let modalPageState = 0;
const MODAL_PAGE_SIZE = 4;

function renderDayModalContent(dateStr, day, monthName) {
  const schedule = scheduleData[dateStr] || {
    shifts: { A: [], M: [], B: [], C: [] },
  };

  const modalContent = document.getElementById('modal-content');

  // Calculate pagination
  const totalStaff = peopleData.length;
  const totalPages = Math.ceil(totalStaff / MODAL_PAGE_SIZE);
  const pageStaff = peopleData.slice(
    modalPageState * MODAL_PAGE_SIZE,
    (modalPageState + 1) * MODAL_PAGE_SIZE
  );

  let html = `
        <div class="modal-header">
            <span class="hover-preview-day">${day}</span>
            <span class="hover-preview-month">${monthName.toUpperCase()}</span>
        </div>
        <div class="modal-staff-content">
    `;

  pageStaff.forEach((person, idx) => {
    const initials = getInitials(person.name);
    const personId = String(person.id);

    // Find current shift for this person
    let currentShift = 'off';
    for (const [shift, people] of Object.entries(schedule.shifts)) {
      if (people && people.some((entry) => personMatchesScheduleEntry(person, entry))) {
        currentShift = shift;
        break;
      }
    }

    const shiftInfo = currentShift !== 'off' ? SHIFTS[currentShift] : null;
    const badgeHtml = shiftInfo
      ? `<span class="staff-shift-badge" style="color:${shiftInfo.color.replace('0.7', '1')}">${currentShift}</span>`
      : '';

    // Shift option buttons
    const optsHtml = ['A', 'M', 'B', 'C']
      .map((shift) => {
        const shiftData = SHIFTS[shift];
        const isActive = currentShift === shift;
        return `
                <button class="shift-opt${isActive ? ' active' : ''}"
                    style="background:${isActive ? shiftData.color.replace('0.7', '0.2') : 'var(--bg-primary)'};
                           border-color:${isActive ? shiftData.color.replace('0.7', '0.5') : 'var(--border-secondary)'};
                           color:${isActive ? shiftData.color.replace('0.7', '1') : 'var(--text-tertiary)'}"
                    data-person-id="${personId}" data-shift="${shift}">
                    ${shift}
                </button>`;
      })
      .join('');

    html += `
            <div class="staff-row">
                <div class="staff-name-row">
                    <div class="staff-avatar"
                        style="background:${person.color}18;border:1px solid ${person.color}44;color:${person.color}">
                        ${initials}
                    </div>
                    <span class="staff-name">${person.name}</span>
                    ${person.position ? `<span class="position-badge">${escapeHtml ? escapeHtml(person.position) : person.position}</span>` : ''}
                    ${badgeHtml}
                </div>
                <div class="shift-opts">${optsHtml}</div>
            </div>`;

    // Add divider if not last item on this page and next person has different shift
    if (idx < pageStaff.length - 1 && pageStaff[idx + 1]?.shift !== currentShift) {
      html += '<div class="staff-divider"></div>';
    }
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
  modalContent.querySelectorAll('.shift-opt').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();

      const personId = btn.dataset.personId;
      const shift = btn.dataset.shift;
      const person = peopleData.find((candidate) => String(candidate.id) === String(personId));
      if (!person) {
        return;
      }

      if (!scheduleData[selectedDate]) {
        scheduleData[selectedDate] = { shifts: { A: [], M: [], B: [], C: [] } };
      }

      const currentSchedule = scheduleData[selectedDate];
      for (const s of ['A', 'M', 'B', 'C']) {
        if (!currentSchedule.shifts[s]) {
          currentSchedule.shifts[s] = [];
        }
      }

      for (const s of ['A', 'M', 'B', 'C']) {
        currentSchedule.shifts[s] = currentSchedule.shifts[s].filter(
          (entry) => !personMatchesScheduleEntry(person, entry)
        );
      }

      const isCurrentlyActive = btn.classList.contains('active');
      if (!isCurrentlyActive) {
        currentSchedule.shifts[shift].push(String(person.id));
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

// Close day modal
function closeDayModal(event) {
  // Only close if clicking on the overlay itself, not the modal dialog
  if (event && event.target.id !== 'day-modal') {
    return;
  }

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

  let left = rect.left + rect.width / 2 - modalWidth / 2;
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
  if (!selectedDate) {
    return;
  }

  try {
    // Ensure the schedule exists
    const currentSchedule = scheduleData[selectedDate] || {
      shifts: { A: [], M: [], B: [], C: [] },
    };

    // Check if at least one shift has a person assigned
    const hasAssignedShifts = ['A', 'M', 'B', 'C'].some(
      (shift) => currentSchedule.shifts[shift] && currentSchedule.shifts[shift].length > 0
    );

    if (!hasAssignedShifts) {
      // Delete the schedule if no one is assigned
      const existing = await SchedulesAPI.list(selectedDate);
      if (existing && existing.length > 0) {
        await SchedulesAPI.delete(existing[0].id);
      }
      delete scheduleData[selectedDate];
    } else {
      const scheduleToSave = {};
      scheduleToSave[selectedDate] = { shifts: currentSchedule.shifts };

      await DB.saveSchedule(scheduleToSave);
    }

    // Reload schedules and update calendar (keep modal open)
    await loadSchedules();
    renderCalendar();
    await updatePeopleBlock();
  } catch (error) {
    console.error('Error saving schedule:', error);
    showAlert('Error', error.message || 'Failed to save schedule. Please try again.');
  }
}

// Clear day schedule
async function clearDaySchedule() {
  if (!selectedDate) {
    return;
  }

  showConfirm(
    'Clear Schedule',
    `Are you sure you want to clear all shifts for this day?`,
    async () => {
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
        showAlert('Error', error.message || 'Failed to clear schedule. Please try again.');
      }
    }
  );
}

// Render staff list (no longer used in modal, kept for compatibility)
function renderStaffList(selectedPeople = []) {
  // This function is no longer used with the new modal approach
}

// Month navigation and date picker
function changeMonth(offset) {
  closeDayModal();

  if (offset < 0) {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  } else if (offset > 0) {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  }

  // Load schedules for the newly selected month (instead of full history)
  loadSchedules().then(async () => {
    renderCalendar();
    await updatePeopleBlock();
  });

  if (document.getElementById('custom-date-picker')?.style.display !== 'none') {
    syncDatePickerControls();
    renderDatePickerCalendar();
  }
}

function toggleDatePicker() {
  const picker = document.getElementById('custom-date-picker');
  if (!picker) {
    return;
  }

  if (picker.style.display === 'none') {
    syncDatePickerControls();
    renderDatePickerCalendar();
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

function syncDatePickerControls() {
  const pickerMonth = document.getElementById('picker-month');
  const pickerYear = document.getElementById('picker-year');

  if (pickerMonth) {
    pickerMonth.value = String(currentMonth);
  }
  if (pickerYear) {
    pickerYear.value = String(currentYear);
  }
}

function updateDatePickerCalendar() {
  closeDayModal();
  currentMonth = parseInt(document.getElementById('picker-month').value, 10) || 0;
  currentYear =
    parseInt(document.getElementById('picker-year').value, 10) || new Date().getFullYear();
  renderCalendar();
  renderDatePickerCalendar();
}

function renderDatePickerCalendar() {
  const year = currentYear;
  const month = currentMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const daysContainer = document.getElementById('picker-days');

  if (!daysContainer) {
    return;
  }

  daysContainer.innerHTML = '';

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dayEl = createDatePickerDay(day, 'other-month', new Date(year, month - 1, day));
    daysContainer.appendChild(dayEl);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const className = selectedDate === dateStr ? 'selected' : '';
    const dayEl = createDatePickerDay(day, className, date);
    daysContainer.appendChild(dayEl);
  }

  const totalCells = daysContainer.children.length;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    const dayEl = createDatePickerDay(day, 'other-month', new Date(year, month + 1, day));
    daysContainer.appendChild(dayEl);
  }
}

function createDatePickerDay(day, className, date) {
  const dayEl = document.createElement('div');
  dayEl.className = `date-picker-day ${className}`.trim();
  dayEl.textContent = day;

  if (!className.includes('other-month')) {
    dayEl.onclick = () => selectDateFromPicker(date);
  }

  return dayEl;
}

function selectDateFromPicker(date) {
  closeDayModal();
  currentMonth = date.getMonth();
  currentYear = date.getFullYear();
  renderCalendar();
  syncDatePickerControls();
  document.getElementById('custom-date-picker').style.display = 'none';

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayEl = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
  if (dayEl && !dayEl.classList.contains('other-month')) {
    openDayModal(dateStr, dayEl);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  resetPersonForm();
  syncDatePickerControls();
});

document.addEventListener('click', (event) => {
  const picker = document.getElementById('custom-date-picker');
  const dateNav = document.querySelector('.date-nav');

  if (picker && picker.style.display !== 'none' && !dateNav?.contains(event.target)) {
    picker.style.display = 'none';
  }
});

// Clock
function updateClock() {
  const clockEl = document.getElementById('current-time');
  const now = new Date();
  if (clockEl) {
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;
  }

  // periodic navbar refresh for live shift/people
  const min = now.getMinutes();
  if (min % 5 === 0 && typeof updatePeopleBlock === 'function') {
    updatePeopleBlock().catch(() => {});
  }
}

/**
 * Update theme toggle button icon
 * @param {string} theme - Current theme ('light' or 'dark')
 */
function updateThemeIcon(theme) {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (!themeBtn) {
    return;
  }

  if (theme === 'dark') {
    themeBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  } else {
    themeBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }

  // Update favicon color
  const favicon = document.getElementById('favicon');
  if (favicon) {
    const color = theme === 'dark' ? '%23eee' : '%23333';
    favicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75' font-weight='bold' fill='${color}'>L</text></svg>`;
  }
}

// Theme
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  updateThemeIcon(newTheme);

  if (currentUser && currentUser.id) {
    currentUser.theme = newTheme;
    DB.updateMyTheme(newTheme).catch((e) => {
      console.warn('Failed to save theme to server', e);
      localStorage.setItem('letsee_theme', newTheme);
    });
  } else {
    localStorage.setItem('letsee_theme', newTheme);
  }
}

function applyTheme() {
  let savedTheme = 'light';
  if (currentUser && currentUser.theme) {
    savedTheme = currentUser.theme;
  } else {
    savedTheme = localStorage.getItem('letsee_theme') || 'light';
  }
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (currentUser) currentUser.theme = savedTheme;
  updateThemeIcon(savedTheme);
}

// Logout
function handleLogout() {
  showConfirm('Sign Out', 'Are you sure you want to sign out?', async () => {
    try {
      await DB.logout();
    } catch (error) {
      console.warn('Server logout failed; clearing local session anyway.', error);
    } finally {
      window.location.href = '/login.html';
    }
  });
}

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
    populatePositionOptions();

    await renderPeopleList();
    resetPersonForm();
  }
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
  const modal = document.getElementById('people-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  resetPersonForm();
  loadPeople();
}

// renderPeopleList provided by staff.js (shared)

// savePerson (and renderPeopleList) now provided by staff.js
// The shared version always captures position_id and supports both account creation styles.

// deletePerson provided by staff.js (shared)

// Initialize on load
init();

// Hover preview pagination handlers
document.getElementById('preview-page-prev').addEventListener('click', (e) => {
  e.stopPropagation();
  if (hoverPreviewState && hoverPreviewState.page > 0) {
    hoverPreviewState.page--;
    const schedule = scheduleData[hoverPreviewState.dateStr] || {
      shifts: { A: [], M: [], B: [], C: [] },
    };
    const assignedStaff = getAssignedStaff(schedule);
    renderHoverPreviewContent(assignedStaff);
  }
});

document.getElementById('preview-page-next').addEventListener('click', (e) => {
  e.stopPropagation();
  if (hoverPreviewState) {
    const schedule = scheduleData[hoverPreviewState.dateStr] || {
      shifts: { A: [], M: [], B: [], C: [] },
    };
    const assignedStaff = getAssignedStaff(schedule);
    const totalPages = Math.ceil(assignedStaff.length / PREVIEW_PAGE_SIZE);
    if (hoverPreviewState.page < totalPages - 1) {
      hoverPreviewState.page++;
      renderHoverPreviewContent(assignedStaff);
    }
  }
});
