/**
 * People/Staff Management Module for Letsee Frontend
 * Handles staff member CRUD operations and UI
 *
 * NOTE: This file MUST be loaded AFTER script.js
 * script.js defines: STAFF_COLOR_PRESETS, DEFAULT_PERSON_COLOR, editingPersonId, editingPersonOriginalName
 */

// All variables are defined in script.js - do NOT redeclare them here

// Local caches (avoid polluting globals too much)
let _positionsCache = [];
let _filteredStaff = null; // for search filter

function setPersonAccountFormState(isEditing) {
  const emailInput = document.getElementById('new-person-email');
  const passwordInput = document.getElementById('new-person-password');
  const adminCheckbox = document.getElementById('new-person-is-admin');
  const adminGroup = document.getElementById('new-person-admin-group');
  const hint = document.getElementById('person-account-hint');
  const activeCb = document.getElementById('new-person-is-active');

  if (emailInput) emailInput.disabled = isEditing;
  // admin flag can be changed during edit
  if (adminCheckbox) adminCheckbox.disabled = false;
  if (passwordInput) passwordInput.disabled = false;
  if (activeCb) activeCb.disabled = false;

  if (isEditing) {
    if (adminGroup) adminGroup.style.opacity = '0.7';
    if (hint) hint.textContent = "Enter a new password above to reset this user's password.";
    return;
  }

  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (adminCheckbox) adminCheckbox.checked = false;
  if (adminGroup) adminGroup.style.opacity = '';
  if (activeCb) activeCb.checked = true;
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
    _positionsCache = Array.isArray(positions) ? positions : [];
  } catch (e) {
    _positionsCache = [];
  }
  return _positionsCache;
}

function populatePositionDatalist() {
  const datalist = document.getElementById('position-datalist');
  if (!datalist) return;
  datalist.innerHTML = _positionsCache
    .map((p) => `<option value="${escapeHtml(p.name)}"></option>`)
    .join('');
}

async function addNewPositionFromInput() {
  const input = document.getElementById('new-person-position');
  const hidden = document.getElementById('new-person-position-id');
  if (!input) return;

  const name = (input.value || '').trim();
  if (!name) {
    showAlert('Error', 'Enter a position name');
    return;
  }

  try {
    const created = await DB.createPosition(name);
    if (!_positionsCache.some((p) => String(p.id) === String(created.id))) {
      _positionsCache.push(created);
    }
    populatePositionDatalist();

    input.value = created.name;
    if (hidden) hidden.value = created.id;
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('already exists')) {
      const match = _positionsCache.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (match) {
        input.value = match.name;
        if (hidden) hidden.value = match.id;
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
  const posInput = document.getElementById('new-person-position');
  const posIdHidden = document.getElementById('new-person-position-id');
  const activeCb = document.getElementById('new-person-is-active');

  if (nameInput) nameInput.value = '';
  if (titleEl) titleEl.textContent = 'Add New Staff Member';
  if (saveBtn) saveBtn.textContent = '+ Add Staff';
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (posInput) posInput.value = '';
  if (posIdHidden) posIdHidden.value = '';
  if (activeCb) activeCb.checked = true;

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

  // Position (text input + hidden id)
  const posInput = document.getElementById('new-person-position');
  const posIdHidden = document.getElementById('new-person-position-id');
  if (posInput) posInput.value = person.position || '';
  if (posIdHidden) posIdHidden.value = person.position_id || '';

  initPersonColorPicker();
  selectPersonColor(person.color);

  // Admin checkbox - now editable on edit
  const adminCb = document.getElementById('new-person-is-admin');
  if (adminCb) adminCb.checked = !!person.isAdmin;

  // Active state
  const activeCb = document.getElementById('new-person-is-active');
  if (activeCb) activeCb.checked = person.isActive !== false;

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
  const adminCheckbox = document.getElementById('new-person-is-admin');
  const activeCb = document.getElementById('new-person-is-active');

  const name = nameInput?.value?.trim();
  const color = colorInput?.value || DEFAULT_PERSON_COLOR;
  const email = emailInput?.value?.trim() || '';
  const password = passwordInput?.value || '';
  const isAdmin = Boolean(adminCheckbox?.checked);
  const isActive = activeCb ? activeCb.checked : true;

  // Resolve position: prefer hidden id, else lookup by name from input
  let position_id = null;
  const posInput = document.getElementById('new-person-position');
  const posIdHidden = document.getElementById('new-person-position-id');
  if (posIdHidden && posIdHidden.value) {
    position_id = posIdHidden.value;
  } else if (posInput && posInput.value.trim()) {
    const nameVal = posInput.value.trim();
    const match = _positionsCache.find(p => p.name.toLowerCase() === nameVal.toLowerCase());
    if (match) position_id = match.id;
  }

  if (!name) {
    showAlert('Validation Error', 'Please enter a name');
    return;
  }

  try {
    if (editingPersonId) {
      const updatePayload = { full_name: name, color, position_id, is_active: isActive, is_admin: isAdmin };
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
    populatePositionDatalist();
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
        const emailShort = person.email && !person.email.includes('@letsee.local')
          ? `<span class="email-short">${escapeHtml(person.email)}</span>` : '';

        return `
          <div class="person-item${person.isActive === false ? ' is-inactive' : ''}" data-id="${person.id}" data-name="${safeName.toLowerCase()}" data-pos="${(person.position || '').toLowerCase()}">
            <div class="person-color" style="background-color: ${safeColor}"></div>
            <div class="person-info">
              <div class="person-name">${safeName}${isInactive} ${emailShort}</div>
              <div class="person-meta">
                ${pos}
                ${isAdmin}
              </div>
            </div>
            <div class="person-actions">
              <button class="btn-icon" onclick="startPersonEdit('${person.id}')" aria-label="Edit ${safeName}">Edit</button>
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
  populatePositionDatalist();

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
    populatePositionDatalist();

    await renderPeopleList();
    resetPersonForm();

    // Ensure the active checkbox default
    const act = document.getElementById('new-person-is-active');
    if (act) act.checked = true;
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
