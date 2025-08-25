/**
 * factorPicker.js
 * Handles all logic for the "Select Factors" modal, including
 * calculations, rendering the picker, and saving selections.
 */

/**
 * Renders a summary of the selected factors in the main initiative modal.
 */
export function renderSelectedFactorsSummary() {
    const summary = document.getElementById('selected-factors-summary');
    if (summary) {
        if (window.selectedFactors && window.selectedFactors.length > 0) {
            summary.innerHTML = `<p>${window.selectedFactors.length} factor(s) selected.</p>`;
        } else {
            summary.innerHTML = `<p>No factors selected.</p>`;
        }
    }
}

/**
 * Opens the factor selection modal and loads necessary data.
 */
export async function openFactorModal() {
    await window.loadRT();
    await window.loadEF();
    await window.loadShirtSizes();
    document.getElementById('factor-search-input').value = '';
    loadFactorPicker();
    updateDateCalculations();
    window.openModal('factors');
}

/**
 * Loads and renders the list of available factors in the modal.
 * @param {string} [searchQuery=''] - A query to filter the factors.
 */
export function loadFactorPicker(searchQuery = '') {
  const area = document.getElementById('factor-picker');
  area.innerHTML = '';
  
  const lowerCaseSearchQuery = searchQuery.toLowerCase();
  
  const factorsWithCheckedStatus = window.efList.map(f => ({
      ...f,
      isChecked: window.selectedFactors.some(sf => sf.factorId === f.id)
  }));

  const filteredAndSortedEfList = factorsWithCheckedStatus
    .filter(f => {
      const factorName = f.name.toLowerCase();
      const factorDescription = (f.description || '').toLowerCase();
      const labourResourceNames = Object.entries(f.hoursPerResourceType || {})
        .map(([id]) => (window.rtList.find(x => x.id === id)?.name || '').toLowerCase())
        .join(' ');
      const nonLabourResourceNames = Object.entries(f.valuePerResourceType || {})
        .map(([id]) => (window.rtList.find(x => x.id === id)?.name || '').toLowerCase())
        .join(' ');
      const allResourceNames = labourResourceNames + ' ' + nonLabourResourceNames;
      return factorName.includes(lowerCaseSearchQuery) || factorDescription.includes(lowerCaseSearchQuery) || allResourceNames.includes(lowerCaseSearchQuery);
    })
    .sort((a, b) => {
        if (a.isChecked && !b.isChecked) return -1;
        if (!a.isChecked && b.isChecked) return 1;
        return a.name.localeCompare(b.name);
    });

  filteredAndSortedEfList.forEach(f => {
    const row = document.createElement('div');
    row.className = 'factor-item';
    const checked = f.isChecked ? 'checked' : '';
    const qty = window.selectedFactors.find(sf => sf.factorId === f.id)?.quantity || '1';
    const qtyDisplay = f.isChecked ? 'inline-block' : 'none';
    const hrs = f.hoursPerResourceType || {};
    const vals = f.valuePerResourceType || {};
    
    const labourParts = Object.entries(hrs)
        .filter(([, v]) => v > 0)
        .map(([id, val]) => {
            const r = window.rtList.find(x => x.id === id);
            return r ? `${r.name}: ${val}h` : `${id}: ${val}h`;
        });
    
    const nonLabourParts = Object.entries(vals)
        .filter(([, v]) => v > 0)
        .map(([id, val]) => {
            const r = window.rtList.find(x => x.id === id);
            return r ? `${r.name}: ${val}` : `${id}: ${val}`;
        });
    
    const allResourceParts = [...labourParts, ...nonLabourParts];
    const resourceDetails = allResourceParts.length > 0 ? `(${allResourceParts.join(', ')})` : '';

    row.innerHTML = `
        <label class="custom-checkbox">
            <input type="checkbox" data-id="${f.id}" onchange="window.toggleQty('${f.id}');" ${checked}>
            <span class="checkmark"></span>
        </label>
        <div class="factor-item-content">
            <div class="factor-name">${f.name}</div>
            <div class="factor-resources">${resourceDetails}</div>
        </div>
        <input type="number" id="qty-${f.id}" value="${qty}" min="1" oninput="window.updateFactorCalculations()" style="display:${qtyDisplay}">`;
    area.appendChild(row);
  });
  updateFactorCalculations();
  filteredAndSortedEfList.forEach(f => {
      toggleQtyDisplay(f.id);
  });
}

/**
 * Toggles the visibility of the quantity input next to a factor.
 * @param {string} id - The ID of the factor.
 */
export function toggleQtyDisplay(id) {
    const cb = document.querySelector(`#factor-picker input[data-id='${id}']`);
    const qtyInput = document.getElementById(`qty-${id}`);
    if (cb && qtyInput) {
        if (cb.checked) {
            qtyInput.style.display = 'inline-block';
            setTimeout(() => { // Allow display to apply before transition
                qtyInput.style.opacity = '1';
                qtyInput.style.width = '70px';
                qtyInput.style.border = '1px solid var(--border)';
            }, 10);
        } else {
            qtyInput.style.opacity = '0';
            qtyInput.style.width = '0';
            qtyInput.style.border = 'none';
            setTimeout(() => {
                qtyInput.style.display = 'none';
            }, 300);
        }
    }
}

/**
 * Handles the logic when a factor's checkbox is toggled.
 * @param {string} id - The ID of the factor toggled.
 */
export function toggleQty(id) {
    const cb = document.querySelector(`#factor-picker input[data-id='${id}']`);
    const qtyInput = document.getElementById(`qty-${id}`);
    if (cb.checked) {
        const factor = window.efList.find(f => f.id === id);
        if (factor && !window.selectedFactors.some(sf => sf.factorId === id)) {
            window.selectedFactors.push({
                factorId: factor.id,
                quantity: +qtyInput.value || 1,
                name: factor.name,
                hoursPerResourceType: factor.hoursPerResourceType
            });
        }
    } else {
        window.selectedFactors = window.selectedFactors.filter(sf => sf.factorId !== id);
    }
    const currentSearchQuery = document.getElementById('factor-search-input').value;
    loadFactorPicker(currentSearchQuery);
    updateFactorCalculations();
}

/**
 * Saves the selected factors back to the main initiative form.
 */
export function saveFactors() {
    renderSelectedFactorsSummary();
    let totalHoursForDisplay = 0;
    window.selectedFactors.forEach(f => {
        const totalFactorHours = Object.values(f.hoursPerResourceType || {}).reduce((sum, h) => sum + h, 0);
        totalHoursForDisplay += totalFactorHours * (f.quantity || 1);
    });
    const shirtSizeForDisplay = getShirtSizeFromHours(totalHoursForDisplay);
    document.getElementById('init-calculated-shirt-size').textContent = `Calculated T-Shirt Size: ${shirtSizeForDisplay} (${totalHoursForDisplay}h)`;
    window.closeModal('factors');
}

/**
 * Updates the calculated totals (hours, days, months, size) in the modal.
 */
export function updateFactorCalculations() {
    let totalHours = 0;
    window.selectedFactors.forEach(sf => {
        const factor = window.efList.find(f => f.id === sf.factorId);
        if (factor) {
            const qtyInput = document.getElementById(`qty-${sf.factorId}`);
            sf.quantity = +qtyInput.value || 1; // Update quantity in the global state
            const totalFactorHours = Object.values(factor.hoursPerResourceType || {}).reduce((sum, h) => sum + h, 0);
            totalHours += totalFactorHours * sf.quantity;
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


/**
 * Updates the date duration calculation in the modal.
 */
export function updateDateCalculations() {
    const startDateInput = document.getElementById('init-start-date').value;
    const endDateInput = document.getElementById('init-end-date').value;
    const dateCalcDiv = document.getElementById('initiative-date-calc');
    let displayStartDate = 'N/A';
    let displayEndDate = 'N/A';
    let durationText = 'Check';

    const startDate = startDateInput ? new Date(startDateInput + 'T00:00:00') : null;
    const endDate = endDateInput ? new Date(endDateInput + 'T00:00:00') : null;

    if (startDateInput) displayStartDate = startDateInput.substring(2);
    if (endDateInput) displayEndDate = endDateInput.substring(2);

    if (startDate && endDate && startDate <= endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const businessDays = calculateBusinessDays(startDate, endDate);
        const weeks = (totalDays / 7).toFixed(1);
        let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 - startDate.getMonth() + endDate.getMonth();
        if (endDate.getDate() < startDate.getDate()) months--;
        months = Math.max(0, months);
        durationText = `${months}m, ${weeks}w, ${businessDays}d`;
    }
    dateCalcDiv.textContent = `Start: ${displayStartDate} | End: ${displayEndDate} | Duration: ${durationText}`;
}

/**
 * Determines the T-shirt size for a given number of hours.
 * @param {number} hours - The total estimated hours.
 * @returns {string} The corresponding T-shirt size.
 */
export function getShirtSizeFromHours(hours) {
    let size = 'XS';
    const sortedSizes = [...window.shirtSizes].sort((a, b) => a.threshold_hours - b.threshold_hours);
    for (const s of sortedSizes) {
        if (hours >= s.threshold_hours) {
            size = s.size;
        } else {
            break;
        }
    }
    return size;
}

function calculateBusinessDays(startDate, endDate) {
    let count = 0;
    const currentDate = new Date(startDate.getTime());
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
}
