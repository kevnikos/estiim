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
    renderManualResourcesGrid();
    populateManualResourcesFromData();
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
    // Save manual resources to global variable
    window.manualResources = getManualResources();
    
    renderSelectedFactorsSummary();
    let totalHoursForDisplay = 0;
    
    // Add hours from selected factors
    window.selectedFactors.forEach(f => {
        const totalFactorHours = Object.values(f.hoursPerResourceType || {}).reduce((sum, h) => sum + h, 0);
        totalHoursForDisplay += totalFactorHours * (f.quantity || 1);
    });
    
    // Add hours from manual resources
    const { manualHours } = window.manualResources;
    Object.values(manualHours).forEach(hours => {
        totalHoursForDisplay += hours;
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
    
    // Add hours from selected factors
    window.selectedFactors.forEach(sf => {
        const factor = window.efList.find(f => f.id === sf.factorId);
        if (factor) {
            const qtyInput = document.getElementById(`qty-${sf.factorId}`);
            sf.quantity = +qtyInput.value || 1; // Update quantity in the global state
            const totalFactorHours = Object.values(factor.hoursPerResourceType || {}).reduce((sum, h) => sum + h, 0);
            totalHours += totalFactorHours * sf.quantity;
        }
    });
    
    // Add hours from manual resources (with error handling)
    try {
        const { manualHours } = getManualResources();
        Object.values(manualHours).forEach(hours => {
            totalHours += hours;
        });
    } catch (error) {
        console.error('Error calculating manual resources:', error);
    }

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

/**
 * Renders the manual resources grid for direct input.
 */
export function renderManualResourcesGrid() {
    const container = document.getElementById('manual-resources-grid');
    if (!container || !window.rtList) return;
    
    container.innerHTML = '';
    
    window.rtList.forEach(rt => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px; gap: 8px;';
        
        const isNonLabour = rt.resource_category === 'Non-Labour';
        
        if (isNonLabour) {
            // For Non-Labour: show a numerical input for values
            row.innerHTML = `
                <label style="width: 120px; font-size: 0.9em;">${rt.name}:</label>
                <input type="number" min="0" step="0.01" id="manual-${rt.id}" 
                       style="flex: 1; max-width: 100px;" 
                       placeholder="0"
                       oninput="window.updateManualFactorCalculations()">
                <span style="font-size: 0.8em; color: #666;">units</span>
            `;
        } else {
            // For Labour: show hours/days input with dropdown
            row.innerHTML = `
                <label style="width: 120px; font-size: 0.9em;">${rt.name}:</label>
                <input type="number" min="0" id="manual-${rt.id}" 
                       style="width: 60px;" 
                       placeholder="0"
                       oninput="window.updateManualFactorCalculations()">
                <select id="manual-unit-${rt.id}" style="width: 50px;" onchange="window.updateManualFactorCalculations()">
                    <option value="h">h</option>
                    <option value="d">d</option>
                </select>
            `;
        }
        
        container.appendChild(row);
    });
}

/**
 * Updates the factor calculations including manual resources.
 */
export function updateManualFactorCalculations() {
    updateFactorCalculations();
}

/**
 * Gets the manual resource hours/values as objects.
 */
export function getManualResources() {
    const manualHours = {};
    const manualValues = {};
    
    if (!window.rtList) return { manualHours, manualValues };
    
    try {
        window.rtList.forEach(rt => {
            const input = document.getElementById(`manual-${rt.id}`);
            const unitSelect = document.getElementById(`manual-unit-${rt.id}`);
            
            if (input && input.value && +input.value > 0) {
                let val = +input.value;
                
                if (rt.resource_category === 'Non-Labour') {
                    manualValues[rt.id] = val;
                } else {
                    // For Labour: convert days to hours if needed
                    if (unitSelect && unitSelect.value === 'd') {
                        val *= 8;
                    }
                    manualHours[rt.id] = val;
                }
            }
        });
    } catch (error) {
        console.error('Error getting manual resources:', error);
    }
    
    return { manualHours, manualValues };
}

/**
 * Populates the manual resources grid with existing data.
 */
export function populateManualResourcesFromData() {
    if (!window.rtList) return;
    
    // Ensure window.manualResources has the correct structure
    if (!window.manualResources) {
        window.manualResources = { manualHours: {}, manualValues: {} };
    }
    
    const manualHours = window.manualResources.manualHours || {};
    const manualValues = window.manualResources.manualValues || {};
    
    window.rtList.forEach(rt => {
        const input = document.getElementById(`manual-${rt.id}`);
        const unitSelect = document.getElementById(`manual-unit-${rt.id}`);
        
        if (rt.resource_category === 'Non-Labour') {
            // For Non-Labour: set the value directly
            if (input && manualValues[rt.id]) {
                input.value = manualValues[rt.id];
            }
        } else {
            // For Labour: set hours/days value and unit
            if (input && manualHours[rt.id]) {
                const hours = manualHours[rt.id];
                if (hours % 8 === 0 && unitSelect) {
                    // Display as days if divisible by 8
                    input.value = hours / 8;
                    unitSelect.value = 'd';
                } else {
                    // Display as hours
                    input.value = hours;
                    if (unitSelect) unitSelect.value = 'h';
                }
            }
        }
    });
    
    // Update calculations after populating
    updateFactorCalculations();
}
