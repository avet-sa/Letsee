/**
 * People/Staff Management Module for Letsee Frontend
 * Handles staff member CRUD operations and UI
 *
 * NOTE: This file MUST be loaded AFTER script.js
 * script.js defines: STAFF_COLOR_PRESETS, DEFAULT_PERSON_COLOR, editingPersonId, editingPersonOriginalName
 */

// All variables are defined in script.js - do NOT redeclare them here

function setPersonAccountFormState(isEditing) {
  const emailInput = document.getElementById('new-person-email');
  const passwordInput = document.getElementById('new-person-password');
  const adminCheckbox = document.getElementById('new-person-is-admin');
  const adminGroup = document.getElementById('new-person-admin-group');
  const hint = document.getElementById('person-account-hint');

  if (emailInput) emailInput.disabled = isEditing;
  if (adminCheckbox) adminCheckbox.disabled = isEditing;
  if (passwordInput) passwordInput.disabled = false; // allow entering new password to reset on edit

  if (isEditing) {
    if (adminGroup) {
      adminGroup.style.opacity = '0.7';
    }
    if (hint) {
      hint.textContent = 'Enter a new password above to reset this user\'s password.';
    }
    return;
  }

  if (emailInput) {
    emailInput.value = '';
  }
  if (passwordInput) {
    passwordInput.value = '';
  }
  if (adminCheckbox) {
    adminCheckbox.checked = false;
  }
  if (adminGroup) {
    adminGroup.style.opacity = '';
  }
  if (hint) {
    hint.textContent =
      'Leave email and password blank to create a staff record without a login account.';
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

  if (nameInput) {
    nameInput.value = '';
  }
  if (titleEl) {
    titleEl.textContent = 'Add New Staff Member';
  }
  if (saveBtn) {
    saveBtn.textContent = '+ Add';
  }
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
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
  document.getElementById('new-person-name').value = person.name;
  initPersonColorPicker();
  selectPersonColor(person.color);
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

  const name = nameInput?.value?.trim();
  const color = colorInput?.value || DEFAULT_PERSON_COLOR;
  const email = emailInput?.value?.trim() || '';
  const password = passwordInput?.value || '';
  const isAdmin = Boolean(adminCheckbox?.checked);

  if (!name) {
    showAlert('Validation Error', 'Please enter a name');
    return;
  }

  try {
    if (editingPersonId) {
      await DB.updateUser(editingPersonId, { full_name: name, color });
      // If admin entered a new password in edit mode, reset it
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
          full_name: name,
          color,
          is_admin: isAdmin,
        });
      } else {
        await UsersAPI.create({
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@letsee.local`,
          password: 'temppass123',
          full_name: name,
          color,
          is_admin: false,
        });
      }
    }

    resetPersonForm();
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
 * Render the people list in the modal
 */
async function renderPeopleList() {
  const peopleList = document.getElementById('people-list');
  if (!peopleList) {
    return;
  }

  try {
    const people = await DB.getUsers();

    if (people.length === 0) {
      peopleList.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary);">
          <p>No staff members yet</p>
          <p style="font-size: 12px; margin-top: 8px;">Add your first staff member below</p>
        </div>
      `;
      return;
    }

    peopleList.innerHTML = people
      .map((person) => {
        const safeName = escapeHtml(person.name);
        const safeColor = escapeHtml(person.color);
        const safeNameForJs = escapeJsString(person.name);
        return `
          <div class="person-item" data-id="${person.id}">
            <div class="person-color" style="background-color: ${safeColor}"></div>
            <div class="person-info">
              <div class="person-name">${safeName}</div>
              <div class="person-color-code">${safeColor}</div>
            </div>
            <div class="person-actions">
              <button class="btn-icon" onclick="startPersonEdit('${person.id}')" aria-label="Edit ${safeName}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-icon btn-delete" onclick="deletePerson('${person.id}', '${safeNameForJs}')" aria-label="Delete ${safeName}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      <div class="error-state" style="padding: 40px; text-align: center; color: #ff4444;">
        <p>Failed to load staff members</p>
        <button class="btn-primary" onclick="renderPeopleList()" style="margin-top: 16px;">Retry</button>
      </div>
    `;
  }
}

/**
 * Refresh all people-related views
 */
async function refreshPeopleViews() {
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
    await renderPeopleList();
    resetPersonForm();
  }
}

/**
 * Close the people management modal
 */
function closePeopleModal() {
  const modal = document.getElementById('people-modal');
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
