/**
 * People/Staff Management Module for Letsee Frontend
 * Handles staff member CRUD operations and UI
 *
 * NOTE: This file MUST be loaded AFTER script.js
 * script.js defines: STAFF_COLOR_PRESETS, DEFAULT_PERSON_COLOR, editingPersonId, editingPersonOriginalName
 */

// All variables are defined in script.js - do NOT redeclare them here

// Local caches (avoid polluting globals too much)
window._positionsCache = window._positionsCache || [];
let _filteredStaff = null; // for search filter

function setPersonAccountFormState(isEditing) {
  const emailInput = document.getElementById('new-person-email');
  const passwordInput = document.getElementById('new-person-password');
  const hint = document.getElementById('person-account-hint');

  if (emailInput) emailInput.disabled = isEditing;
  if (passwordInput) passwordInput.disabled = false;

  if (isEditing) {
    if (hint) hint.textContent = "Enter a new password above to reset this user's password.";
    return;
  }

  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (hint) {
    hint.textContent = 'Leave email and password blank to create a staff record without a login account.';
  }
}

/**
 * Initialize person color picker UI
 */
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
        aria-pressed="${color.toLowerCase() === selectedColor.toLowerCase()}"
      ></button>
    `
  ).join('');
}

/**
 * Select a color for a person
 * @param {string} color - Color hex code
 */
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

/* ===================== POSITION HELPERS ===================== */

async function loadPositions() {
  try {
    const positions = await DB.getPositions();
    window._positionsCache = Array.isArray(positions) ? positions : [];
  } catch (e) {
    window._positionsCache = [];
  }
  return window._positionsCache;
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

function closePositionDropdownOnOutside(e) {
  const wrapper = document.querySelector('.position-dropdown-wrapper');
  const dd = document.getElementById('position-dropdown');
  if (dd && wrapper && !wrapper.contains(e.target)) {
    dd.style.display = 'none';
  }
}

// Attach once
if (typeof window !== 'undefined' && !window._positionDropdownListener) {
  document.addEventListener('click', closePositionDropdownOnOutside);
  window._positionDropdownListener = true;
}

async function addNewPositionFromInput() {
  // Try to get name from the dropdown search if open, else from selected text or prompt fallback (but avoid)
  let searchInput = document.getElementById('position-search');
  let name = '';
  if (searchInput && searchInput.offsetParent !== null) { // visible
    name = (searchInput.value || '').trim();
  }
  if (!name) {
    // fallback to current selected text if not "no position"
    const selText = document.getElementById('position-selected-text');
    if (selText && selText.textContent && !selText.textContent.includes('No position')) {
      name = selText.textContent.trim();
    }
  }
  if (!name) {
    showAlert('Error', 'Type a position name in the search box inside the dropdown, then click + New');
    return;
  }

  const hidden = document.getElementById('new-person-position-id');
  try {
    const created = await DB.createPosition(name);
    if (!(window._positionsCache || []).some((p) => String(p.id) === String(created.id))) {
      window._positionsCache = window._positionsCache || [];
      window._positionsCache.push(created);
    }
    populatePositionOptions();

    // select it
    selectPosition(created.id, created.name);
    // close dropdown if open
    const dd = document.getElementById('position-dropdown');
    if (dd) dd.style.display = 'none';
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('already exists')) {
      const cache = window._positionsCache || [];
      const match = cache.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (match) {
        selectPosition(match.id, match.name);
      }
      showAlert('Info', 'That position already exists');
    } else {
      showAlert('Error', err.message || 'Failed to create position');
    }
  }
}

/* ===================== END POSITION HELPERS ===================== */

/**
 * Reset the person form to initial state
 */
function resetPersonForm() {
  editingPersonId = null;
  editingPersonOriginalName = '';

  const nameInput = document.getElementById('new-person-name');
  const titleEl = document.getElementById('person-form-title');
  const saveBtn = document.getElementById('save-person-btn');
  const cancelBtn = document.getElementById('cancel-person-edit');

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
  if (adminBtn) {
    const adminField = adminBtn.closest('.form-field') || adminBtn.parentElement;
    if (adminField) adminField.style.display = 'none';
    adminBtn.textContent = 'Make Admin';
  }

  initPersonColorPicker();
  selectPersonColor(DEFAULT_PERSON_COLOR);
  setPersonAccountFormState(false);
}

/**
 * Start editing a person
 * @param {string} id - Person ID
 */
async function startPersonEdit(id) {
  const people = await DB.getUsers();
  const person = people.find((p) => String(p.id) === String(id));
  if (!person) {
    return;
  }

  editingPersonId = String(person.id);
  editingPersonOriginalName = person.name;

  document.getElementById('person-form-title').textContent = 'Edit Staff Member';
  document.getElementById('save-person-btn').textContent = 'Save';
  document.getElementById('cancel-person-edit').style.display = 'inline-flex';

  document.getElementById('new-person-name').value = person.name || '';

  // Position via custom dropdown
  if (!window._positionsCache || window._positionsCache.length === 0) {
    await loadPositions();
  }
  if (typeof populatePositionOptions === 'function') populatePositionOptions();
  if (person.position_id && person.position) {
    selectPosition(person.position_id, person.position);
  } else {
    const textEl = document.getElementById('position-selected-text');
    if (textEl) textEl.textContent = '— No position —';
    const hid = document.getElementById('new-person-position-id');
    if (hid) hid.value = '';
  }

  initPersonColorPicker();
  selectPersonColor(person.color);

  // Admin button state
  const adminHidden = document.getElementById('new-person-is-admin');
  const adminBtn = document.getElementById('admin-toggle-btn');
  const isAdmin = !!person.isAdmin;
  if (adminHidden) adminHidden.value = isAdmin ? 'true' : 'false';
  if (adminBtn) {
    const adminField = adminBtn.closest('.form-field') || adminBtn.parentElement;
    if (adminField) adminField.style.display = '';
    adminBtn.textContent = isAdmin ? 'Remove Admin' : 'Make Admin';
  }

  setPersonAccountFormState(true);
  document.getElementById('new-person-name').focus();
}

/**
 * Cancel person editing
 */
function cancelPersonEdit() {
  resetPersonForm();
}

/**
 * Save a person (create or update)
 */
async function savePerson() {
  const nameInput = document.getElementById('new-person-name');
  const colorInput = document.getElementById('new-person-color');
  const emailInput = document.getElementById('new-person-email');
  const passwordInput = document.getElementById('new-person-password');
  const adminHidden = document.getElementById('new-person-is-admin');

  const name = nameInput?.value?.trim();
  const color = colorInput?.value || DEFAULT_PERSON_COLOR;
  const email = emailInput?.value?.trim() || '';
  const password = passwordInput?.value || '';
  const isAdmin = adminHidden ? adminHidden.value === 'true' : false;
  const isActive = true; // default for new staff, active toggle is in list only

  // Resolve position from hidden (set by dropdown or +New)
  let position_id = null;
  const posIdHidden = document.getElementById('new-person-position-id');
  if (posIdHidden && posIdHidden.value) {
    position_id = posIdHidden.value;
  }

  if (!name) {
    showAlert('Validation Error', 'Please enter a name');
    return;
  }

  try {
    if (editingPersonId) {
      const updatePayload = { full_name: name, color, position_id, is_admin: isAdmin };
      await DB.updateUser(editingPersonId, updatePayload);

      // password reset only on edit if provided
      if (passwordInput && passwordInput.value) {
        const newPass = passwordInput.value;
        if (newPass.length < 8) {
          showAlert('Validation Error', 'Password must be at least 8 characters long.');
          return;
        }
        await DB.resetUserPassword(editingPersonId, newPass);
      }
    } else {
      const payloadBase = {
        full_name: name,
        color,
        position_id,
        is_admin: isAdmin,
      };

      if (email || password) {
        if (!email || !password) {
          showAlert(
            'Validation Error',
            'Provide both email and password to create a login account, or leave both blank.'
          );
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showAlert('Validation Error', 'Please enter a valid email address.');
          return;
        }
        if (password.length < 8) {
          showAlert('Validation Error', 'Password must be at least 8 characters long.');
          return;
        }

        await AuthAPI.register({
          email,
          password,
          ...payloadBase,
        });
      } else {
        await UsersAPI.create({
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@letsee.local`,
          password: 'temppass123',
          ...payloadBase,
          is_admin: false,
          is_active: isActive,
        });
      }
    }

    resetPersonForm();
    await loadPositions();
    populatePositionOptions();
    await refreshPeopleViews();
    showAlert('Success', `Staff member "${name}" saved successfully`);
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

/**
 * Delete a person
 * @param {string} id - Person ID
 * @param {string} name - Person name
 */
function deletePerson(id, name) {
  showConfirm(
    'Delete Staff Member',
    `Are you sure you want to delete "${name}"? This action cannot be undone.`,
    async () => {
      try {
        await UsersAPI.delete(id);
        if (String(editingPersonId) === String(id)) {
          resetPersonForm();
        }
        await refreshPeopleViews();
        showAlert('Success', 'Staff member deleted successfully');
      } catch (error) {
        console.error('Error deleting person:', error);
        showAlert('Error', error.message || 'Failed to delete staff member. Please try again.');
      }
    }
  );
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

/**
 * Render the people list in the modal (enhanced)
 */
async function renderPeopleList() {
  const peopleList = document.getElementById('people-list');
  const countEl = document.getElementById('staff-count');
  if (!peopleList) return;

  try {
    let people = await DB.getUsers();

    // sort active first
    people.sort((a, b) => {
      if ((a.isActive === false) === (b.isActive === false)) return (a.name || '').localeCompare(b.name || '');
      return a.isActive === false ? 1 : -1;
    });

    if (countEl) countEl.textContent = `(${people.length})`;

    if (people.length === 0) {
      peopleList.innerHTML = `
        <div class="empty-state" style="padding: 28px 20px; text-align: center; color: var(--text-secondary);">
          <p>No staff members yet</p>
        </div>
      `;
      return;
    }

    peopleList.innerHTML = people
      .map((person) => {
        const safeName = escapeHtml(person.name);
        const safeColor = escapeHtml(person.color);
        const safeNameForJs = escapeJsString(person.name);
        const pos = person.position ? `<span class="position-badge">${escapeHtml(person.position)}</span>` : '';
        const isAdmin = person.isAdmin ? `<span class="admin-badge">ADMIN</span>` : '';
        const isInactive = person.isActive === false ? ' (inactive)' : '';

        const initials = getInitials(person.name);
        return `
          <div class="person-item${person.isActive === false ? ' is-inactive' : ''}" data-id="${person.id}" data-name="${safeName.toLowerCase()}" data-pos="${(person.position || '').toLowerCase()}">
            <div class="person-avatar" style="background:${safeColor}18;border:1px solid ${safeColor}44;color:${safeColor}">
              ${initials}
            </div>
            <div class="person-info">
              <div class="person-name">${safeName}${isInactive}</div>
              <div class="person-meta">
                ${pos}
                ${isAdmin}
              </div>
            </div>
            <div class="person-actions">
              <button class="btn-icon" onclick="startPersonEdit('${person.id}')" aria-label="Edit ${safeName}">Edit</button>
              <button class="btn-icon btn-active-toggle" onclick="toggleUserActive('${person.id}', ${!!person.isActive}, '${safeNameForJs}')" aria-label="Toggle active for ${safeName}">
                ${person.isActive !== false ? 'Deactivate' : 'Activate'}
              </button>
              <button class="btn-icon btn-delete" onclick="deletePerson('${person.id}', '${safeNameForJs}')" aria-label="Delete ${safeName}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (error) {
    console.error('Error rendering people list:', error);
    peopleList.innerHTML = `
      <div class="error-state" style="padding: 28px; text-align: center; color: #c0392b;">
        <p>Failed to load staff</p>
        <button class="btn-primary btn-small" onclick="renderPeopleList()" style="margin-top: 10px;">Retry</button>
      </div>
    `;
  }
}

function filterStaffList() {
  const q = (document.getElementById('staff-search')?.value || '').toLowerCase().trim();
  const list = document.getElementById('people-list');
  if (!list) return;

  Array.from(list.children).forEach(item => {
    const name = item.dataset.name || '';
    const pos = item.dataset.pos || '';
    const match = !q || name.includes(q) || pos.includes(q);
    item.style.display = match ? '' : 'none';
  });
}


/**
 * Refresh all people-related views
 */
async function refreshPeopleViews() {
  await loadPositions();
  populatePositionOptions();

  if (typeof updatePeopleBlock === 'function') {
    await updatePeopleBlock();
  }
  if (typeof renderHandoverNotes === 'function') {
    await renderHandoverNotes(true);
  }
  await renderPeopleList();
}

/**
 * Open the people management modal
 */
async function openPeopleModal() {
  if (!currentUser?.is_admin) {
    showAlert('Access Denied', 'Only admins can manage staff.');
    return;
  }

  const modal = document.getElementById('people-modal');
  if (modal) {
    modal.style.display = 'flex';

    // Load positions for the form input (search + new)
    await loadPositions();
    populatePositionOptions();

    await renderPeopleList();
    resetPersonForm();
  }
}

/**
 * Close the people management modal
 */
function closePeopleModal() {
  const modal = document.getElementById('people-modal');
  const wrapper = document.getElementById('position-add-wrapper');
  if (wrapper) wrapper.style.display = 'none';
  if (modal) {
    modal.style.display = 'none';
    resetPersonForm();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STAFF_COLOR_PRESETS,
    DEFAULT_PERSON_COLOR,
    initPersonColorPicker,
    selectPersonColor,
    resetPersonForm,
    startPersonEdit,
    cancelPersonEdit,
    savePerson,
    deletePerson,
    renderPeopleList,
    refreshPeopleViews,
    openPeopleModal,
    closePeopleModal,
  };
}
