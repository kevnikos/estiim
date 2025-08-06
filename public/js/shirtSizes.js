/**
 * shirtSizes.js
 * Handles UI and API calls for the Shirt Sizes configuration page.
 */
import { formatDateInEST } from './ui.js';

/**
 * Loads and displays the shirt size configuration table.
 */
export async function loadShirtSizes() {
    const res = await fetch(window.API + '/api/shirt-sizes');
    window.shirtSizes = await res.json();
    const tbody = document.querySelector('#shirt-size-table tbody');
    tbody.innerHTML = '';
    window.shirtSizes.forEach(size => {
        const days = (size.threshold_hours / 8).toFixed(1);
        const months = (size.threshold_hours / 160).toFixed(1);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${size.size}</td><td><input type="number" min="0" value="${size.threshold_hours}" oninput="window.updateCalculatedValues(this)"></td><td id="days-${size.size}">${days}</td><td id="months-${size.size}">${months}</td>`;
        tbody.appendChild(tr);
    });
}

/**
 * Updates the calculated day/month values when an hour input changes.
 * @param {HTMLElement} inputElement - The input element that changed.
 */
export function updateCalculatedValues(inputElement) {
    const hours = +inputElement.value;
    const size = inputElement.closest('tr').cells[0].textContent;
    const days = (hours / 8).toFixed(1);
    const months = (hours / 160).toFixed(1);
    document.getElementById(`days-${size}`).textContent = days;
    document.getElementById(`months-${size}`).textContent = months;
}

/**
 * Saves the updated shirt size thresholds.
 */
export async function saveShirtSizes() {
    const newSizes = [];
    document.querySelectorAll('#shirt-size-table tbody tr').forEach(row => {
        const size = row.cells[0].textContent;
        const input = row.querySelector('input');
        if (input) {
            newSizes.push({ size: size, threshold_hours: +input.value });
        }
    });

    try {
        const res = await fetch(window.API + '/api/shirt-sizes', {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(newSizes)
        });
        if (!res.ok) { throw new Error('Failed to save shirt sizes.'); }
        await loadShirtSizes();
        window.showMessage('Success', 'Shirt sizes saved successfully.', 'success');
    } catch (err) {
        window.showMessage('Error', 'Error saving shirt sizes: ' + err.message, 'error');
    }
}

/**
 * Displays the audit trail for shirt size changes.
 */
export async function showShirtSizeAuditTrail() {
    document.getElementById('shirt-size-audit-title').textContent = `Shirt Size Audit Trail`;
    const auditContent = document.getElementById('shirt-size-audit-content');
    auditContent.innerHTML = 'Loading...';
    window.openModal('shirt-size-audit');
    
    try {
        const res = await fetch(window.API + '/api/shirt-sizes/audit');
        if (!res.ok) { throw new Error('Failed to fetch shirt size audit trail'); }
        const auditLog = await res.json();
        
        auditContent.innerHTML = '';
        if (auditLog.length === 0) {
            auditContent.innerHTML = '<p>No audit history for shirt sizes.</p>';
        } else {
            auditLog.forEach(log => {
                const logItem = document.createElement('div');
                logItem.className = 'audit-item';
                let details = '';
                if (log.action === 'updated') {
                    const oldData = JSON.parse(log.old_data);
                    const newData = JSON.parse(log.new_data);
                    const diffs = [];
                    oldData.forEach(oldSize => {
                        const newSize = newData.find(ns => ns.size === oldSize.size);
                        if (newSize && oldSize.threshold_hours !== newSize.threshold_hours) {
                            diffs.push(`- Changed threshold for size ${oldSize.size} from <span class="diff-removed">${oldSize.threshold_hours}</span> to <span class="diff-added">${newSize.threshold_hours}</span>.`);
                        }
                    });
                    details = diffs.length > 0 ? diffs.join('<br>') : 'No changes to visible fields.';
                }
                logItem.innerHTML = `<h4>${log.action} on ${formatDateInEST(log.timestamp)}</h4><p>${details}</p>`;
                auditContent.appendChild(logItem);
            });
        }
    } catch (err) {
        auditContent.innerHTML = `<p style="color:var(--red);">Error fetching audit trail: ${err.message}</p>`;
    }
}
