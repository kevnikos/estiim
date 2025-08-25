/**
 * resourceTypes.js
 * Handles CRUD operations and UI for the Resource Types section.
 */

import { formatNumberInput, parseFormattedNumber } from './factorPicker.js';
import { formatDateInEST } from './ui.js';

/**
 * Loads and displays the list of resource types.
 */
export async function loadRT() {
    const res = await fetch(window.API + '/api/resource-types');
    window.rtList = await res.json();
    const searchQuery = document.getElementById('rt-search-input')?.value.toLowerCase() || '';
    const filteredResourceTypes = window.rtList
        .filter(r => r.name.toLowerCase().includes(searchQuery) || (r.description && r.description.toLowerCase().includes(searchQuery)))
        .sort((a, b) => a.name.localeCompare(b.name));

    const tbody = document.querySelector('#rt-table tbody');
    tbody.innerHTML = '';
    const itemsToDisplay = filteredResourceTypes;
    itemsToDisplay.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.name}</td>
            <td>${r.description || ''}</td>
            <td>${r.resource_category || ''}</td>
            <td>${r.resource_cost ? formatNumberInput(r.resource_cost) : ''}</td>
            <td class="actions-cell">
                <button class="edit-btn">Edit</button>
                <button class="delete-btn" style="background:var(--red)">Del</button>
                <button class="audit-btn" style="background:var(--primary)">🔍</button>
            </td>`;
        tbody.appendChild(tr);
        
        // Add event listeners
        const editBtn = tr.querySelector('.edit-btn');
        const deleteBtn = tr.querySelector('.delete-btn');
        const auditBtn = tr.querySelector('.audit-btn');
        
        editBtn.addEventListener('click', () => editRT(r.id));
        deleteBtn.addEventListener('click', () => delRT(r.id));
        auditBtn.addEventListener('click', () => showResourceTypeAuditTrail(r.id));
    });
}

/**
 * Opens the modal to add a new resource type.
 */
export function openAddResourceTypeModal() {
    document.getElementById('rt-id').value = '';
    document.getElementById('rt-name').value = '';
    document.getElementById('rt-desc').value = '';
    document.getElementById('rt-category').value = 'Labour';
    document.getElementById('rt-cost').value = '';
    window.openModal('rt');
}

/**
 * Opens the modal to edit a resource type.
 * @param {string} id - The ID of the resource type to edit.
 */
export function editRT(id) {
    const rt = window.rtList.find(x => x.id === id);
    document.getElementById('rt-id').value = rt.id;
    document.getElementById('rt-name').value = rt.name;
    document.getElementById('rt-desc').value = rt.description || '';
    document.getElementById('rt-category').value = rt.resource_category || 'Labour';
    document.getElementById('rt-cost').value = rt.resource_cost ? formatNumberInput(rt.resource_cost) : '';
    window.openModal('rt');
}

/**
 * Deletes a resource type after confirmation.
 * @param {string} id - The ID of the resource type to delete.
 */
export async function delRT(id) {
    if (!confirm('Delete?')) return;
    await fetch(window.API + `/api/resource-types/${id}`, { method: 'DELETE' });
    loadRT();
}

/**
 * Compares old and new data for a resource type and returns an array of change descriptions.
 * @param {object} oldData - The old resource type data.
 * @param {object} newData - The new resource type data.
 * @returns {string[]} An array of strings describing the changes.
 */
function getResourceTypeAuditDiffs(oldData, newData) {
    console.log('getResourceTypeAuditDiffs called with:', { oldData, newData });
    const diffs = [];
    
    // Compare name
    if (oldData.name !== newData.name) {
        console.log('Name changed:', oldData.name, '->', newData.name);
        diffs.push(`- Changed name from <span class="diff-removed">${oldData.name || '""'}</span> to <span class="diff-added">${newData.name || '""'}</span>`);
    }
    
    // Compare description
    if (oldData.description !== newData.description) {
        console.log('Description changed:', oldData.description, '->', newData.description);
        diffs.push(`- Changed description from <span class="diff-removed">${oldData.description || '""'}</span> to <span class="diff-added">${newData.description || '""'}</span>`);
    }
    
    // Compare resource category
    if (oldData.resource_category !== newData.resource_category) {
        console.log('Resource category changed:', oldData.resource_category, '->', newData.resource_category);
        diffs.push(`- Changed resource category from <span class="diff-removed">${oldData.resource_category || '""'}</span> to <span class="diff-added">${newData.resource_category || '""'}</span>`);
    }
    
    // Compare resource cost
    const oldCost = oldData.resource_cost || 0;
    const newCost = newData.resource_cost || 0;
    console.log('Comparing costs:', { oldCost, newCost, oldType: typeof oldCost, newType: typeof newCost });
    if (parseFloat(oldCost) !== parseFloat(newCost)) {
        console.log('Resource cost changed:', oldCost, '->', newCost);
        const oldFormatted = oldCost > 0 ? formatNumberInput(parseFloat(oldCost)) : '0.00';
        const newFormatted = newCost > 0 ? formatNumberInput(parseFloat(newCost)) : '0.00';
        diffs.push(`- Changed resource cost from <span class="diff-removed">$${oldFormatted}</span> to <span class="diff-added">$${newFormatted}</span>`);
    }
    
    console.log('Generated diffs:', diffs);
    return diffs;
}

/**
 * Shows the audit trail for a resource type in a modal.
 * @param {string} id - The ID of the resource type.
 */
export async function showResourceTypeAuditTrail(id) {
    const rt = window.rtList.find(x => x.id === id);
    if (!rt) {
        window.showMessage('Error', 'Resource type not found', 'error');
        return;
    }
    
    document.getElementById('rt-audit-title').textContent = `Audit Trail: ${rt.name}`;
    const auditContent = document.getElementById('rt-audit-content');
    auditContent.innerHTML = 'Loading...';
    window.openModal('rt-audit');

    try {
        const response = await fetch(window.API + `/api/resource-types/${id}/audit`);
        if (!response.ok) throw new Error('Failed to fetch audit trail');
        const auditLog = await response.json();
        
        console.log('Resource type audit log received:', auditLog);
        
        auditContent.innerHTML = '';
        if (auditLog.length === 0) {
            auditContent.innerHTML = '<p>No audit history for this resource type.</p>';
        } else {
            const sortedAuditLog = [...auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            sortedAuditLog.forEach(entry => {
                console.log('Processing audit entry:', entry);
                const logItem = document.createElement('div');
                logItem.className = 'audit-item';
                let details = '';
                if (entry.type === 'audit') {
                    logItem.classList.add('audit');
                    let oldData = {};
                    let newData = {};
                    
                    // Parse old_data and new_data which are JSON strings
                    try {
                        oldData = typeof entry.old_data === 'string' ? JSON.parse(entry.old_data || '{}') : (entry.old_data || {});
                        newData = typeof entry.new_data === 'string' ? JSON.parse(entry.new_data || '{}') : (entry.new_data || {});
                        console.log('Parsed audit data:', { oldData, newData });
                    } catch (e) {
                        console.error('Error parsing audit data:', e, { old_data: entry.old_data, new_data: entry.new_data });
                    }
                    
                    if (entry.action === 'created') {
                        details = `Created resource type: ${newData.name || 'N/A'} with category: ${newData.resource_category || 'N/A'}.`;
                    } else if (entry.action === 'updated') {
                        const diffs = getResourceTypeAuditDiffs(oldData, newData);
                        console.log('Generated diffs:', diffs);
                        details = diffs.length > 0 ? diffs.join('<br>') : 'No changes to tracked fields.';
                    }
                    logItem.innerHTML = `<h4>${entry.action.charAt(0).toUpperCase() + entry.action.slice(1).replace(/_/g, ' ')} on ${formatDateInEST(entry.timestamp)}</h4><p>${details}</p>`;
                } else {
                    logItem.innerHTML = `<h4>Comment on ${formatDateInEST(entry.timestamp)}</h4><p>${entry.text}</p>`;
                }
                auditContent.appendChild(logItem);
            });
        }
    } catch (error) {
        auditContent.innerHTML = `<p style="color:var(--red);">Error fetching audit trail: ${error.message || error}</p>`;
    }
}

/**
 * Saves a new or existing resource type.
 */
export async function saveResourceType() {
    const id = document.getElementById('rt-id').value.trim();
    const name = document.getElementById('rt-name').value.trim();
    if (!name) {
        window.showMessage('Error', 'Name required', 'error');
        return;
    }
    const desc = document.getElementById('rt-desc').value;
    const resource_category = document.getElementById('rt-category').value;
    const resource_cost_input = document.getElementById('rt-cost').value;
    const resource_cost = parseFormattedNumber(resource_cost_input);
    
    if (resource_cost_input && (isNaN(resource_cost) || resource_cost < 0)) {
        window.showMessage('Error', 'Resource Cost must be a valid positive number', 'error');
        return;
    }

    const url = id ? `/api/resource-types/${id}` : '/api/resource-types';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(window.API + url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name, 
            description: desc, 
            resource_category,
            resource_cost: resource_cost_input ? resource_cost : null
        })
    });
    if (!res.ok) {
        window.showMessage('Error', 'Error: ' + res.status, 'error');
        return;
    }
    window.closeModal('rt');
    loadRT();
}

/**
 * Handles input events for resource cost field
 */
export function handleResourceCostInput(input) {
    // Allow typing without immediate formatting to avoid cursor jumping
}

/**
 * Handles blur events for resource cost field - applies formatting
 */
export function handleResourceCostBlur(input) {
    const rawValue = parseFormattedNumber(input.value);
    input.value = formatNumberInput(rawValue);
}
