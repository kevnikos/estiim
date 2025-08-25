/**
 * initiatives.js
 * Handles all CRUD operations, event handling, and UI rendering for the Initiatives section.
 */
import { formatDateInEST } from './ui.js';

/**
 * Calculate the total cost for an initiative considering both pre-built factors and manual resources
 * @param {Object} initiative - The initiative object
 * @returns {number} - The total cost
 */
function calculateInitiativeTotalCost(initiative) {
  let totalCost = 0;
  
  // Calculate costs from pre-built factors
  if (initiative.selected_factors) {
    let selectedFactors;
    try {
      selectedFactors = typeof initiative.selected_factors === 'string' 
        ? JSON.parse(initiative.selected_factors) 
        : initiative.selected_factors;
    } catch (e) {
      selectedFactors = [];
    }
    
    selectedFactors.forEach(factorId => {
      const factor = window.efList?.find(ef => ef.id === factorId);
      if (factor) {
        // Calculate labour costs from factors
        const hrs = factor.hoursPerResourceType || {};
        Object.entries(hrs).forEach(([resourceId, hours]) => {
          if (hours > 0) {
            const resourceType = window.rtList?.find(rt => rt.id === resourceId);
            const resourceCost = resourceType?.resource_cost || 0;
            totalCost += hours * resourceCost;
          }
        });
        
        // Calculate non-labour costs from factors
        const vals = factor.valuePerResourceType || {};
        Object.entries(vals).forEach(([resourceId, units]) => {
          if (units > 0) {
            const resourceType = window.rtList?.find(rt => rt.id === resourceId);
            const resourceCost = resourceType?.resource_cost || 0;
            totalCost += units * resourceCost;
          }
        });
      }
    });
  }
  
  // Calculate costs from manual resources
  if (initiative.manual_resources) {
    let manualData;
    try {
      manualData = typeof initiative.manual_resources === 'string' 
        ? JSON.parse(initiative.manual_resources) 
        : initiative.manual_resources;
    } catch (e) {
      manualData = {};
    }
    
    // Manual labour hours
    if (manualData.manualHours) {
      Object.entries(manualData.manualHours).forEach(([resourceId, hours]) => {
        if (hours > 0) {
          const resourceType = window.rtList?.find(rt => rt.id === resourceId);
          const resourceCost = resourceType?.resource_cost || 0;
          totalCost += hours * resourceCost;
        }
      });
    }
    
    // Manual non-labour values
    if (manualData.manualValues) {
      Object.entries(manualData.manualValues).forEach(([resourceId, units]) => {
        if (units > 0) {
          const resourceType = window.rtList?.find(rt => rt.id === resourceId);
          const resourceCost = resourceType?.resource_cost || 0;
          totalCost += units * resourceCost;
        }
      });
    }
  }
  
  return totalCost;
}

// Cookie utility functions
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
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
    const searchInput = document.getElementById('init-search-input');
    let statusFilter = '';
    let searchText = '';
    
    if (statusFilterElem) {
        statusFilter = statusFilterElem.value || '';
    }
    if (searchInput) {
        searchText = searchInput.value.toLowerCase().trim();
    }

  let url = window.API + '/api/initiatives';
  if (statusFilter) {
    url += `?status=${encodeURIComponent(statusFilter)}`;
  }
  const res = await fetch(url);
  let allInitiatives = await res.json();
  window.initList = allInitiatives; // Still store all initiatives for other uses like edit
  console.log('Loaded initiatives:', allInitiatives);

    // Apply search filter if there's search text
  if (searchText) {
    allInitiatives = allInitiatives.filter(initiative => {
      // Parse categories if they are stored as a string
      let categories = [];
      try {
        categories = typeof initiative.categories === 'string' 
          ? JSON.parse(initiative.categories || '[]') 
          : (Array.isArray(initiative.categories) ? initiative.categories : []);
      } catch (e) {
        console.error('Error parsing categories during search:', e);
        categories = [];
      }
      
      return (
        (initiative.name || '').toLowerCase().includes(searchText) ||
        (initiative.custom_id || '').toLowerCase().includes(searchText) ||
        (initiative.description || '').toLowerCase().includes(searchText) ||
        (initiative.status || '').toLowerCase().includes(searchText) ||
        (initiative.estimation_type || '').toLowerCase().includes(searchText) ||
        (initiative.priority || '').toLowerCase().includes(searchText) ||
        String(initiative.priority_num || '').includes(searchText) ||
        String(initiative.computed_hours || '').includes(searchText) ||
        String(initiative.estimated_duration || '').includes(searchText) ||
        categories.some(cat => cat.toLowerCase().includes(searchText))
      );
    });
  }  // Sort the filtered initiatives
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
  if (!tbody) {
    console.error('Could not find table body element');
    return;
  }
  tbody.innerHTML = '';
  const itemsToDisplay = allInitiatives; // Directly use all initiatives from the backend
  console.log('Initiatives to display:', itemsToDisplay);

  // Update the count display
  const countElement = document.getElementById('init-count');
  if (countElement) {
    countElement.textContent = `${itemsToDisplay.length} initiative${itemsToDisplay.length !== 1 ? 's' : ''} shown`;
  }

  itemsToDisplay.forEach(i => {
    console.log('Creating row for initiative:', i);
    const tr = document.createElement('tr');
    try {
      const totalCost = calculateInitiativeTotalCost(i);
      const formattedTotalCost = totalCost > 0 ? `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
      
      tr.innerHTML = `
        <td>${i.id || ''}</td>
        <td>${i.custom_id || ''}</td>
        <td>${i.name}</td>
        <td>${i.priority}</td>
        <td>${i.estimation_type}</td>
        <td>${i.status || ''}</td>
        <td>${i.shirt_size || ''}</td>
        <td>${i.computed_hours || 0}</td>
        <td>${formattedTotalCost}</td>
        <td>${i.estimated_duration || ''}</td>
        <td>${(typeof i.categories === 'string' ? JSON.parse(i.categories || '[]') : (i.categories || [])).map(cat => `<span class="category-tag">${cat}</span>`).join('')}</td>
        <td>${formatDateInEST(i.created_at, true)}</td>
        <td>${formatDateInEST(i.updated_at, true)}</td>
        <td style="white-space:nowrap;">
          <button onclick="window.editInitiative(${i.id})">Edit</button>
          <button onclick="window.deleteInitiative(${i.id})" style="background:var(--red)">Del</button>
          <button onclick="window.showAuditTrail('${i.id}', '${i.name}')">🔍</button>
        </td>
      `;
      tbody.appendChild(tr);
      console.log('Row created successfully');
    } catch(err) {
      console.error('Error creating row:', err);
    }
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
    document.getElementById('init-estimated-duration').value = '';
    document.getElementById('init-scope').value = '';
    document.getElementById('init-out').value = '';
    document.getElementById('init-created').textContent = '';
    document.getElementById('init-updated').textContent = '';
    document.getElementById('init-calculated-shirt-size').textContent = '';
    window.selectedFactors = [];
    window.manualResources = { manualHours: {}, manualValues: {} };
    window.selectedCategories = [];
    window.currentInitiativeJournal = [];
    window.initCategoriesUI();
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
    document.getElementById('init-estimated-duration').value = init.estimated_duration !== null ? init.estimated_duration : '';
    document.getElementById('init-scope').value = init.scope || '';
    document.getElementById('init-out').value = init.out_of_scope || '';
    document.getElementById('init-created').textContent = formatDateInEST(init.created_at);
    document.getElementById('init-updated').textContent = formatDateInEST(init.updated_at);
    document.getElementById('init-calculated-shirt-size').textContent = `Calculated T-Shirt Size: ${init.shirt_size || 'N/A'} (${init.computed_hours || 0}h)`;
    
    window.selectedFactors = init.selected_factors || []; 
    window.manualResources = init.manual_resources || { manualHours: {}, manualValues: {} };
    window.currentInitiativeJournal = init.journal_entries || []; 
    window.renderSelectedFactorsSummary();
    renderJournalLog();
    document.getElementById('journal-comment-input').value = '';

    // Initialize categories
    if (typeof init.categories === 'string') {
        try {
            window.selectedCategories = JSON.parse(init.categories || '[]');
        } catch (e) {
            console.error('Error parsing categories:', e);
            window.selectedCategories = [];
        }
    } else {
        window.selectedCategories = Array.isArray(init.categories) ? init.categories : [];
    }
    window.initCategoriesUI();

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
    
    // Get the categories ready for the payload
    let categories = Array.isArray(window.selectedCategories) ? window.selectedCategories : 
                    (typeof window.selectedCategories === 'string' ? 
                    JSON.parse(window.selectedCategories || '[]') : []);
    
    console.log('Selected categories before save:', categories);
    
    // Increment usage count for each category
    try {
        // First load all categories to get their IDs
        const categoriesRes = await fetch(window.API + '/api/categories');
        const allCategories = await categoriesRes.json();
        
        // For each selected category, find its ID and increment usage
        for (const categoryName of categories) {
            const category = allCategories.find(c => c.name === categoryName);
            if (category) {
                try {
                    await fetch(window.API + `/api/categories/${category.id}/increment`, {
                        method: 'POST'
                    });
                } catch (error) {
                    console.error(`Failed to increment usage for category ${categoryName}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error incrementing category usage counts:', error);
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
        manual_resources: window.manualResources || { manualHours: {}, manualValues: {} },
        start_date: document.getElementById('init-start-date').value.trim() || null,
        end_date: document.getElementById('init-end-date').value.trim() || null,
        estimated_duration: parseInt(document.getElementById('init-estimated-duration').value, 10) || null,
        journal_entries: window.currentInitiativeJournal,
        categories: categories
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
        estimated_duration: parseInt(document.getElementById('init-estimated-duration').value, 10) || null,
        journal_entries: [newJournalEntry],
        categories: window.selectedCategories || []
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
            "Selected Factors", "Manual Resources", "Created At", "Updated At"
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

            // Add manual resources summary
            let manualResourcesSummary = '';
            if (initiative.manual_resources) {
                let manualData;
                try {
                    // Handle both string and object cases
                    if (typeof initiative.manual_resources === 'string') {
                        manualData = JSON.parse(initiative.manual_resources);
                    } else {
                        manualData = initiative.manual_resources;
                    }
                } catch (e) {
                    console.warn('Invalid manual_resources JSON for initiative', initiative.id, ':', initiative.manual_resources);
                    manualData = {}; // Use empty object as fallback
                }
                const manualSummaryParts = [];
                
                // Add manual hours (Labour resources)
                if (manualData.manualHours) {
                    Object.entries(manualData.manualHours).forEach(([rtId, hours]) => {
                        const rt = window.rtList?.find(r => r.id === rtId);
                        if (rt && hours > 0) {
                            manualSummaryParts.push(`${rt.name}: ${hours}h`);
                        }
                    });
                }
                
                // Add manual values (Non-Labour resources)
                if (manualData.manualValues) {
                    Object.entries(manualData.manualValues).forEach(([rtId, value]) => {
                        const rt = window.rtList?.find(r => r.id === rtId);
                        if (rt && value > 0) {
                            manualSummaryParts.push(`${rt.name}: ${value} units`);
                        }
                    });
                }
                
                manualResourcesSummary = manualSummaryParts.join(', ');
            }

            const rowData = [
                initiative.id, initiative.custom_id, initiative.name, initiative.description,
                initiative.priority, initiative.priority_num, initiative.status, initiative.classification,
                initiative.scope, initiative.out_of_scope, estimatedHours, estimatedDays,
                estimatedMonths, initiative.shirt_size,
                formatDateInEST(initiative.start_date, false),
                formatDateInEST(initiative.end_date, false),
                selectedFactorsSummary, manualResourcesSummary,
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
            "Start Date", "End Date", "Resource Type", "Resource Category", "Resource Cost", 
            "Factor", "Factor Hours", "Factor Values", "Manual Hours", "Manual Values", "Source"
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

            const resourceEntries = [];
            
            // Process selected factors (both labour and non-labour)
            if (initiative.selected_factors && initiative.selected_factors.length > 0) {
                for (const selectedFactor of initiative.selected_factors) {
                    const factorDetails = efList.find(f => f.id === selectedFactor.factorId);
                    if (factorDetails) {
                        // Process labour resources (hoursPerResourceType)
                        if (factorDetails.hoursPerResourceType) {
                            for (const [rtId, hours] of Object.entries(factorDetails.hoursPerResourceType)) {
                                if (hours > 0) {
                                    const resourceType = rtList.find(rt => rt.id === rtId);
                                    if (resourceType) {
                                        const factorHours = hours * selectedFactor.quantity;
                                        resourceEntries.push({
                                            resourceType: resourceType.name,
                                            resourceCategory: resourceType.resource_category || 'Labour',
                                            resourceCost: resourceType.resource_cost || '',
                                            factor: factorDetails.name,
                                            factorHours: factorHours.toFixed(1),
                                            factorValues: '',
                                            manualHours: '',
                                            manualValues: '',
                                            source: 'Factor (Labour)'
                                        });
                                    }
                                }
                            }
                        }
                        
                        // Process non-labour resources (valuePerResourceType)
                        if (factorDetails.valuePerResourceType) {
                            for (const [rtId, value] of Object.entries(factorDetails.valuePerResourceType)) {
                                if (value > 0) {
                                    const resourceType = rtList.find(rt => rt.id === rtId);
                                    if (resourceType) {
                                        const factorValue = value * selectedFactor.quantity;
                                        resourceEntries.push({
                                            resourceType: resourceType.name,
                                            resourceCategory: resourceType.resource_category || 'Non-Labour',
                                            resourceCost: resourceType.resource_cost || '',
                                            factor: factorDetails.name,
                                            factorHours: '',
                                            factorValues: factorValue.toFixed(2),
                                            manualHours: '',
                                            manualValues: '',
                                            source: 'Factor (Non-Labour)'
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Process manual resources
            if (initiative.manual_resources) {
                let manualData;
                try {
                    console.log('Processing manual_resources for initiative', initiative.id, ':', initiative.manual_resources, 'Type:', typeof initiative.manual_resources);
                    // Handle both string and object cases
                    if (typeof initiative.manual_resources === 'string') {
                        manualData = JSON.parse(initiative.manual_resources);
                    } else {
                        manualData = initiative.manual_resources;
                    }
                } catch (e) {
                    console.error('Invalid manual_resources JSON for initiative', initiative.id, ':', initiative.manual_resources, 'Error:', e.message);
                    continue; // Skip this initiative if manual resources data is invalid
                }
                
                // Process manual labour hours
                if (manualData.manualHours) {
                    for (const [rtId, hours] of Object.entries(manualData.manualHours)) {
                        if (hours > 0) {
                            const resourceType = rtList.find(rt => rt.id === rtId);
                            if (resourceType) {
                                resourceEntries.push({
                                    resourceType: resourceType.name,
                                    resourceCategory: resourceType.resource_category || 'Labour',
                                    resourceCost: resourceType.resource_cost || '',
                                    factor: '',
                                    factorHours: '',
                                    factorValues: '',
                                    manualHours: hours.toFixed(1),
                                    manualValues: '',
                                    source: 'Manual (Labour)'
                                });
                            }
                        }
                    }
                }
                
                // Process manual non-labour values
                if (manualData.manualValues) {
                    for (const [rtId, value] of Object.entries(manualData.manualValues)) {
                        if (value > 0) {
                            const resourceType = rtList.find(rt => rt.id === rtId);
                            if (resourceType) {
                                resourceEntries.push({
                                    resourceType: resourceType.name,
                                    resourceCategory: resourceType.resource_category || 'Non-Labour',
                                    resourceCost: resourceType.resource_cost || '',
                                    factor: '',
                                    factorHours: '',
                                    factorValues: '',
                                    manualHours: '',
                                    manualValues: value.toFixed(2),
                                    source: 'Manual (Non-Labour)'
                                });
                            }
                        }
                    }
                }
            }

            // Add rows for each resource entry, or one empty row if no resources
            if (resourceEntries.length > 0) {
                for (const entry of resourceEntries) {
                    rows.push([
                        ...baseRowData,
                        entry.resourceType,
                        entry.resourceCategory,
                        entry.resourceCost,
                        entry.factor,
                        entry.factorHours,
                        entry.factorValues,
                        entry.manualHours,
                        entry.manualValues,
                        entry.source
                    ].map(item => String(item || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
                }
            } else {
                // No resources - add empty row
                rows.push([...baseRowData, '', '', '', '', '', '', '', '', '']
                    .map(item => String(item || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
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
    console.log('Comparing audit data:', { oldData, newData });
    const diffs = [];
    const keysToCompare = [
        'name', 'custom_id', 'description', 'priority', 'priority_num',
        'status', 'estimation_type', 'classification', 'scope', 'out_of_scope',
        'computed_hours', 'shirt_size', 'start_date', 'end_date', 'estimated_duration',
        'categories'
    ];

    for (const key of keysToCompare) {
        const oldValue = oldData[key];
        const newValue = newData[key];
        if (key === 'start_date' || key === 'end_date') {
            const oldDate = (oldValue || '').substring(0, 10);
            const newDate = (newValue || '').substring(0, 10);
            if (oldDate !== newDate) {
                diffs.push(`- Changed ${key.replace(/_/g, ' ')} from <span class="diff-removed">${oldDate || 'none'}</span> to <span class="diff-added">${newDate || 'none'}</span>`);
            }
        } else if (key === 'estimated_duration' || key === 'priority_num' || key === 'computed_hours') {
            const oldNum = oldValue !== null ? oldValue : '';
            const newNum = newValue !== null ? newValue : '';
            if (oldNum !== newNum) {
                diffs.push(`- Changed ${key.replace(/_/g, ' ')} from <span class="diff-removed">${oldNum || 'none'}</span> to <span class="diff-added">${newNum || 'none'}</span>`);
            }
        } else if (key === 'categories') {
            console.log('Comparing categories:', { oldValue, newValue });
            let oldCats = [];
            let newCats = [];
            try {
                oldCats = typeof oldValue === 'string' ? JSON.parse(oldValue || '[]') : (oldValue || []);
                newCats = typeof newValue === 'string' ? JSON.parse(newValue || '[]') : (newValue || []);
                console.log('Parsed categories:', { oldCats, newCats });
            } catch (e) {
                console.error('Error parsing categories for diff:', e);
            }
            const added = newCats.filter(cat => !oldCats.includes(cat));
            const removed = oldCats.filter(cat => !newCats.includes(cat));
            if (added.length > 0) {
                diffs.push(`- Added categories: <span class="diff-added">${added.join(', ')}</span>`);
            }
            if (removed.length > 0) {
                diffs.push(`- Removed categories: <span class="diff-removed">${removed.join(', ')}</span>`);
            }
        } else if (String(oldValue || '') !== String(newValue || '')) {
            diffs.push(`- Changed ${key.replace(/_/g, ' ')} from <span class="diff-removed">${oldValue || 'empty'}</span> to <span class="diff-added">${newValue || 'empty'}</span>`);
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
    
    // Compare manual resources
    try {
        const oldManualResources = JSON.parse(oldData.manual_resources || '{}');
        const newManualResources = JSON.parse(newData.manual_resources || '{}');
        const oldManualStr = JSON.stringify(oldManualResources);
        const newManualStr = JSON.stringify(newManualResources);
        
        if (oldManualStr !== newManualStr) {
            const oldHours = oldManualResources.manualHours || {};
            const newHours = newManualResources.manualHours || {};
            const oldValues = oldManualResources.manualValues || {};
            const newValues = newManualResources.manualValues || {};
            
            // Check for changes in manual hours (labour resources)
            const allLabourResourceIds = new Set([...Object.keys(oldHours), ...Object.keys(newHours)]);
            allLabourResourceIds.forEach(resourceId => {
                const oldVal = oldHours[resourceId] || 0;
                const newVal = newHours[resourceId] || 0;
                const resourceName = window.rtList?.find(r => r.id === resourceId)?.name || resourceId;
                
                if (oldVal === 0 && newVal > 0) {
                    diffs.push(`- <span class="diff-added">Added manual resource ${resourceName}: ${newVal}h</span>`);
                } else if (oldVal > 0 && newVal === 0) {
                    diffs.push(`- <span class="diff-removed">Removed manual resource ${resourceName} (was ${oldVal}h)</span>`);
                } else if (oldVal !== newVal) {
                    diffs.push(`- Changed manual hours for ${resourceName} from <span class="diff-removed">${oldVal}h</span> to <span class="diff-added">${newVal}h</span>`);
                }
            });
            
            // Check for changes in manual values (non-labour resources)
            const allNonLabourResourceIds = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
            allNonLabourResourceIds.forEach(resourceId => {
                const oldVal = oldValues[resourceId] || 0;
                const newVal = newValues[resourceId] || 0;
                const resourceName = window.rtList?.find(r => r.id === resourceId)?.name || resourceId;
                
                if (oldVal === 0 && newVal > 0) {
                    diffs.push(`- <span class="diff-added">Added manual non-labour resource ${resourceName}: ${newVal}</span>`);
                } else if (oldVal > 0 && newVal === 0) {
                    diffs.push(`- <span class="diff-removed">Removed manual non-labour resource ${resourceName} (was ${oldVal})</span>`);
                } else if (oldVal !== newVal) {
                    diffs.push(`- Changed manual value for ${resourceName} from <span class="diff-removed">${oldVal}</span> to <span class="diff-added">${newVal}</span>`);
                }
            });
        }
    } catch (e) {
        console.error('Error comparing manual resources for audit:', e);
    }
    
    return diffs;
}

/**
 * Exports all resource types to a TSV file.
 */
export async function exportResourceTypes() {
    try {
        await window.loadRT();
        const { rtList } = window;

        const headers = [
            "ID", "Name", "Description", "Resource Category", "Resource Cost", 
            "Created At", "Updated At"
        ];
        
        const rows = [headers.join('\t')];

        for (const rt of rtList) {
            const rowData = [
                rt.id,
                rt.name,
                rt.description || '',
                rt.resource_category || '',
                rt.resource_cost || '',
                formatDateInEST(rt.created_at, true),
                formatDateInEST(rt.updated_at, true)
            ];
            rows.push(rowData.map(item => String(item || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
        }

        const tsvContent = rows.join('\n');
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const filename = `resource_types_export_${now.toISOString().slice(0,10)}.tsv`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.showMessage('Success', 'Resource types exported successfully!', 'success');
    } catch (error) {
        console.error('Export resource types failed:', error);
        window.showMessage('Error', 'Failed to export resource types: ' + error.message, 'error');
    }
}

/**
 * Exports all estimation factors to a TSV file.
 */
export async function exportEstimationFactors() {
    try {
        await window.loadEF();
        await window.loadRT();
        const { efList, rtList } = window;

        const headers = [
            "ID", "Name", "Description", "Total Hours", "Labour Resources", "Non-Labour Resources",
            "Created At", "Updated At"
        ];
        
        const rows = [headers.join('\t')];

        for (const ef of efList) {
            const totalHours = Object.values(ef.hoursPerResourceType || {}).reduce((sum, h) => sum + h, 0);
            
            // Build labour resources summary
            const labourSummary = Object.entries(ef.hoursPerResourceType || {})
                .filter(([, hours]) => hours > 0)
                .map(([rtId, hours]) => {
                    const rt = rtList.find(r => r.id === rtId);
                    return rt ? `${rt.name}: ${hours}h` : `${rtId}: ${hours}h`;
                }).join(', ');
            
            // Build non-labour resources summary
            const nonLabourSummary = Object.entries(ef.valuePerResourceType || {})
                .filter(([, value]) => value > 0)
                .map(([rtId, value]) => {
                    const rt = rtList.find(r => r.id === rtId);
                    return rt ? `${rt.name}: ${value}` : `${rtId}: ${value}`;
                }).join(', ');

            const rowData = [
                ef.id,
                ef.name,
                ef.description || '',
                totalHours,
                labourSummary,
                nonLabourSummary,
                formatDateInEST(ef.created_at, true),
                formatDateInEST(ef.updated_at, true)
            ];
            rows.push(rowData.map(item => String(item || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
        }

        const tsvContent = rows.join('\n');
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const filename = `estimation_factors_export_${now.toISOString().slice(0,10)}.tsv`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.showMessage('Success', 'Estimation factors exported successfully!', 'success');
    } catch (error) {
        console.error('Export estimation factors failed:', error);
        window.showMessage('Error', 'Failed to export estimation factors: ' + error.message, 'error');
    }
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