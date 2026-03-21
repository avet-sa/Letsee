// Shared UI Utilities for Letsee Frontend

/**
 * Show an alert modal with a title and message
 * @param {string} title - The title of the alert
 * @param {string} message - The message to display
 */
function showAlert(title, message) {
  const titleEl = document.getElementById("alert-title");
  const messageEl = document.getElementById("alert-message");
  const modalEl = document.getElementById("alert-modal");

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (modalEl) modalEl.style.display = "flex";
}

/**
 * Close the alert modal
 */
function closeAlertModal() {
  const modalEl = document.getElementById("alert-modal");
  if (modalEl) modalEl.style.display = "none";
}

/**
 * Show a confirmation modal
 * @param {string} title - The title of the confirmation
 * @param {string} message - The message to display
 * @param {Function} onConfirm - Callback function to execute on confirmation
 */
function showConfirm(title, message, onConfirm) {
  const titleEl = document.getElementById("confirm-title");
  const messageEl = document.getElementById("confirm-message");
  const modalEl = document.getElementById("confirm-modal");

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (modalEl) modalEl.style.display = "flex";

  window.confirmAction = onConfirm;
}

/**
 * Close the confirmation modal
 */
function closeConfirmModal() {
  const modalEl = document.getElementById("confirm-modal");
  if (modalEl) modalEl.style.display = "none";
  window.confirmAction = null;
}

/**
 * Execute the confirmation action
 */
function executeConfirmAction() {
  if (window.confirmAction) {
    window.confirmAction();
  }
  closeConfirmModal();
}
