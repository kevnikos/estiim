/**
 * resourceTypes.js
 * Handles CRUD operations and UI for the Resource Types section.
 */

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
            <td>${r.resource_cost ? r.resource_cost.toFixed(2) : ''}</td>
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
    document.getElementById('rt-cost').value = rt.resource_cost || '';
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
 * Shows the audit trail for a resource type in a modal.
 * @param {string} id - The ID of the resource type.
 */
export async function showResourceTypeAuditTrail(id) {
    console.log('showResourceTypeAuditTrail called with id:', id);
    try {
        console.log('Fetching audit trail from:', window.API + `/api/resource-types/${id}/audit`);
        const response = await fetch(window.API + `/api/resource-types/${id}/audit`);
        console.log('Response status:', response.status, response.ok);
        
        if (!response.ok) throw new Error('Failed to fetch audit trail');
        const audit = await response.json();
        console.log('Audit data received:', audit);
        
        const rt = window.rtList.find(x => x.id === id);
        console.log('Resource type found:', rt);
        
        const modalContent = document.createElement('div');
        modalContent.innerHTML = `
            <h2>Audit Trail - ${rt.name}</h2>
            <div class="audit-trail-container">
                <table class="audit-trail-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Action</th>
                            <th>Name</th>
                            <th>Description</th>
                            <th>Resource Type</th>
                            <th>Resource Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${audit.map(entry => {
                            let newData = {};
                            try {
                                newData = JSON.parse(entry.new_data || '{}');
                            } catch (e) {
                                console.error('Error parsing new_data:', e);
                            }
                            
                            return `
                                <tr>
                                    <td>${new Date(entry.timestamp).toLocaleString()}</td>
                                    <td>${entry.action}</td>
                                    <td>${newData.name || ''}</td>
                                    <td>${newData.description || ''}</td>
                                    <td>${newData.resource_category || ''}</td>
                                    <td>${newData.resource_cost ? parseFloat(newData.resource_cost).toFixed(2) : ''}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Remove any existing modal
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal) {
            console.log('Removing existing modal');
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <button class="close">×</button>
                ${modalContent.innerHTML}
            </div>`;
            
        console.log('Modal created, adding event listeners');
        
        // Add close button event listener
        modal.querySelector('.close').addEventListener('click', () => {
            console.log('Close button clicked');
            modal.remove();
        });
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Clicked outside modal');
                modal.remove();
            }
        });
        
        // Append modal to document body
        console.log('Appending modal to document body');
        document.body.appendChild(modal);
        
        // Make the modal visible by setting display to flex
        modal.style.display = 'flex';
        console.log('Modal should now be visible');
        
    } catch (error) {
        console.error('Error displaying audit trail:', error);
        window.showMessage('Error', 'Failed to load audit trail', 'error');
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
    const resource_cost = parseFloat(document.getElementById('rt-cost').value);
    
    if (document.getElementById('rt-cost').value && isNaN(resource_cost)) {
        window.showMessage('Error', 'Resource Cost must be a valid number', 'error');
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
            resource_cost: document.getElementById('rt-cost').value ? resource_cost.toFixed(2) : null
        })
    });
    if (!res.ok) {
        window.showMessage('Error', 'Error: ' + res.status, 'error');
        return;
    }
    window.closeModal('rt');
    loadRT();
}
