/**
 * staff.js - Shared staff / position management logic
 *
 * Used by both index.html (handover page) and schedule.html.
 * Load after api.js (so DB is available) and before or alongside page-specific scripts.
 *
 * This centralizes:
 * - Position dropdown (load, populate, select, toggle, filter, +New)
 * - Color picker
 * - Form reset / edit start / save
 * - Rendering the staff list (with position badges)
 */

(function () {
  'use strict';

  // Safe defaults (pages may define their own earlier)
  const STAFF_COLOR_PRESETS = (window.STAFF_COLOR_PRESETS && window.STAFF_COLOR_PRESETS.length)
    ? window.STAFF_COLOR_PRESETS
    : [
        '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
        '#9b59b6', '#1abc9c', '#f1c40f', '#e84393'
      ];

  const DEFAULT_PERSON_COLOR = window.DEFAULT_PERSON_COLOR || STAFF_COLOR_PRESETS[0];

  // Shared editing state on window to avoid let-shadowing issues across page scripts
  if (typeof window.editingPersonId === 'undefined') window.editingPersonId = null;
  if (typeof window.editingPersonOriginalName === 'undefined') window.editingPersonOriginalName = '';

  // Expose for any legacy inline uses
  window.STAFF_COLOR_PRESETS = STAFF_COLOR_PRESETS;
  window.DEFAULT_PERSON_COLOR = DEFAULT_PERSON_COLOR;

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
    const search = document.getElementById('position-search');
    if (hidden) hidden.value = id || '';
    if (search) search.value = name || '';
    // hide dropdown after selection
    hidePositionOptions();
  }

  function showPositionOptions() {
    const dd = document.getElementById('position-dropdown');
    if (!dd) return;
    populatePositionOptions();
    dd.style.display = 'flex';
  }

  // kept for backward compat if any old calls, but prefer showPositionOptions + focus search
  function togglePositionDropdown() {
    const dd = document.getElementById('position-dropdown');
    if (!dd) return;
    const isOpen = dd.style.display === 'block' || dd.style.display === 'flex';
    if (isOpen) {
      dd.style.display = 'none';
    } else {
      showPositionOptions();
    }
  }

  function hidePositionOptions() {
    const dd = document.getElementById('position-dropdown');
    if (dd) dd.style.display = 'none';
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
    // if user clears the search, treat as no position selected
    if (!q) {
      const hid = document.getElementById('new-person-position-id');
      if (hid) hid.value = '';
    }
  }

  function closePositionDropdownOnOutside(e) {
    const wrapper = document.querySelector('.position-dropdown-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      hidePositionOptions();
    }
  }

  // Attach listener once
  if (typeof window !== 'undefined' && !window._positionDropdownListener) {
    document.addEventListener('click', closePositionDropdownOnOutside);
    window._positionDropdownListener = true;
  }

  // Setup auto-hide for position dropdown (blur/focusout, ESC, TAB)
  function setupPositionDropdownAutoHide() {
    const search = document.getElementById('position-search');
    const wrapper = document.querySelector('.position-dropdown-wrapper');
    if (!search || !wrapper || search.dataset.autoHideSetup) return;
    search.dataset.autoHideSetup = 'true';

    // Hide when focus leaves the entire wrapper (click elsewhere or tab away)
    wrapper.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          hidePositionOptions();
        }
      }, 0);
    });

    // Keyboard: ESC and TAB should close the dropdown
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hidePositionOptions();
        e.preventDefault();
      } else if (e.key === 'Tab') {
        hidePositionOptions();
      }
    });
  }

  // Initialize the auto-hide setup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPositionDropdownAutoHide);
  } else {
    setupPositionDropdownAutoHide();
  }

  // Setup auto-hide for position dropdown on blur, ESC, TAB
  function setupPositionDropdownAutoHide() {
    const search = document.getElementById('position-search');
    const wrapper = document.querySelector('.position-dropdown-wrapper');
    if (!search || !wrapper || search.dataset.autoHideSetup) return;
    search.dataset.autoHideSetup = 'true';

    // Hide when focus leaves the wrapper entirely (handles clicks elsewhere + tab)
    wrapper.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          hidePositionOptions();
        }
      }, 0);
    });

    // Keyboard shortcuts
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hidePositionOptions();
        e.preventDefault();
      } else if (e.key === 'Tab') {
        // Let tab move focus, but hide the dropdown
        hidePositionOptions();
      }
    });
  }

  // Run setup (safe even if elements not present yet)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPositionDropdownAutoHide);
  } else {
    setupPositionDropdownAutoHide();
  }

  async function addNewPositionFromInput() {
    let searchInput = document.getElementById('position-search');
    let name = '';
    if (searchInput) {
      name = (searchInput.value || '').trim();
    }
    if (!name) {
      if (typeof showAlert === 'function') {
        showAlert('Error', 'Type a position name in the search box, then click + New');
      }
      return;
    }

    try {
      const created = await DB.createPosition(name);
      if (!(window._positionsCache || []).some((p) => String(p.id) === String(created.id))) {
        window._positionsCache = window._positionsCache || [];
        window._positionsCache.push(created);
      }
      populatePositionOptions();
      selectPosition(created.id, created.name);
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('already exists')) {
        const cache = window._positionsCache || [];
        const match = cache.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (match) selectPosition(match.id, match.name);
        if (typeof showAlert === 'function') showAlert('Info', 'That position already exists');
      } else {
        if (typeof showAlert === 'function') {
          showAlert('Error', err.message || 'Failed to create position');
        }
      }
    }
  }

  /* ===================== COLOR PICKER ===================== */

  function initPersonColorPicker() {
    const picker = document.getElementById('new-person-color-picker');
    const colorInput = document.getElementById('new-person-color');
    if (!picker || !colorInput) return;

    const selectedColor = colorInput.value || DEFAULT_PERSON_COLOR;
    colorInput.value = selectedColor;

    picker.innerHTML = STAFF_COLOR_PRESETS.map((color) => `
      <button
        type="button"
        class="color-swatch${color.toLowerCase() === selectedColor.toLowerCase() ? ' is-selected' : ''}"
        style="--swatch-color: ${color}"
        data-color="${color}"
        onclick="selectPersonColor('${color}')"
        aria-label="Select ${color}"
        aria-pressed="${color.toLowerCase() === selectedColor.toLowerCase()}"
      ></button>
    `).join('');
  }

  function selectPersonColor(color) {
    const colorInput = document.getElementById('new-person-color');
    if (!colorInput) return;

    colorInput.value = color;
    document.querySelectorAll('#new-person-color-picker .color-swatch').forEach((swatch) => {
      const isSelected = swatch.dataset.color.toLowerCase() === color.toLowerCase();
      swatch.classList.toggle('is-selected', isSelected);
      swatch.setAttribute('aria-pressed', String(isSelected));
    });
  }

  /* ===================== FORM STATE ===================== */

  function setPersonAccountFormState(isEditing) {
    const emailInput = document.getElementById('new-person-email');
    const passwordInput = document.getElementById('new-person-password');
    const adminCheckbox = document.getElementById('new-person-is-admin');
    const adminGroup = document.getElementById('new-person-admin-group');
    const hint = document.getElementById('person-account-hint');

    if (emailInput) emailInput.disabled = isEditing;
    if (passwordInput) passwordInput.disabled = false;

    if (isEditing) {
      if (adminGroup) adminGroup.style.opacity = '0.7';
      if (hint) hint.textContent = "Enter a new password above to reset this user's password.";
      return;
    }

    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (adminCheckbox) adminCheckbox.checked = false;
    if (adminGroup) adminGroup.style.opacity = '';
    if (hint) {
      hint.textContent = 'Leave email and password blank to create a staff record without a login account.';
    }
  }

  function toggleFormAdmin() {
    const hidden = document.getElementById('new-person-is-admin');
    const btn = document.getElementById('admin-toggle-btn');
    if (!hidden || !btn) return;

    const isCurrentlyAdmin = hidden.value === 'true';
    const newState = !isCurrentlyAdmin;
    hidden.value = newState ? 'true' : 'false';
    btn.textContent = newState ? 'Remove Admin' : 'Make Admin';
  }

  /* ===================== RESET / EDIT ===================== */

  function resetPersonForm() {
    window.editingPersonId = null;
    window.editingPersonOriginalName = '';

    const nameInput = document.getElementById('new-person-name');
    const titleEl = document.getElementById('person-form-title');
    const saveBtn = document.getElementById('save-person-btn');
    const cancelBtn = document.getElementById('cancel-person-edit');

    if (nameInput) nameInput.value = '';
    if (titleEl) titleEl.textContent = 'Add New Staff Member';
    if (saveBtn) saveBtn.textContent = '+ Add Staff';
    if (cancelBtn) cancelBtn.style.display = 'none';

    const posSearch = document.getElementById('position-search');
    const posHid = document.getElementById('new-person-position-id');
    if (posSearch) posSearch.value = '';
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

    if (typeof setPersonAccountFormState === 'function') {
      setPersonAccountFormState(false);
    }
  }

  function cancelPersonEdit() {
    resetPersonForm();
  }

  async function startPersonEdit(id) {
    let people = [];
    if (typeof getUsers === 'function') {
      people = await getUsers();
    } else if (typeof loadPeople === 'function') {
      await loadPeople();
      people = (typeof peopleData !== 'undefined' && Array.isArray(peopleData)) ? peopleData : (window.peopleData || []);
    } else {
      people = await DB.getUsers();
    }

    const person = people.find((p) => String(p.id) === String(id));
    if (!person) return;

    window.editingPersonId = String(person.id);
    window.editingPersonOriginalName = person.name || person.full_name || '';

    const titleEl = document.getElementById('person-form-title');
    const saveBtn = document.getElementById('save-person-btn');
    const cancelBtn = document.getElementById('cancel-person-edit');
    const nameInput = document.getElementById('new-person-name');

    if (titleEl) titleEl.textContent = 'Edit Staff Member';
    if (saveBtn) saveBtn.textContent = 'Save';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (nameInput) nameInput.value = person.name || person.full_name || '';

    // Position
    if (!window._positionsCache || window._positionsCache.length === 0) {
      await loadPositions();
    }
    if (typeof populatePositionOptions === 'function') populatePositionOptions();

    if (person.position_id && person.position) {
      selectPosition(person.position_id, person.position);
    } else {
      const search = document.getElementById('position-search');
      const hid = document.getElementById('new-person-position-id');
      if (search) search.value = '';
      if (hid) hid.value = '';
    }

    initPersonColorPicker();
    selectPersonColor(person.color || DEFAULT_PERSON_COLOR);

    // Admin
    const adminHidden = document.getElementById('new-person-is-admin');
    const adminBtn = document.getElementById('admin-toggle-btn');
    const isAdmin = !!(person.isAdmin || person.is_admin);
    if (adminHidden) adminHidden.value = isAdmin ? 'true' : 'false';
    if (adminBtn) {
      const adminField = adminBtn.closest('.form-field') || adminBtn.parentElement;
      if (adminField) adminField.style.display = '';
      adminBtn.textContent = isAdmin ? 'Remove Admin' : 'Make Admin';
    }

    if (typeof setPersonAccountFormState === 'function') {
      setPersonAccountFormState(true);
    }

    if (nameInput) nameInput.focus();
  }

  /* ===================== RENDER STAFF LIST ===================== */

  async function renderPeopleList() {
    const peopleList = document.getElementById('people-list');
    const countEl = document.getElementById('staff-count');
    if (!peopleList) return;

    let people = [];
    try {
      if (typeof getUsers === 'function') {
        people = await getUsers();
      } else if (typeof loadPeople === 'function') {
        await loadPeople();
        people = (typeof peopleData !== 'undefined' && Array.isArray(peopleData)) ? peopleData : [];
      } else {
        people = await DB.getUsers();
      }
    } catch (e) {
      people = [];
    }

    if (countEl) countEl.textContent = `(${people.length})`;

    if (!people || people.length === 0) {
      peopleList.innerHTML = '<div class="empty-state">No staff members yet. Add one below!</div>';
      return;
    }

    // sort active first
    const sorted = [...people].sort((a, b) => {
      if ((a.isActive === false) === (b.isActive === false)) {
        return (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '');
      }
      return a.isActive === false ? 1 : -1;
    });

    peopleList.innerHTML = sorted.map((person) => {
      const safeName = (typeof escapeHtml === 'function')
        ? escapeHtml(person.name || person.full_name || '')
        : (person.name || person.full_name || '');
      const safeColor = person.color || DEFAULT_PERSON_COLOR;
      const safeNameForJs = (person.name || person.full_name || '').replace(/'/g, "\\'");
      const pos = person.position ? `<span class="position-badge">${(typeof escapeHtml === 'function') ? escapeHtml(person.position) : person.position}</span>` : '';
      const isAdmin = (person.isAdmin || person.is_admin) ? `<span class="admin-badge">ADMIN</span>` : '';
      const isInactive = person.isActive === false ? ' (inactive)' : '';

      const initials = (typeof getInitials === 'function')
        ? getInitials(person.name || person.full_name)
        : (person.name || person.full_name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

      return `
        <div class="person-item${person.isActive === false ? ' is-inactive' : ''}"
             data-id="${person.id}"
             data-name="${safeName.toLowerCase()}"
             data-pos="${(person.position || '').toLowerCase()}">
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
            <button class="btn-icon btn-active-toggle"
                    onclick="toggleUserActive('${person.id}', ${!!person.isActive}, '${safeNameForJs}')"
                    aria-label="Toggle active for ${safeName}">
              ${person.isActive !== false ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn-icon btn-delete"
                    onclick="deletePerson('${person.id}', '${safeNameForJs}')"
                    aria-label="Delete ${safeName}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ===================== SAVE PERSON (with position support) ===================== */

  async function savePerson() {
    const nameInput = document.getElementById('new-person-name');
    const colorInput = document.getElementById('new-person-color');
    const emailInput = document.getElementById('new-person-email');
    const passwordInput = document.getElementById('new-person-password');
    const adminHidden = document.getElementById('new-person-is-admin');

    const name = (nameInput && nameInput.value) ? nameInput.value.trim() : '';
    const color = (colorInput && colorInput.value) ? colorInput.value : DEFAULT_PERSON_COLOR;
    const email = (emailInput && emailInput.value) ? emailInput.value.trim() : '';
    const password = (passwordInput && passwordInput.value) ? passwordInput.value : '';
    const isAdmin = adminHidden ? (adminHidden.value === 'true') : false;

    // Always read position from the hidden input
    let position_id = null;
    const pHid = document.getElementById('new-person-position-id');
    if (pHid && pHid.value) {
      position_id = pHid.value;
    }

    if (!name) {
      if (typeof showAlert === 'function') showAlert('Validation Error', 'Please enter a name');
      return;
    }

    try {
      if (window.editingPersonId) {
        // Edit
        await DB.updateUser(window.editingPersonId, {
          full_name: name,
          color,
          position_id,
          is_admin: isAdmin
        });

        if (passwordInput && passwordInput.value) {
          const newPass = passwordInput.value;
          if (newPass.length < 8) {
            if (typeof showAlert === 'function') showAlert('Validation Error', 'Password must be at least 8 characters long.');
            return;
          }
          await DB.resetUserPassword(window.editingPersonId, newPass);
        }
      } else {
        // Create - prefer real account if email+password given
        if (email || password) {
          if (!email || !password) {
            if (typeof showAlert === 'function') {
              showAlert('Validation Error', 'Provide both email and password to create a login account, or leave both blank.');
            }
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (typeof showAlert === 'function') showAlert('Validation Error', 'Please enter a valid email address.');
            return;
          }
          if (password.length < 8) {
            if (typeof showAlert === 'function') showAlert('Validation Error', 'Password must be at least 8 characters long.');
            return;
          }

          if (window.AuthAPI && typeof AuthAPI.register === 'function') {
            await AuthAPI.register({ email, password, full_name: name, color, is_admin: isAdmin, position_id });
          } else {
            await DB.createUser({ email, password, full_name: name, color, is_admin: isAdmin, position_id });
          }
        } else {
          // Synthetic non-login staff (index page legacy behavior)
          if (window.UsersAPI && typeof UsersAPI.create === 'function') {
            await UsersAPI.create({ email: `${name.toLowerCase().replace(/\s+/g, '.')}@letsee.local`, password: 'temppass123', full_name: name, color, is_admin: false, position_id });
          } else {
            await DB.createUser({ email: `${name.toLowerCase().replace(/\s+/g, '.')}@letsee.local`, password: 'temppass123', full_name: name, color, is_admin: false, position_id });
          }
        }
      }

      resetPersonForm();

      // Refresh views - support both page styles
      if (typeof refreshPeopleViews === 'function') {
        await refreshPeopleViews();
      } else if (typeof renderPeopleList === 'function') {
        await renderPeopleList();
      }
      if (typeof updatePeopleBlock === 'function') {
        try { await updatePeopleBlock(); } catch (e) {}
      }
    } catch (error) {
      console.error('Error saving person:', error);
      const msg = error.message || '';
      if (msg.includes('same as the current') || msg.includes('New password cannot')) {
        if (typeof showAlert === 'function') showAlert('Validation Error', msg);
      } else {
        if (typeof showAlert === 'function') {
          showAlert('Error', error.message || 'Failed to save staff member. Please try again.');
        }
      }
    }
  }

  /* ===================== DELETE / TOGGLE (shared wrappers) ===================== */

  async function deletePerson(id, name) {
    if (typeof showConfirm !== 'function') {
      if (!confirm(`Delete ${name}?`)) return;
      // fallback direct
      try {
        await (window.UsersAPI ? UsersAPI.delete(id) : DB.deleteUser(id));
        if (typeof refreshPeopleViews === 'function') await refreshPeopleViews();
      } catch (e) {
        alert('Delete failed: ' + (e.message || e));
      }
      return;
    }

    showConfirm('Delete Staff Member', `Are you sure you want to delete ${name}? This action cannot be undone.`, async () => {
      try {
        await (window.UsersAPI ? UsersAPI.delete(id) : DB.deleteUser(id));
        if (String(window.editingPersonId) === String(id)) {
          resetPersonForm();
        }
        if (typeof refreshPeopleViews === 'function') {
          await refreshPeopleViews();
        } else if (typeof renderPeopleList === 'function') {
          await renderPeopleList();
        }
      } catch (error) {
        console.error('Error deleting person:', error);
        if (typeof showAlert === 'function') {
          showAlert('Error', error.message || 'Failed to delete staff member.');
        }
      }
    });
  }

  async function toggleUserActive(id, currentActive, name) {
    const newActive = !currentActive;
    const action = newActive ? 'activate' : 'deactivate';
    try {
      await DB.updateUser(id, { is_active: newActive });
      if (typeof refreshPeopleViews === 'function') {
        await refreshPeopleViews();
      } else if (typeof renderPeopleList === 'function') {
        await renderPeopleList();
      }
      if (typeof showAlert === 'function') {
        showAlert('Success', `Staff member "${name}" ${action}d`);
      }
    } catch (error) {
      console.error('Error toggling active:', error);
      if (typeof showAlert === 'function') {
        showAlert('Error', error.message || `Failed to ${action} staff member.`);
      }
    }
  }

  /* ===================== EXPOSE GLOBALS ===================== */

  window.loadPositions = loadPositions;
  window.populatePositionOptions = populatePositionOptions;
  window.selectPosition = selectPosition;
  window.togglePositionDropdown = togglePositionDropdown;
  window.showPositionOptions = showPositionOptions;
  window.hidePositionOptions = hidePositionOptions;
  window.filterPositionDropdown = filterPositionDropdown;
  window.addNewPositionFromInput = addNewPositionFromInput;

  window.initPersonColorPicker = initPersonColorPicker;
  window.selectPersonColor = selectPersonColor;

  window.resetPersonForm = resetPersonForm;
  window.cancelPersonEdit = cancelPersonEdit;
  window.startPersonEdit = startPersonEdit;
  window.toggleFormAdmin = toggleFormAdmin;
  window.setPersonAccountFormState = setPersonAccountFormState;

  window.renderPeopleList = renderPeopleList;
  window.savePerson = savePerson;
  window.deletePerson = deletePerson;
  window.toggleUserActive = toggleUserActive;

  // Also attach some under a namespace for future
  window.Staff = {
    loadPositions,
    renderPeopleList,
    savePerson,
    startPersonEdit,
    resetPersonForm,
    showPositionOptions,
    hidePositionOptions
  };
})();
