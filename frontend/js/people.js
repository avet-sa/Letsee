/**
 * People/Staff Management Module for Letsee Frontend
 *
 * NOTE: Many staff/position functions have been moved to staff.js (loaded earlier).
 * This file now contains schedule-page specific helpers + some wrappers.
 */

// Local caches (avoid polluting globals too much)
window._positionsCache = window._positionsCache || [];
let _filteredStaff = null; // for search filter

// Staff/position core moved to staff.js (shared across pages)



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
        if (String(window.editingPersonId) === String(id)) {
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
// renderPeopleList provided by staff.js


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
