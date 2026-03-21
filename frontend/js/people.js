/**
 * People/Staff Management Module for Letsee Frontend
 * Handles staff member CRUD operations and UI
 */

// Color presets for staff members
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

// State
let editingPersonId = null;
let editingPersonOriginalName = '';

/**
 * Initialize person color picker UI
 */
function initPersonColorPicker() {
  const picker = document.getElementById('new-person-color-picker');
  const colorInput = document.getElementById('new-person-color');
  if (!picker || !colorInput) {return;}

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
  if (!colorInput) {return;}

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

  if (nameInput) {nameInput.value = '';}
  if (titleEl) {titleEl.textContent = 'Add New Staff Member';}
  if (saveBtn) {saveBtn.textContent = '+ Add';}
  if (cancelBtn) {cancelBtn.style.display = 'none';}

  initPersonColorPicker();
  selectPersonColor(DEFAULT_PERSON_COLOR);
}

/**
 * Start editing a person
 * @param {string} id - Person ID
 */
async function startPersonEdit(id) {
  const people = await PeopleAPI.list();
  const person = people.find((p) => String(p.id) === String(id));
  if (!person) {return;}

  editingPersonId = String(person.id);
  editingPersonOriginalName = person.name;

  document.getElementById('person-form-title').textContent = 'Edit Staff Member';
  document.getElementById('save-person-btn').textContent = 'Save';
  document.getElementById('cancel-person-edit').style.display = 'inline-flex';
  document.getElementById('new-person-name').value = person.name;
  initPersonColorPicker();
  selectPersonColor(person.color);
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

  const name = nameInput?.value?.trim();
  const color = colorInput?.value || DEFAULT_PERSON_COLOR;

  if (!name) {
    showAlert('Validation Error', 'Please enter a name');
    return;
  }

  try {
    if (editingPersonId) {
      await PeopleAPI.update(editingPersonId, name, color);
      // Update staff name in existing schedules
      const existingSchedules = await SchedulesAPI.list();
      const schedulesToUpdate = {};

      existingSchedules.forEach((schedule) => {
        if (!schedule?.shifts) {return;}

        let changed = false;
        const updatedShifts = {};

        ['A', 'M', 'B', 'C'].forEach((shift) => {
          const originalPeople = schedule.shifts[shift] || [];
          const renamedPeople = [
            ...new Set(
              originalPeople.map((personName) => {
                if (personName === editingPersonOriginalName) {
                  changed = true;
                  return name;
                }
                return personName;
              })
            ),
          ];
          updatedShifts[shift] = renamedPeople;
        });

        if (changed) {
          schedulesToUpdate[schedule.date] = { shifts: updatedShifts };
        }
      });

      if (Object.keys(schedulesToUpdate).length > 0) {
        await SchedulesAPI.update(
          Object.keys(schedulesToUpdate)[0],
          schedulesToUpdate[Object.keys(schedulesToUpdate)[0]]
        );
      }
    } else {
      await PeopleAPI.create(name, color);
    }

    resetPersonForm();
    await refreshPeopleViews();
    showAlert('Success', `Staff member "${name}" saved successfully`);
  } catch (error) {
    console.error('Error saving person:', error);
    showAlert('Error', 'Failed to save staff member. Please try again.');
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
        await PeopleAPI.delete(id);
        if (String(editingPersonId) === String(id)) {
          resetPersonForm();
        }
        await refreshPeopleViews();
        showAlert('Success', 'Staff member deleted successfully');
      } catch (error) {
        console.error('Error deleting person:', error);
        showAlert('Error', 'Failed to delete staff member. Please try again.');
      }
    }
  );
}

/**
 * Render the people list in the modal
 */
async function renderPeopleList() {
  const peopleList = document.getElementById('people-list');
  if (!peopleList) {return;}

  try {
    const people = await PeopleAPI.list();

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
      .map(
        (person) => `
          <div class="person-item" data-id="${person.id}">
            <div class="person-color" style="background-color: ${person.color}"></div>
            <div class="person-info">
              <div class="person-name">${escapeHtml(person.name)}</div>
              <div class="person-color-code">${escapeHtml(person.color)}</div>
            </div>
            <div class="person-actions">
              <button class="btn-icon" onclick="startPersonEdit('${person.id}')" aria-label="Edit ${person.name}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-icon btn-delete" onclick="deletePerson('${person.id}', '${escapeHtml(person.name)}')" aria-label="Delete ${person.name}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `
      )
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
