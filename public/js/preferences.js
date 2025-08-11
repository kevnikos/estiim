/**
 * preferences.js
 * Handles loading, saving, and populating user preferences via cookies.
 */

/**
 * Loads user preferences from cookies into the global state.
 */
export function loadPreferences() {
    const prefsCookie = getCookie('estiim_prefs');
    if (prefsCookie) {
        try {
            const parsedPrefs = JSON.parse(prefsCookie);
            window.userPreferences = {
                initiativeStatusFilter: parsedPrefs.initiativeStatusFilter || '', // New: default to all
                enableBranding: parsedPrefs.enableBranding !== false // default true
            };
        } catch (e) {
            console.error("Error parsing preferences cookie:", e);
        }
    } else {
        window.userPreferences = {
            initiativeStatusFilter: '',
            enableBranding: true
        };
    }
}

/**
 * Saves the current preferences from the form to a cookie.
 */
export function savePreferences() {
    window.userPreferences.initiativeStatusFilter = document.getElementById('init-status-filter').value; // Save the status filter
    window.userPreferences.enableBranding = document.getElementById('branding-checkbox').checked;

    setCookie('estiim_prefs', JSON.stringify(window.userPreferences), 365);
    window.showMessage('Success', 'Preferences saved successfully!', 'success');
    window.loadInitiatives(window.currentSortColumn, window.currentSortDirection);
    window.applyBranding();
}

/**
 * Populates the preferences form with the current settings.
 */
export function populatePrefsPage() {
    // Set the status filter dropdown value
    const statusFilterDropdown = document.getElementById('init-status-filter');
    if (statusFilterDropdown) {
        statusFilterDropdown.value = window.userPreferences.initiativeStatusFilter;
    }
    const brandingCheckbox = document.getElementById('branding-checkbox');
    if (brandingCheckbox) {
        brandingCheckbox.checked = window.userPreferences.enableBranding !== false;
    }
}

// --- Cookie Helper Functions ---

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}
