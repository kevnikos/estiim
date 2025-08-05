/**
 * public/js/ui.js
 * * Contains all functions that manipulate the DOM.
 */
import appState from './state.js';

// --- Helper Functions ---

/**
 * Formats an ISO date string into a more readable format for the EST timezone.
 * @param {string} isoString - The ISO date string to format.
 * @param {boolean} [includeTime=true] - Whether to include the time in the output.
 * @returns {string} The formatted date string.
 */
function formatDateInEST(isoString, includeTime = true) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York' };
    let datePart = date.toLocaleDateString('en-US', dateOptions);

    if (includeTime) {
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York' };
        let timePart = date.toLocaleTimeString('en-US', timeOptions);
        return `${datePart} ${timePart}`;
    }
    return datePart;
}

/**
 * Calculates the T-shirt size for a given number of hours.
 * @param {number} hours - The total estimated hours.
 * @returns {string} The corresponding shirt size.
 */
function getShirtSizeFromHours(hours) {
    let size = 'XS';
    const sortedSizes = [...appState.shirtSizes].sort((a, b) => a.threshold_hours - b.threshold_hours);
    for (const s of sortedSizes) {
        if (hours >= s.threshold_hours) {
            size = s.size;
        } else {
            break;
        }
    }
    return size;
}

// --- Modal Management ---

export function openModal(type) {
    const modal = document.getElementById(`modal-${type}`);
    if (modal) modal.style.display = 'flex';
}

export function closeModal(type) {
    const modal = document.getElementById(`modal-${type}`);
    if (modal) modal.style.display = 'none';
}

export function toggleFlyoutMenu() {
    const flyoutMenu = document.getElementById('flyout-menu');
    flyoutMenu.classList.toggle('active');
}

// --- Message Box ---

export function showMessage(title, message, type = 'info') {
    const modal = document.getElementById('messageBoxModal');
    const titleElement = document.getElementById('messageBoxTitle');
    const contentElement = document.getElementById('messageBoxContent');
    const messageBox = modal.querySelector('.message-box');

    titleElement.textContent = title;
    contentElement.textContent = message;

    messageBox.classList.remove('success', 'error');
    if (type === 'success') messageBox.classList.add('success');
    if (type === 'error') messageBox.classList.add('error');

    modal.style.display = 'flex';
}

export function hideMessage() {
    document.getElementById('messageBoxModal').style.display = 'none';
}


// --- Table Rendering ---

export function renderInitiativesTable() {
    const { initiatives, preferences, initiativesSort } = appState;
    const searchQuery = document.getElementById('init-search-input')?.value.toLowerCase() || '';

    let filtered = initiatives.filter(i =>
        i.name.toLowerCase().includes(searchQuery) ||
        (i.custom_id && i.custom_id.toLowerCase().includes(searchQuery)) ||
        (i.description && i.description.toLowerCase().includes(searchQuery))
    );

    filtered.sort((a, b) => {
        let valA = a[initiativesSort.column];
        let valB = b[initiativesSort.column];
        // Handle different data types for sorting
        if (typeof valA === 'number') {
            valA = valA || 0;
            valB = valB || 0;
        } else if (typeof valA === 'string' && (initiativesSort.column.includes('_at') || initiativesSort.column.includes('_date'))) {
            valA = new Date(valA || 0).getTime();
            valB = new Date(valB || 0).getTime();
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return initiativesSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return initiativesSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const tbody = document.querySelector('#init-table tbody');
    tbody.innerHTML = '';
    const itemsToDisplay = filtered.slice(0, preferences.maxInitiatives);

    itemsToDisplay.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i.id || ''}</td>
            <td>${i.custom_id || ''}</td>
            <td>${i.name}</td>
            <td>${i.status || ''}</td>
            <td>${i.shirt_size || ''}</td>
            <td>${i.computed_hours || 0}</td>
            <td>${formatDateInEST(i.start_date, false)}</td>
            <td>${formatDateInEST(i.end_date, false)}</td>
            <td>${formatDateInEST(i.created_at, true)}</td>
            <td>${formatDateInEST(i.updated_at, true)}</td>
            <td style="white-space:nowrap;">
                <button class="edit-init-btn" data-id="${i.id}">Edit</button>
                <button class="del-init-btn" data-id="${i.id}" style="background:var(--red)">Del</button>
                <button class="audit-init-btn" data-id="${i.id}" data-name="${i.name}">🔍</button>
            </td>`;
        tbody.appendChild(tr);
    });
    updateSortIndicators();
}

function updateSortIndicators() {
    const { column, direction } = appState.initiativesSort;
    document.querySelectorAll('#init-table th.sortable-th').forEach(th => {
        const arrowSpan = th.querySelector('.sort-arrow');
        arrowSpan.textContent = '';
        if (th.dataset.sort === column) {
            arrowSpan.textContent = direction === 'asc' ? ' ▲' : ' ▼';
        }
    });
}

export function renderResourceTypesTable() {
    const { resourceTypes, preferences } = appState;
    const searchQuery = document.getElementById('rt-search-input')?.value.toLowerCase() || '';
    
    let filtered = resourceTypes.filter(r =>
        r.name.toLowerCase().includes(searchQuery) ||
        (r.description && r.description.toLowerCase().includes(searchQuery))
    ).sort((a, b) => a.name.localeCompare(b.name));

    const tbody = document.querySelector('#rt-table tbody');
    tbody.innerHTML = '';
    const itemsToDisplay = filtered.slice(0, preferences.maxResourceTypes);

    itemsToDisplay.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.name}</td>
            <td>${r.description || ''}</td>
            <td>
                <button class="edit-rt-btn" data-id="${r.id}">Edit</button>
                <button class="del-rt-btn" data-id="${r.id}" style="background:var(--red)">Del</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

export function renderEstimationFactorsTable() {
    const { estimationFactors, resourceTypes, preferences } = appState;
    const searchQuery = document.getElementById('ef-search-input')?.value.toLowerCase() || '';

    let filtered = estimationFactors.filter(f => {
        const resourceNames = Object.keys(f.hoursPerResourceType || {})
            .map(id => resourceTypes.find(rt => rt.id === id)?.name || '')
            .join(' ')
            .toLowerCase();
        return f.name.toLowerCase().includes(searchQuery) ||
               (f.description || '').toLowerCase().includes(searchQuery) ||
               resourceNames.includes(searchQuery);
    }).sort((a, b) => a.name.localeCompare(b.name));

    const tbody = document.querySelector('#ef-table tbody');
    tbody.innerHTML = '';
    const itemsToDisplay = filtered.slice(0, preferences.maxEstimationFactors);

    itemsToDisplay.forEach(f => {
        const totalHours = Object.values(f.hoursPerResourceType || {}).reduce((a, b) => a + b, 0);
        const days = (totalHours / 8).toFixed(1);
        const resourceNames = Object.entries(f.hoursPerResourceType || {})
            .filter(([, v]) => v > 0)
            .map(([id]) => resourceTypes.find(rt => rt.id === id)?.name || id)
            .join(', ');
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${f.name}</td>
            <td>${resourceNames}</td>
            <td>${days}</td>
            <td>${totalHours}</td>
            <td style="white-space:nowrap;">
                <button class="edit-ef-btn" data-id="${f.id}">Edit</button>
                <button class="del-ef-btn" data-id="${f.id}" style="background:var(--red)">Del</button>
                <button class="audit-ef-btn" data-id="${f.id}" data-name="${f.name}">🔍</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

export function renderShirtSizesTable() {
    const tbody = document.querySelector('#shirt-size-table tbody');
    tbody.innerHTML = '';
    appState.shirtSizes.forEach(size => {
        const days = (size.threshold_hours / 8).toFixed(1);
        const months = (size.threshold_hours / 160).toFixed(1);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${size.size}</td>
            <td><input type="number" min="0" value="${size.threshold_hours}" data-size="${size.size}"></td>
            <td id="days-${size.size}">${days}</td>
            <td id="months-${size.size}">${months}</td>`;
        tbody.appendChild(tr);
    });
}


// --- UI Component Rendering ---

export function renderEFGridInModal() {
    const cont = document.getElementById('ef-hours');
    cont.innerHTML = '';
    appState.resourceTypes.forEach(rt => {
        const row = document.createElement('div');
        row.className = 'flex';
        row.innerHTML = `
            <label style="width:120px">${rt.name}</label>
            <input type="number" min="0" id="ef-h-${rt.id}">
            <select id="ef-u-${rt.id}">
                <option value="h">h</option>
                <option value="d">d</option>
            </select>`;
        cont.appendChild(row);
    });
}

export function renderJournalLog(logContainerId, journalEntries) {
    const journalLogDiv = document.getElementById(logContainerId);
    journalLogDiv.innerHTML = '';
    if (journalEntries && journalEntries.length > 0) {
        const sortedJournal = [...journalEntries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        sortedJournal.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'journal-entry';
            if (entry.type === 'audit') {
                entryDiv.classList.add('audit');
                // ... (complex audit rendering logic can be moved here)
                entryDiv.innerHTML = `<span class="timestamp">${formatDateInEST(entry.timestamp)}</span><h4>Audit: ${entry.action}</h4><p>Details logged.</p>`;
            } else {
                entryDiv.innerHTML = `<span class="timestamp">${formatDateInEST(entry.timestamp)}</span>${entry.text}`;
            }
            journalLogDiv.appendChild(entryDiv);
        });
        setTimeout(() => { journalLogDiv.scrollTop = journalLogDiv.scrollHeight; }, 50);
    } else {
        journalLogDiv.innerHTML = '<p style="text-align: center; color: #888;">No journal entries yet.</p>';
    }
}

export function renderFactorPicker(searchQuery = '') {
    const area = document.getElementById('factor-picker');
    area.innerHTML = '';
    const lowerCaseSearchQuery = searchQuery.toLowerCase();

    const factorsWithCheckedStatus = appState.estimationFactors.map(f => ({
        ...f,
        isChecked: appState.selectedFactors.some(sf => sf.factorId === f.id),
    }));

    const filteredAndSorted = factorsWithCheckedStatus
        .filter(f => {
            const resourceNames = Object.keys(f.hoursPerResourceType || {})
                .map(id => appState.resourceTypes.find(rt => rt.id === id)?.name || '')
                .join(' ').toLowerCase();
            return f.name.toLowerCase().includes(lowerCaseSearchQuery) ||
                   (f.description || '').toLowerCase().includes(lowerCaseSearchQuery) ||
                   resourceNames.includes(lowerCaseSearchQuery);
        })
        .sort((a, b) => {
            if (a.isChecked && !b.isChecked) return -1;
            if (!a.isChecked && b.isChecked) return 1;
            return a.name.localeCompare(b.name);
        });

    filteredAndSorted.forEach(f => {
        const row = document.createElement('div');
        row.className = 'factor-item';
        const selectedFactor = appState.selectedFactors.find(sf => sf.factorId === f.id);
        const qty = selectedFactor?.quantity || '1';
        const qtyDisplay = f.isChecked ? 'inline-block' : 'none';
        const resourceDetails = Object.entries(f.hoursPerResourceType || {})
            .filter(([, v]) => v > 0)
            .map(([id, val]) => {
                const r = appState.resourceTypes.find(x => x.id === id);
                return r ? `${r.name}: ${val}h` : '';
            }).join(', ');

        row.innerHTML = `
            <label class="custom-checkbox">
                <input type="checkbox" data-id="${f.id}" ${f.isChecked ? 'checked' : ''}>
                <span class="checkmark"></span>
            </label>
            <div class="factor-item-content">
                <div class="factor-name">${f.name}</div>
                <div class="factor-resources">(${resourceDetails})</div>
            </div>
            <input type="number" class="factor-qty" id="qty-${f.id}" value="${qty}" min="1" style="display:${qtyDisplay}">`;
        area.appendChild(row);
    });
    updateFactorCalculations();
}

export function updateFactorCalculations() {
    let totalHours = 0;
    appState.selectedFactors.forEach(sf => {
        const factor = appState.estimationFactors.find(f => f.id === sf.factorId);
        if (factor) {
            const totalFactorHours = Object.values(factor.hoursPerResourceType || {}).reduce((sum, h) => sum + h, 0);
            totalHours += totalFactorHours * (sf.quantity || 1);
        }
    });

    const hoursPerDay = 8;
    const hoursPerMonth = 160;
    const totalDays = (totalHours / hoursPerDay).toFixed(1);
    const totalMonths = (totalHours / hoursPerMonth).toFixed(1);
    const shirtSize = getShirtSizeFromHours(totalHours);

    document.getElementById('factor-hours').textContent = `${totalHours}h`;
    document.getElementById('factor-days').textContent = `${totalDays}d`;
    document.getElementById('factor-months').textContent = `${totalMonths}m`;
    document.getElementById('factor-size').textContent = `Size: ${shirtSize}`;
}

export function showPage(hash) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    const id = (hash || '#home').slice(1);
    const sec = document.getElementById(id);
    if (sec) {
        sec.classList.add('active');
        const headerHeight = document.getElementById('main-header').offsetHeight;
        setTimeout(() => {
            window.scrollTo({ top: sec.offsetTop - headerHeight, behavior: 'smooth' });
        }, 50);
    }
    if (document.getElementById('flyout-menu').classList.contains('active')) {
        toggleFlyoutMenu();
    }
}
