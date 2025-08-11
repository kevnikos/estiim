/**
 * dropdownOptions.js
 * Manages custom dropdown options for initiatives
 */

// Cache for dropdown options
let dropdownOptionsCache = {
    status: [],
    type: [],
    priority: []
};

// Initialize dropdown options on page load
export async function initDropdownOptions() {
    await loadAllDropdownOptions();
    setupDropdownOptionsListeners();
}

// Load all dropdown options from the server
async function loadAllDropdownOptions() {
    try {
        const response = await fetch('/api/dropdown-options');
        const data = await response.json();
        
        // Update cache
        dropdownOptionsCache = {
            status: data.status || [],
            type: data.type || [],
            priority: data.priority || []
        };
        
        // Update all dropdown lists
        updateDropdownLists();
        
        // Update initiative form dropdowns
        populateInitiativeFormDropdowns();
        
        // Update status filter
        populateStatusFilter();
    } catch (error) {
        console.error('Failed to load dropdown options:', error);
    }
}

// Update all dropdown lists in the preferences page
function updateDropdownLists() {
    const statusList = document.getElementById('status-options-list');
    const typeList = document.getElementById('type-options-list');
    const priorityList = document.getElementById('priority-options-list');
    
    if (statusList) updateDropdownList(statusList, dropdownOptionsCache.status);
    if (typeList) updateDropdownList(typeList, dropdownOptionsCache.type);
    if (priorityList) updateDropdownList(priorityList, dropdownOptionsCache.priority);
}

// Update a single dropdown list element
function updateDropdownList(selectElement, options) {
    selectElement.innerHTML = '';
    options.forEach(option => {
        const optEl = document.createElement('option');
        optEl.value = option;
        optEl.textContent = option;
        selectElement.appendChild(optEl);
    });
}

// Populate all dropdowns in the initiative form
export function populateInitiativeFormDropdowns() {
    const statusSelect = document.getElementById('init-status');
    const typeSelect = document.getElementById('init-estimation-type');
    const prioritySelect = document.getElementById('init-priority');
    
    if (statusSelect) updateFormDropdown(statusSelect, dropdownOptionsCache.status);
    if (typeSelect) updateFormDropdown(typeSelect, dropdownOptionsCache.type);
    if (prioritySelect) updateFormDropdown(prioritySelect, dropdownOptionsCache.priority);
}

// Update a single form dropdown
function updateFormDropdown(selectElement, options) {
    selectElement.innerHTML = '';
    options.forEach(option => {
        const optEl = document.createElement('option');
        optEl.value = option;
        optEl.textContent = option;
        selectElement.appendChild(optEl);
    });
}

// Populate the status filter dropdown in the main initiatives page
export function populateStatusFilter() {
    const filterSelect = document.getElementById('init-status-filter');
    if (!filterSelect) return;
    
    filterSelect.innerHTML = '';
    
    // Add the "All Statuses" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Statuses';
    filterSelect.appendChild(allOption);
    
    // Add the status options
    dropdownOptionsCache.status.forEach(status => {
        const optEl = document.createElement('option');
        optEl.value = status;
        optEl.textContent = status;
        filterSelect.appendChild(optEl);
    });
}

// Set up event listeners for dropdown option management
function setupDropdownOptionsListeners() {
    // Add option buttons
    document.querySelectorAll('[onclick^="window.addDropdownOption"]').forEach(button => {
        const category = button.getAttribute('onclick').match(/'(.+)'/)[1];
        button.onclick = () => addDropdownOption(category);
    });
    
    // Edit option buttons
    document.querySelectorAll('[onclick^="window.editDropdownOption"]').forEach(button => {
        const category = button.getAttribute('onclick').match(/'(.+)'/)[1];
        button.onclick = () => editDropdownOption(category);
    });
    
    // Remove option buttons
    document.querySelectorAll('[onclick^="window.removeDropdownOption"]').forEach(button => {
        const category = button.getAttribute('onclick').match(/'(.+)'/)[1];
        button.onclick = () => removeDropdownOption(category);
    });
}

// Add a new dropdown option
async function addDropdownOption(category) {
    const value = prompt(`Enter new ${category} option:`);
    if (!value) return;
    
    try {
        const response = await fetch('/api/dropdown-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, value })
        });
        
        if (response.ok) {
            await loadAllDropdownOptions();
            window.showMessage('Success', `${value} added to ${category} options`, 'success');
        } else {
            const error = await response.text();
            window.showMessage('Error', `Failed to add option: ${error}`, 'error');
        }
    } catch (error) {
        console.error('Failed to add dropdown option:', error);
        window.showMessage('Error', 'Failed to add option. Please try again.', 'error');
    }
}

// Edit a dropdown option
async function editDropdownOption(category) {
    const select = document.getElementById(`${category}-options-list`);
    if (!select || !select.value) {
        window.showMessage('Error', 'Please select an option to edit.', 'error');
        return;
    }
    
    const oldValue = select.value;
    const newValue = prompt(`Edit ${category} option:`, oldValue);
    if (!newValue || newValue === oldValue) return;
    
    try {
        const response = await fetch('/api/dropdown-options', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, oldValue, newValue })
        });
        
        if (response.ok) {
            await loadAllDropdownOptions();
            window.showMessage('Success', `${oldValue} changed to ${newValue}`, 'success');
        } else {
            const error = await response.text();
            window.showMessage('Error', `Failed to edit option: ${error}`, 'error');
        }
    } catch (error) {
        console.error('Failed to edit dropdown option:', error);
        window.showMessage('Error', 'Failed to edit option. Please try again.', 'error');
    }
}

// Remove a dropdown option
async function removeDropdownOption(category) {
    const select = document.getElementById(`${category}-options-list`);
    if (!select || !select.value) {
        window.showMessage('Error', 'Please select an option to remove.', 'error');
        return;
    }
    
    const value = select.value;
    if (!confirm(`Are you sure you want to remove the ${category} option "${value}"?`)) return;
    
    try {
        const response = await fetch('/api/dropdown-options', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, value })
        });
        
        if (response.ok) {
            await loadAllDropdownOptions();
            window.showMessage('Success', `${value} removed from ${category} options`, 'success');
        } else {
            const error = await response.text();
            window.showMessage('Error', `Failed to remove option: ${error}`, 'error');
        }
    } catch (error) {
        console.error('Failed to remove dropdown option:', error);
        window.showMessage('Error', 'Failed to remove option. Please try again.', 'error');
    }
}

// Get dropdown options for a category
export function getDropdownOptions(category) {
    return dropdownOptionsCache[category] || [];
}

// Expose methods to window object for onclick handlers
window.addDropdownOption = addDropdownOption;
window.editDropdownOption = editDropdownOption;
window.removeDropdownOption = removeDropdownOption;
