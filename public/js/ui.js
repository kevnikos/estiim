/**
 * ui.js
 * Contains general UI helper functions for modals, messages, and formatting.
 */

/**
 * Formats an ISO date string into a more readable format for the EST time zone.
 * @param {string} isoString - The ISO date string to format.
 * @param {boolean} [includeTime=true] - Whether to include the time in the output.
 * @returns {string} The formatted date string.
 */
export function formatDateInEST(isoString, includeTime = true) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/New_York'
    };
    let datePart = date.toLocaleString('en-US', options);

    if (includeTime) {
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'America/New_York'
        };
        let timePart = date.toLocaleString('en-US', timeOptions);
        return `${datePart.replace(/,/g, '')} ${timePart.replace(/,/g, '')}`;
    }
    return datePart.replace(/,/g, '');
}

/**
 * Displays a custom message box modal.
 * @param {string} title - The title of the message.
 * @param {string} message - The content of the message.
 * @param {string} [type='info'] - The type of message ('info', 'success', 'error').
 */
export function showMessage(title, message, type = 'info') {
    const modal = document.getElementById('messageBoxModal');
    const titleElement = document.getElementById('messageBoxTitle');
    const contentElement = document.getElementById('messageBoxContent');
    const messageBox = modal.querySelector('.message-box');

    titleElement.textContent = title;
    contentElement.textContent = message;

    messageBox.classList.remove('success', 'error');
    if (type === 'success') {
        messageBox.classList.add('success');
    } else if (type === 'error') {
        messageBox.classList.add('error');
    }

    modal.style.display = 'flex';
}

/**
 * Hides the custom message box modal.
 */
export function hideMessage() {
    document.getElementById('messageBoxModal').style.display = 'none';
}

/**
 * Displays a modal by its type identifier.
 * @param {string} type - The type of modal to open (e.g., 'init', 'rt').
 */
export function openModal(type) {
  document.getElementById('modal-' + type).style.display = 'flex';
}

/**
 * Closes a modal by its type identifier.
 * @param {string} type - The type of modal to close.
 */
export function closeModal(type) {
  document.getElementById('modal-' + type).style.display = 'none';
}

/**
 * Toggles the visibility of the flyout navigation menu.
 */
export function toggleFlyoutMenu() {
    const flyoutMenu = document.getElementById('flyout-menu');
    flyoutMenu.classList.toggle('active');
}
