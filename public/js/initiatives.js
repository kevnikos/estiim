/**
 * initiatives.js
 * Handles all CRUD operations, event handling, and UI rendering for the Initiatives section.
 */
import { formatDateInEST } from './ui.js';
// Cookie utility functions
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0;i < ca.length;i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

// Handle status filter persistence and setup
export function initStatusFilter() {
    const statusFilter = document.getElementById('init-status-filter');
    if (!statusFilter) return;

    // Set up the change handler (only once)
    if (!statusFilter.hasChangeListener) {
        statusFilter.hasChangeListener = true;
        statusFilter.addEventListener('change', (e) => {
            setCookie('initiatives_status', e.target.value, 30);
            window.loadInitiatives(window.currentSortColumn, window.currentSortDirection);
        });
    }

    // Restore saved value
    const savedStatus = getCookie('initiatives_status');
    if (savedStatus !== null) {
        statusFilter.value = savedStatus;
    }
}

/**
 * Loads and displays the list of initiatives, with filtering and sorting.
 * @param {string} [sortBy='created_at'] - The column to sort by.
 * @param {string} [sortDirection='desc'] - The direction to sort ('asc' or 'desc').
 */
export async function loadInitiatives(sortBy = 'created_at', sortDirection = 'desc') {
    const statusFilterElem = document.getElementById('init-status-filter');
    let statusFilter = '';
    if (statusFilterElem) {
        statusFilter = statusFilterElem.value || '';
    }
  let url = window.API + '/api/initiatives';
  if (statusFilter) {
    url += `?status=${encodeURIComponent(statusFilter)}`;
  }
  const res = await fetch(url);
  let allInitiatives = await res.json();
  window.initList = allInitiatives; // Still store all initiatives for other uses like edit

  // No client-side filtering here, as filtering is done on the backend.
  // However, sorting is still done client-side.
  allInitiatives.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (sortBy === 'id' || sortBy === 'computed_hours' || sortBy === 'priority_num') {
        valA = parseFloat(valA || 0);
        valB = parseFloat(valB || 0);
    } else if (sortBy.includes('_date') || sortBy.includes('_at')) {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
    } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
    }
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.querySelector('#init-table tbody');
  tbody.innerHTML = '';
  const itemsToDisplay = allInitiatives; // Directly use all initiatives from the backend

  itemsToDisplay.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i.id || ''}</td>
      <td>${i.custom_id || ''}</td>
      <td>${i.name}</td>
      <td>${i.priority}</td>
      <td>${i.estimation_type}</td>
      <td>${i.status || ''}</td>
      <td>${i.shirt_size || ''}</td>
      <td>${i.computed_hours || 0}</td>
      <td>${formatDateInEST(i.created_at, true)}</td>
      <td>${formatDateInEST(i.updated_at, true)}</td>
      <td style="white-space:nowrap;">
        <button onclick="window.editInitiative(${i.id})">Edit</button>
        <button onclick="window.deleteInitiative(${i.id})" style="background:var(--red)">Del</button>
        <button onclick="window.showAuditTrail('${i.id}', '${i.name}')">🔍</button>
      </td>`;
    tbody.appendChild(tr);
  });

  updateSortIndicators(sortBy, sortDirection);
  setupInitiativeTableSorting();
}

/**
 * Opens the modal to add a new initiative, clearing all fields.
 */
export function addInitiative() {
    document.getElementById('init-id').value = '';
    document.getElementById('init-name').value = '';
    document.getElementById('init-custom-id').value = '';
    document.getElementById('init-desc').value = '';
    document.getElementById('init-priority').value = 'Low';
    document.getElementById('init-priority-num').value = '';
    document.getElementById('init-status').value = 'To Do';
    document.getElementById('init-estimation-type').value = 'WAG';
    document.getElementById('init-start-date').value = '';
    document.getElementById('init-end-date').value = '';
    document.getElementById('init-scope').value = '';
    document.getElementById('init-out').value = '';
    document.getElementById('init-created').textContent = '';
    document.getElementById('init-updated').textContent = '';
    document.getElementById('init-calculated-shirt-size').textContent = '';
    window.selectedFactors = [];
    window.currentInitiativeJournal = [];
    window.renderSelectedFactorsSummary();
    renderJournalLog();
    document.getElementById('journal-comment-input').value = '';
    window.openModal('init');
}

/**
 * Opens the modal to edit an existing initiative, populating fields with its data.
 * @param {number} id - The ID of the initiative to edit.
 */
export function editInitiative(id) {
    const numericId = parseInt(id, 10);
    const init = window.initList.find(x => parseInt(x.id, 10) === numericId);
    if (!init) {
        window.showMessage('Error', 'Initiative not found.', 'error');
        return;
    }

    document.getElementById('init-id').value = init.id;
    document.getElementById('init-name').value = init.name;
    document.getElementById('init-custom-id').value = init.custom_id || '';
    document.getElementById('init-desc').value = init.description || '';
    document.getElementById('init-priority').value = init.priority || 'Low';
    document.getElementById('init-priority-num').value = init.priority_num || '';
    document.getElementById('init-status').value = init.status || 'To Do';
    document.getElementById('init-estimation-type').value = init.estimation_type || 'WAG';
    document.getElementById('init-start-date').value = init.start_date ? init.start_date.substring(0, 10) : '';
    document.getElementById('init-end-date').value = init.end_date ? init.end_date.substring(0, 10) : '';
    document.getElementById('init-scope').value = init.scope || '';
    document.getElementById('init-out').value = init.out_of_scope || '';
    document.getElementById('init-created').textContent = formatDateInEST(init.created_at);
    document.getElementById('init-updated').textContent = formatDateInEST(init.updated_at);
    document.getElementById('init-calculated-shirt-size').textContent = `Calculated T-Shirt Size: ${init.shirt_size || 'N/A'} (${init.computed_hours || 0}h)`;
    
    window.selectedFactors = init.selected_factors || []; 
    window.currentInitiativeJournal = init.journal_entries || []; 
    window.renderSelectedFactorsSummary();
    renderJournalLog();
    document.getElementById('journal-comment-input').value = '';
    window.openModal('init');
}

/**
 * Deletes an initiative after confirmation.
 * @param {number} id - The ID of the initiative to delete.
 */
export async function deleteInitiative(id) { 
  if (!confirm('Delete?')) return; 
  await fetch(window.API + `/api/initiatives/${id}`, { method: 'DELETE' }); 
  loadInitiatives(); 
}

/**
 * Saves a new or existing initiative to the database.
 */
export async function saveInitiative() { 
    const id = document.getElementById('init-id').value.trim(); 
    const name = document.getElementById('init-name').value.trim(); 
    if (!name) { 
        window.showMessage('Error', 'Name required', 'error');
        return;
    } 
    
    const payload = {
        name,
        custom_id: document.getElementById('init-custom-id').value.trim(),
        description: document.getElementById('init-desc').value.trim(),
        priority: document.getElementById('init-priority').value,
        priority_num: +document.getElementById('init-priority-num').value || 0,
        status: document.getElementById('init-status').value,
        estimation_type: document.getElementById('init-estimation-type').value,
        classification: 'Internal',
        scope: document.getElementById('init-scope').value.trim(),
        out_of_scope: document.getElementById('init-out').value.trim(),
        selected_factors: window.selectedFactors,
        start_date: document.getElementById('init-start-date').value.trim() || null,
        end_date: document.getElementById('init-end-date').value.trim() || null,
        journal_entries: window.currentInitiativeJournal
    }; 
    
    const url = id ? `/api/initiatives/${id}` : '/api/initiatives'; 
    const method = id ? 'PUT' : 'POST'; 
    const res = await fetch(window.API + url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }); 
    
    if (!res.ok) { 
        window.showMessage('Error', 'Error:' + res.status, 'error'); 
        return; 
    }
    window.closeModal('init'); 
    loadInitiatives(); 
}

/**
 * Duplicates the currently viewed initiative.
 */
export async function duplicateInitiative() {
    const originalName = document.getElementById('init-name').value.trim();
    if (!originalName) {
        window.showMessage('Error', 'Name is required to duplicate.', 'error');
        return;
    }

    const newName = originalName + " Copy";
    const newJournalEntry = {
        timestamp: new Date().toISOString(),
        type: 'audit',
        action: 'duplicated_from',
        original_name: originalName
    };

    const payload = {
        name: newName,
        custom_id: document.getElementById('init-custom-id').value.trim(),
        description: document.getElementById('init-desc').value.trim(),
        priority: document.getElementById('init-priority').value,
        priority_num: +document.getElementById('init-priority-num').value || 0,
        status: document.getElementById('init-status').value,
        estimation_type: document.getElementById('init-estimation-type').value,
        classification: 'Internal',
        scope: document.getElementById('init-scope').value.trim(),
        out_of_scope: document.getElementById('init-out').value.trim(),
        selected_factors: window.selectedFactors,
        start_date: document.getElementById('init-start-date').value.trim() || null,
        end_date: document.getElementById('init-end-date').value.trim() || null,
        journal_entries: [newJournalEntry]
    };

    try {
        const res = await fetch(window.API + '/api/initiatives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || `Server responded with status ${res.status}`);
        }
        window.showMessage('Success', `Initiative "${newName}" duplicated successfully!`, 'success');
        window.closeModal('init');
        loadInitiatives();
    } catch (error) {
        console.error('Duplicate initiative failed:', error);
        window.showMessage('Error', 'Failed to duplicate initiative: ' + error.message, 'error');
    }
}

/**
 * Displays the audit trail for a specific initiative.
 * @param {number} initiativeId - The ID of the initiative.
 * @param {string} initiativeName - The name of the initiative.
 */
export async function showAuditTrail(initiativeId, initiativeName) {
    document.getElementById('audit-title').textContent = `Audit Trail: ${initiativeName}`;
    const auditContent = document.getElementById('audit-content');
    auditContent.innerHTML = 'Loading...';
    window.openModal('audit');

    try {
        const res = await fetch(window.API + `/api/initiatives/${initiativeId}/audit`);
        if (!res.ok) { throw new Error('Failed to fetch audit trail.'); }
        const auditLog = await res.json();
        
        auditContent.innerHTML = '';
        if (auditLog.length === 0) {
            auditContent.innerHTML = '<p>No audit history for this initiative.</p>';
        } else {
            const sortedAuditLog = [...auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            sortedAuditLog.forEach(entry => {
                const logItem = document.createElement('div');
                logItem.className = 'audit-item';
                let details = '';
                if (entry.type === 'audit') {
                    logItem.classList.add('audit');
                    const oldData = entry.old_data || {};
                    const newData = entry.new_data || {};
                    if (entry.action === 'created') {
                        details = `Created with estimated hours: ${newData.computed_hours} and size: ${newData.shirt_size}.`;
                    } else if (entry.action === 'updated') {
                        const diffs = getAuditDiffs(oldData, newData);
                        details = diffs.length > 0 ? diffs.join('<br>') : 'No changes to tracked fields.';
                    } else if (entry.action === 'duplicated_from') {
                        details = `Duplicated from: ${entry.original_name}.`;
                    }
                    logItem.innerHTML = `<h4>${entry.action.charAt(0).toUpperCase() + entry.action.slice(1).replace(/_/g, ' ')} on ${formatDateInEST(entry.timestamp)}</h4><p>${details}</p>`;
                } else {
                    logItem.innerHTML = `<h4>Comment on ${formatDateInEST(entry.timestamp)}</h4><p>${entry.text}</p>`;
                }
                auditContent.appendChild(logItem);
            });
        }
    } catch (err) {
        auditContent.innerHTML = `<p style="color:var(--red);">Error fetching audit trail: ${err.message || err}</p>`;
    }
}

/**
 * Renders the journal log for the currently open initiative.
 */
export function renderJournalLog() {
    const journalLogDiv = document.getElementById('initiative-journal-log');
    journalLogDiv.innerHTML = '';
    if (window.currentInitiativeJournal && window.currentInitiativeJournal.length > 0) {
        const sortedJournal = [...window.currentInitiativeJournal].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        sortedJournal.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'journal-entry';
            const formattedDate = formatDateInEST(entry.timestamp);

            if (entry.type === 'audit') {
                entryDiv.classList.add('audit');
                let details = '';
                const oldData = entry.old_data || {};
                const newData = entry.new_data || {};

                if (entry.action === 'created') {
                    details = `Created with estimated hours: ${newData.computed_hours} and size: ${newData.shirt_size}.`;
                } else if (entry.action === 'updated') {
                    const diffs = getAuditDiffs(oldData, newData);
                    details = diffs.length > 0 ? diffs.join('<br>') : 'No changes to tracked fields.';
                } else if (entry.action === 'duplicated_from') {
                    details = `Duplicated from: ${entry.original_name}.`;
                }
                entryDiv.innerHTML = `<span class="timestamp">${formattedDate}</span><h4>${entry.action.charAt(0).toUpperCase() + entry.action.slice(1).replace(/_/g, ' ')}</h4><p>${details}</p>`;
            } else {
                entryDiv.innerHTML = `<span class="timestamp">${formattedDate}</span>${entry.text}`;
            }
            journalLogDiv.appendChild(entryDiv);
        });
        setTimeout(() => { journalLogDiv.scrollTop = journalLogDiv.scrollHeight; }, 50);
    } else {
        journalLogDiv.innerHTML = '<p style="text-align: center; color: #888;">No journal entries yet.</p>';
    }
}

/**
 * Adds a comment to the current initiative's journal.
 */
export function addJournalComment() {
    const commentInput = document.getElementById('journal-comment-input');
    const commentText = commentInput.value.trim();
    const initiativeId = document.getElementById('init-id').value;

    if (!commentText) return;
    if (!initiativeId) {
        window.showMessage('Error', "Please save the initiative first before adding journal comments.", 'error');
        return;
    }

    const newEntry = {
        timestamp: new Date().toISOString(),
        type: 'comment',
        text: commentText
    };
    window.currentInitiativeJournal.push(newEntry);
    renderJournalLog();
    commentInput.value = '';
    saveJournalEntryToBackend(initiativeId, window.currentInitiativeJournal);
}

/**
 * Triggers the file input dialog for importing initiatives.
 */
export function importInitiatives() {
    document.getElementById('importFileInput').click();
}

/**
 * Handles the selected file for import, reads it, and sends it to the backend.
 * @param {Event} event - The file input change event.
 */
export async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const tsvContent = e.target.result;
            const lines = tsvContent.split('\n').filter(line => line.trim() !== '');
            if (lines.length === 0) {
                window.showMessage('Error', 'The imported file is empty.', 'error');
                return;
            }

            const headerMap = {
                "User-Defined ID": "custom_id", "Name": "name", "Description": "description",
                "Priority": "priority", "Priority Number": "priority_num", "Status": "status",
                "Start Date": "start_date", "End Date": "end_date", "In Scope": "scope",
                "Out of Scope": "out_of_scope"
            };
            const fileHeaders = lines[0].split('\t').map(h => h.trim());
            const initiativesToImport = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split('\t');
                const initiative = {};
                for (let j = 0; j < fileHeaders.length; j++) {
                    const key = headerMap[fileHeaders[j]];
                    if (key && values[j] !== undefined) {
                        initiative[key] = values[j].trim();
                    }
                }
                initiativesToImport.push(initiative);
            }

            const res = await fetch(window.API + '/api/initiatives/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initiativesToImport)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || `Server responded with status ${res.status}`);
            }

            const result = await res.json();
            window.showMessage('Success', `${result.importedCount} initiatives imported successfully!`, 'success');
            loadInitiatives();
        } catch (error) {
            console.error('Import failed:', error);
            window.showMessage('Error', 'Failed to import initiatives: ' + error.message, 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

/**
 * Exports all initiatives to a TSV file.
 */
export async function exportInitiatives() {
    try {
        const res = await fetch(window.API + '/api/initiatives');
        if (!res.ok) { throw new Error('Failed to fetch initiatives for export.'); }
        const initiatives = await res.json();

        const headers = [
            "Internal ID", "User-Defined ID", "Name", "Description", "Priority", "Priority Number",
            "Status", "Classification", "Scope", "Out of Scope",
            "Estimated Hours", "Estimated Days", "Estimated Months", "Shirt Size",
            "Start Date", "End Date",
            "Selected Factors", "Created At", "Updated At"
        ];
        
        const rows = [headers.join('\t')];

        for (const initiative of initiatives) {
            const estimatedHours = initiative.computed_hours || 0;
            const estimatedDays = (estimatedHours / 8).toFixed(1);
            const estimatedMonths = (estimatedHours / 160).toFixed(1);

            let selectedFactorsSummary = initiative.selected_factors.map(f => {
                const totalFactorHours = Object.values(f.hoursPerResourceType || {}).reduce((sum, h) => sum + h, 0);
                return `${f.name} (Qty: ${f.quantity}, Hours: ${totalFactorHours * f.quantity})`;
            }).join(', ');

            const rowData = [
                initiative.id, initiative.custom_id, initiative.name, initiative.description,
                initiative.priority, initiative.priority_num, initiative.status, initiative.classification,
                initiative.scope, initiative.out_of_scope, estimatedHours, estimatedDays,
                estimatedMonths, initiative.shirt_size,
                formatDateInEST(initiative.start_date, false),
                formatDateInEST(initiative.end_date, false),
                selectedFactorsSummary,
                formatDateInEST(initiative.created_at, true),
                formatDateInEST(initiative.updated_at, true)
            ];
            rows.push(rowData.map(item => String(item || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
        }

        const tsvContent = rows.join('\n');
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const filename = `initiatives_export_${now.toISOString().slice(0,10)}.tsv`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.showMessage('Success', 'Initiatives exported successfully!', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        window.showMessage('Error', 'Failed to export initiatives: ' + error.message, 'error');
    }
}

/**
 * Exports a resource-centric view of all initiatives to a TSV file.
 */
export async function exportResourceView() {
    try {
        await window.loadRT();
        await window.loadEF();
        await loadInitiatives();

        const { initList, rtList, efList } = window;

        const headers = [
            "Internal ID", "User-Defined ID", "Name", "Created", "Updated", "Status", "Shirt Size",
            "Start Date", "End Date", "Resource Type", "Factor", "Factor Hours"
        ];
        const rows = [headers.join('\t')];

        for (const initiative of initList) {
            const baseRowData = [
                initiative.id, initiative.custom_id, initiative.name,
                formatDateInEST(initiative.created_at, true),
                formatDateInEST(initiative.updated_at, true),
                initiative.status, initiative.shirt_size,
                formatDateInEST(initiative.start_date, false),
                formatDateInEST(initiative.end_date, false)
            ];

            let hasFactors = false;
            if (initiative.selected_factors) {
                for (const selectedFactor of initiative.selected_factors) {
                    const factorDetails = efList.find(f => f.id === selectedFactor.factorId);
                    if (factorDetails && factorDetails.hoursPerResourceType) {
                        hasFactors = true;
                        for (const rtId in factorDetails.hoursPerResourceType) {
                            const resourceType = rtList.find(rt => rt.id === rtId);
                            if (resourceType) {
                                const factorHours = factorDetails.hoursPerResourceType[rtId] * selectedFactor.quantity;
                                rows.push([
                                    ...baseRowData,
                                    resourceType.name,
                                    factorDetails.name,
                                    factorHours.toFixed(1)
                                ].map(item => String(item || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
                            }
                        }
                    }
                }
            }

            if (!hasFactors) {
                rows.push([...baseRowData, '', '', ''].map(item => String(item || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
            }
        }

        const tsvContent = rows.join('\n');
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const filename = `initiatives_resource_view_export_${now.toISOString().slice(0,10)}.tsv`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.showMessage('Success', 'Resource view exported successfully!', 'success');
    } catch (error) {
        console.error('Export resource view failed:', error);
        window.showMessage('Error', 'Failed to export resource view: ' + error.message, 'error');
    }
}


// --- Helper Functions ---

async function saveJournalEntryToBackend(initiativeId, journalEntries) {
    try {
        const res = await fetch(window.API + `/api/initiatives/${initiativeId}`);
        if (!res.ok) { throw new Error('Failed to fetch initiative for journal update.'); }
        const currentInitiative = await res.json();
        currentInitiative.journal_entries = journalEntries;
        currentInitiative.updated_at = new Date().toISOString();

        await fetch(window.API + `/api/initiatives/${initiativeId}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(currentInitiative)
        });
        loadInitiatives(window.currentSortColumn, window.currentSortDirection);
    } catch (error) {
        console.error('Error in saveJournalEntryToBackend:', error);
    }
}

function getAuditDiffs(oldData, newData) {
    const diffs = [];
    const keysToCompare = [
        'name', 'custom_id', 'description', 'priority', 'priority_num',
        'status', 'estimation_type', 'classification', 'scope', 'out_of_scope',
        'computed_hours', 'shirt_size', 'start_date', 'end_date'
    ];

    for (const key of keysToCompare) {
        const oldValue = oldData[key];
        const newValue = newData[key];
        if (key === 'start_date' || key === 'end_date') {
            const oldDate = (oldValue || '').substring(0, 10);
            const newDate = (newValue || '').substring(0, 10);
            if (oldDate !== newDate) {
                diffs.push(`- Changed ${key} from <span class="diff-removed">${oldDate || 'none'}</span> to <span class="diff-added">${newDate || 'none'}</span>`);
            }
        } else if (String(oldValue || '') !== String(newValue || '')) {
            diffs.push(`- Changed ${key} from <span class="diff-removed">${oldValue || 'empty'}</span> to <span class="diff-added">${newValue || 'empty'}</span>`);
        }
    }
    
    const oldFactors = JSON.parse(oldData.selected_factors || '[]');
    const newFactors = JSON.parse(newData.selected_factors || '[]');
    const oldFactorsStr = JSON.stringify([...oldFactors].sort((a, b) => (a?.factorId || '').localeCompare(b?.factorId || '')));
    const newFactorsStr = JSON.stringify([...newFactors].sort((a, b) => (a?.factorId || '').localeCompare(b?.factorId || '')));

    if (oldFactorsStr !== newFactorsStr) {
        newFactors.forEach(newFactor => {
            const oldFactor = oldFactors.find(of => of.factorId === newFactor.factorId);
            if (!oldFactor) {
                diffs.push(`- <span class="diff-added">Added factor: ${newFactor.name} (Qty: ${newFactor.quantity})</span>`);
            } else if (oldFactor.quantity !== newFactor.quantity) {
                diffs.push(`- Changed quantity for factor ${newFactor.name} from <span class="diff-removed">${oldFactor.quantity}</span> to <span class="diff-added">${newFactor.quantity}</span>.`);
            }
        });
        oldFactors.forEach(oldFactor => {
            if (!newFactors.find(nf => nf.factorId === oldFactor.factorId)) {
                diffs.push(`- <span class="diff-removed">Removed factor: ${oldFactor.name} (Qty: ${oldFactor.quantity})</span>`);
            } 
        });
    }
    return diffs;
}


function setupInitiativeTableSorting() {
    document.querySelectorAll('#init-table th.sortable-th').forEach(header => {
        header.removeEventListener('click', handleSortClick);
        header.addEventListener('click', handleSortClick);
    });
}

function handleSortClick(event) {
    const sortBy = event.currentTarget.dataset.sort;
    if (sortBy) {
        if (window.currentSortColumn === sortBy) {
            window.currentSortDirection = window.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            window.currentSortColumn = sortBy;
            window.currentSortDirection = 'asc';
        }
        loadInitiatives(window.currentSortColumn, window.currentSortDirection);
    }
}

function updateSortIndicators(sortBy, sortDirection) {
    document.querySelectorAll('#init-table th.sortable-th').forEach(th => {
        const arrowSpan = th.querySelector('.sort-arrow');
        if (arrowSpan) {
            arrowSpan.textContent = (th.dataset.sort === sortBy) ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
        }
    });
}