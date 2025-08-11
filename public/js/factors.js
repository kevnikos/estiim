/**
 * factors.js
 * Handles all CRUD operations and UI for the main Estimation Factors page.
 */
import { formatDateInEST } from './ui.js';

/**
 * Loads and displays the list of estimation factors.
 */
export async function loadEF() {
  renderEFGrid(); // Renders the grid in the modal, needed for edit
  const res = await fetch(window.API + '/api/estimation-factors');
  window.efList = await res.json();

  const searchQuery = document.getElementById('ef-search-input')?.value.toLowerCase() || '';
  
  const filteredFactors = window.efList.filter(f => {
    const factorName = f.name.toLowerCase();
    const factorDescription = (f.description || '').toLowerCase();
    const resourceNames = Object.entries(f.hoursPerResourceType || {})
      .map(([id]) => (window.rtList.find(x => x.id === id)?.name || '').toLowerCase())
      .join(' ');
    return factorName.includes(searchQuery) || factorDescription.includes(searchQuery) || resourceNames.includes(searchQuery);
  }).sort((a, b) => a.name.localeCompare(b.name));

  const tbody = document.querySelector('#ef-table tbody');
  tbody.innerHTML = '';
  const itemsToDisplay = filteredFactors;

  itemsToDisplay.forEach(f => {
    const hrs = f.hoursPerResourceType || {};
    const names = Object.entries(hrs).filter(([,v]) => v > 0).map(([id]) => window.rtList.find(x => x.id === id)?.name || id).join(',');
    const total = Object.values(hrs).reduce((a, b) => a + b, 0);
    const days = (total / 8).toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.name}</td>
      <td>${names}</td>
      <td>${days}</td>
      <td>${total}</td>
      <td style="white-space:nowrap;">
        <button onclick="window.editEF('${f.id}')">Edit</button>
        <button onclick="window.delEF('${f.id}')" style="background:var(--red)">Del</button>
        <button onclick="window.showAuditTrailEF('${f.id}', '${f.name}')">🔍</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

/**
 * Opens the modal to add a new estimation factor.
 */
export async function addEstimationFactor() {
  await window.loadRT();
  document.getElementById('ef-id').value = '';
  document.getElementById('ef-name').value = '';
  document.getElementById('ef-description').value = '';
  (window.rtList || []).forEach(rt => {
      const inp = document.getElementById(`ef-h-${rt.id}`);
      if (inp) inp.value = '';
      const sel = document.getElementById(`ef-u-${rt.id}`);
      if (sel) sel.value = 'h';
  });
  document.getElementById('ef-created').textContent = '';
  document.getElementById('ef-updated').textContent = '';
  window.currentEstimationFactorJournal = [];
  renderJournalLogEF();
  document.getElementById('ef-journal-comment-input').value = '';
  renderEFGrid();
  window.openModal('ef');
}

/**
 * Opens the modal to edit an estimation factor.
 * @param {string} id - The ID of the factor to edit.
 */
export async function editEF(id) {
  await window.loadRT();
  const f = window.efList.find(x => x.id === id);
  if (!f) {
    window.showMessage('Error', 'Estimation Factor not found.', 'error');
    return;
  }
  document.getElementById('ef-id').value = id;
  document.getElementById('ef-name').value = f.name;
  document.getElementById('ef-description').value = f.description || '';
  renderEFGrid();
  const hrs = f.hoursPerResourceType || {};
  Object.entries(hrs).forEach(([rtId, val]) => {
    const inp = document.getElementById(`ef-h-${rtId}`);
    const sel = document.getElementById(`ef-u-${rtId}`);
    if (inp) {
      if (val % 8 === 0) {
        inp.value = val / 8;
        sel.value = 'd';
      } else {
        inp.value = val;
        sel.value = 'h';
      }
    }
  });
  document.getElementById('ef-created').textContent = formatDateInEST(f.created_at);
  document.getElementById('ef-updated').textContent = formatDateInEST(f.updated_at);
  window.currentEstimationFactorJournal = f.journal_entries || [];
  renderJournalLogEF();
  document.getElementById('ef-journal-comment-input').value = '';
  window.openModal('ef');
}

/**
 * Deletes an estimation factor after confirmation.
 * @param {string} id - The ID of the factor to delete.
 */
export async function delEF(id) {
  if (!confirm('Delete?')) return;
  await fetch(window.API + `/api/estimation-factors/${id}`, { method: 'DELETE' });
  loadEF();
}

/**
 * Saves a new or existing estimation factor.
 */
export async function saveEstimationFactor() {
    const id = document.getElementById('ef-id').value.trim();
    const name = document.getElementById('ef-name').value.trim();
    if (!name) {
        window.showMessage('Error', 'Name required', 'error');
        return;
    }
    const description = document.getElementById('ef-description').value.trim();
    const hours = {};
    (window.rtList || []).forEach(rt => {
        const inp = document.getElementById(`ef-h-${rt.id}`);
        const sel = document.getElementById(`ef-u-${rt.id}`);
        if (!inp) return;
        let val = +inp.value;
        if (val > 0) {
            if (sel.value === 'd') val *= 8;
            hours[rt.id] = val;
        }
    });

    const payload = {
        name,
        description,
        hoursPerResourceType: hours,
        journal_entries: window.currentEstimationFactorJournal
    };

    const url = id ? `/api/estimation-factors/${id}` : '/api/estimation-factors';
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
    window.closeModal('ef');
    loadEF();
}

/**
 * Duplicates the currently viewed estimation factor.
 */
export async function duplicateEstimationFactor() {
    const originalName = document.getElementById('ef-name').value.trim();
    if (!originalName) {
        window.showMessage('Error', 'Name is required to duplicate.', 'error');
        return;
    }

    const newName = originalName + " Copy";
    const description = document.getElementById('ef-description').value.trim();
    const hours = {};
    (window.rtList || []).forEach(rt => {
        const inp = document.getElementById(`ef-h-${rt.id}`);
        const sel = document.getElementById(`ef-u-${rt.id}`);
        if (inp) {
            let val = +inp.value;
            if (val > 0) {
                if (sel.value === 'd') val *= 8;
                hours[rt.id] = val;
            }
        }
    });

    const newJournalEntry = {
        timestamp: new Date().toISOString(),
        type: 'audit',
        action: 'duplicated_from',
        original_name: originalName
    };

    const payload = {
        name: newName,
        description: description,
        hoursPerResourceType: hours,
        journal_entries: [newJournalEntry]
    };

    try {
        const res = await fetch(window.API + '/api/estimation-factors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || `Server responded with status ${res.status}`);
        }
        window.showMessage('Success', `Estimation Factor "${newName}" duplicated successfully!`, 'success');
        window.closeModal('ef');
        loadEF();
    } catch (error) {
        console.error('Duplicate estimation factor failed:', error);
        window.showMessage('Error', 'Failed to duplicate estimation factor: ' + error.message, 'error');
    }
}

/**
 * Renders the resource type inputs in the estimation factor modal.
 */
export function renderEFGrid() {
    const cont = document.getElementById('ef-hours');
    cont.innerHTML = '';
    (window.rtList || []).forEach(rt => {
        const row = document.createElement('div');
        row.className = 'flex';
        row.innerHTML = `<label style="width:120px">${rt.name}</label><input type="number" min="0" id="ef-h-${rt.id}"><select id="ef-u-${rt.id}"><option value="h">h</option><option value="d">d</option></select>`;
        cont.appendChild(row);
    });
}

/**
 * Renders the journal log for the currently open estimation factor.
 */
export function renderJournalLogEF() {
    const journalLogDiv = document.getElementById('ef-journal-log');
    journalLogDiv.innerHTML = '';
    if (window.currentEstimationFactorJournal && window.currentEstimationFactorJournal.length > 0) {
        const sortedJournal = [...window.currentEstimationFactorJournal].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
                    details = `Created factor: ${newData.name || 'N/A'}.`;
                } else if (entry.action === 'updated') {
                    const diffs = getFactorAuditDiffs(oldData, newData);
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
 * Adds a comment to the current estimation factor's journal.
 */
export function addJournalCommentEF() {
    const commentInput = document.getElementById('ef-journal-comment-input');
    const commentText = commentInput.value.trim();
    if (!commentText) return;

    const newEntry = {
        timestamp: new Date().toISOString(),
        type: 'comment',
        text: commentText
    };
    window.currentEstimationFactorJournal.push(newEntry);
    renderJournalLogEF();
    commentInput.value = '';
}

/**
 * Displays the audit trail for a specific estimation factor.
 * @param {string} factorId - The ID of the factor.
 * @param {string} factorName - The name of the factor.
 */
export async function showAuditTrailEF(factorId, factorName) {
    document.getElementById('ef-audit-title').textContent = `Audit Trail: ${factorName}`;
    const auditContent = document.getElementById('ef-audit-content');
    auditContent.innerHTML = 'Loading...';
    window.openModal('ef-audit');

    try {
        const res = await fetch(window.API + `/api/estimation-factors/${factorId}/audit`);
        if (!res.ok) { throw new Error('Failed to fetch estimation factor audit trail.'); }
        const auditLog = await res.json();
        
        auditContent.innerHTML = '';
        if (auditLog.length === 0) {
            auditContent.innerHTML = '<p>No audit history for this estimation factor.</p>';
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
                        details = `Created factor: ${newData.name || 'N/A'}.`;
                    } else if (entry.action === 'updated') {
                        const diffs = getFactorAuditDiffs(oldData, newData);
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

// --- Helper Function ---

/**
 * Compares old and new data for an estimation factor and returns an array of change descriptions.
 * @param {object} oldData - The old factor data.
 * @param {object} newData - The new factor data.
 * @returns {string[]} An array of strings describing the changes.
 */
function getFactorAuditDiffs(oldData, newData) {
    const diffs = [];
    // Compare name
    if (oldData.name !== newData.name) {
        diffs.push(`- Changed name from <span class="diff-removed">${oldData.name || '""'}</span> to <span class="diff-added">${newData.name || '""'}</span>`);
    }
    // Compare description
    if (oldData.description !== newData.description) {
        diffs.push(`- Changed description from <span class="diff-removed">${oldData.description || '""'}</span> to <span class="diff-added">${newData.description || '""'}</span>`);
    }

    // Compare hoursPerResourceType
    const oldHours = oldData.hoursPerResourceType || {};
    const newHours = newData.hoursPerResourceType || {};
    const allResourceIds = new Set([...Object.keys(oldHours), ...Object.keys(newHours)]);
    
    allResourceIds.forEach(resId => {
        const oldVal = oldHours[resId] || 0;
        const newVal = newHours[resId] || 0;
        const resourceName = window.rtList.find(r => r.id === resId)?.name || resId;

        if (oldVal === 0 && newVal > 0) {
            diffs.push(`- <span class="diff-added">Added resource ${resourceName} with ${newVal}h</span>`);
        } else if (oldVal > 0 && newVal === 0) {
            diffs.push(`- <span class="diff-removed">Removed resource ${resourceName} (was ${oldVal}h)</span>`);
        } else if (oldVal !== newVal) {
            diffs.push(`- Changed hours for ${resourceName} from <span class="diff-removed">${oldVal}h</span> to <span class="diff-added">${newVal}h</span>`);
        }
    });
    return diffs;
}
