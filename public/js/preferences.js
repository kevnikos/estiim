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
                maxInitiatives: parsedPrefs.maxInitiatives || 8,
                maxResourceTypes: parsedPrefs.maxResourceTypes || 5,
                maxEstimationFactors: parsedPrefs.maxEstimationFactors || 5,
                initiativeStatusFilter: parsedPrefs.initiativeStatusFilter || '' // New: default to all
            };
        } catch (e) {
            console.error("Error parsing preferences cookie:", e);
        }
    }
}

/**
 * Saves the current preferences from the form to a cookie.
 */
export function savePreferences() {
    window.userPreferences.maxInitiatives = parseInt(document.getElementById('pref-max-initiatives').value, 10) || 8;
    window.userPreferences.maxResourceTypes = parseInt(document.getElementById('pref-max-resource-types').value, 10) || 5;
    window.userPreferences.maxEstimationFactors = parseInt(document.getElementById('pref-max-estimation-factors').value, 10) || 5;
    window.userPreferences.initiativeStatusFilter = document.getElementById('init-status-filter').value; // Save the status filter

    setCookie('estiim_prefs', JSON.stringify(window.userPreferences), 365);
    window.showMessage('Success', 'Preferences saved successfully!', 'success');
    
    // Reload relevant sections to apply new limits
    window.loadInitiatives(window.currentSortColumn, window.currentSortDirection);
    window.loadRT();
    window.loadEF();
}

/**
 * Populates the preferences form with the current settings.
 */
export function populatePrefsPage() {
    document.getElementById('pref-max-initiatives').value = window.userPreferences.maxInitiatives;
    document.getElementById('pref-max-resource-types').value = window.userPreferences.maxResourceTypes;
    document.getElementById('pref-max-estimation-factors').value = window.userPreferences.maxEstimationFactors;
    // Set the status filter dropdown value
    const statusFilterDropdown = document.getElementById('init-status-filter');
    if (statusFilterDropdown) {
        statusFilterDropdown.value = window.userPreferences.initiativeStatusFilter;
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
