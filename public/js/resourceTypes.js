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
        tr.innerHTML = `<td>${r.name}</td><td>${r.description || ''}</td><td><button onclick="window.editRT('${r.id}')">Edit</button><button onclick="window.delRT('${r.id}')" style="background:var(--red)">Del</button></td>`;
        tbody.appendChild(tr);
    });
}

/**
 * Opens the modal to add a new resource type.
 */
export function openAddResourceTypeModal() {
    document.getElementById('rt-id').value = '';
    document.getElementById('rt-name').value = '';
    document.getElementById('rt-desc').value = '';
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
    const url = id ? `/api/resource-types/${id}` : '/api/resource-types';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(window.API + url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc })
    });
    if (!res.ok) {
        window.showMessage('Error', 'Error: ' + res.status, 'error');
        return;
    }
    window.closeModal('rt');
    loadRT();
}
