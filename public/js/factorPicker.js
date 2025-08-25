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
 * Loads and renders the unified list of factors and manual resources in the modal.
 * @param {string} [searchQuery=''] - A query to filter the items.
 */
export function loadFactorPicker(searchQuery = '') {
  const area = document.getElementById('factor-picker');
  area.innerHTML = '';
  
  const lowerCaseSearchQuery = searchQuery.toLowerCase();
  
  // Prepare pre-built factors with checked status
  const factorsWithCheckedStatus = window.efList.map(f => ({
      ...f,
      isChecked: window.selectedFactors.some(sf => sf.factorId === f.id),
      type: 'factor'
  }));

  // Prepare manual resources as items
  const manualResourceItems = (window.rtList || []).map(rt => ({
      id: `manual-${rt.id}`,
      name: rt.name,
      description: rt.resource_category === 'Labour' ? 'Manual resource (hours)' : 'Manual resource (units)',
      resource_category: rt.resource_category,
      resource_type_id: rt.id,
      isChecked: false, // Manual resources don't have a "checked" state in the same way
      type: 'manual'
  }));

  // Combine and filter all items
  const allItems = [...factorsWithCheckedStatus, ...manualResourceItems];
  
  const filteredItems = allItems.filter(item => {
      const itemName = item.name.toLowerCase();
      const itemDescription = (item.description || '').toLowerCase();
      
      if (item.type === 'factor') {
          const labourResourceNames = Object.entries(item.hoursPerResourceType || {})
            .map(([id]) => (window.rtList.find(x => x.id === id)?.name || '').toLowerCase())
            .join(' ');
          const nonLabourResourceNames = Object.entries(item.valuePerResourceType || {})
            .map(([id]) => (window.rtList.find(x => x.id === id)?.name || '').toLowerCase())
            .join(' ');
          const allResourceNames = labourResourceNames + ' ' + nonLabourResourceNames;
          return itemName.includes(lowerCaseSearchQuery) || 
                 itemDescription.includes(lowerCaseSearchQuery) || 
                 allResourceNames.includes(lowerCaseSearchQuery);
      } else {
          // For manual resources, search name and category
          return itemName.includes(lowerCaseSearchQuery) || 
                 itemDescription.includes(lowerCaseSearchQuery) ||
                 item.resource_category.toLowerCase().includes(lowerCaseSearchQuery);
      }
  });

  // Sort: checked factors first, then unchecked factors, then manual resources, all alphabetically within groups
  const sortedItems = filteredItems.sort((a, b) => {
      if (a.type === 'factor' && b.type === 'factor') {
          if (a.isChecked && !b.isChecked) return -1;
          if (!a.isChecked && b.isChecked) return 1;
          return a.name.localeCompare(b.name);
      } else if (a.type === 'factor' && b.type === 'manual') {
          return -1; // Factors before manual resources
      } else if (a.type === 'manual' && b.type === 'factor') {
          return 1; // Manual resources after factors
      } else {
          return a.name.localeCompare(b.name); // Both manual, sort alphabetically
      }
  });

  // Render each item
  sortedItems.forEach(item => {
    if (item.type === 'factor') {
        renderFactorItem(item, area);
    } else {
        renderManualResourceItem(item, area);
    }
  });
  
  updateFactorCalculations();
  
  // Update quantity displays for factors
  factorsWithCheckedStatus.forEach(f => {
      toggleQtyDisplay(f.id);
  });
}

/**
 * Renders a pre-built factor item in the picker.
 */
function renderFactorItem(factor, container) {
    const row = document.createElement('div');
    row.className = 'factor-item';
    const checked = factor.isChecked ? 'checked' : '';
    const qty = window.selectedFactors.find(sf => sf.factorId === factor.id)?.quantity || '1';
    const qtyDisplay = factor.isChecked ? 'inline-block' : 'none';
    const hrs = factor.hoursPerResourceType || {};
    const vals = factor.valuePerResourceType || {};
    
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
            <input type="checkbox" data-id="${factor.id}" onchange="window.toggleQty('${factor.id}');" ${checked}>
            <span class="checkmark"></span>
        </label>
        <div class="factor-item-content">
            <div class="factor-name"><strong>[pre-built]</strong> ${factor.name}</div>
            <div class="factor-resources">${resourceDetails}</div>
        </div>
        <input type="number" id="qty-${factor.id}" value="${qty}" min="1" oninput="window.updateFactorCalculations()" style="display:${qtyDisplay}">`;
    container.appendChild(row);
}

/**
 * Renders a manual resource item in the picker.
 */
function renderManualResourceItem(resource, container) {
    const row = document.createElement('div');
    row.className = 'factor-item manual-resource-item';
    
    const isNonLabour = resource.resource_category === 'Non-Labour';
    const rtId = resource.resource_type_id;
    
    // Get current value from window.manualResources if it exists
    const currentManualHours = (window.manualResources?.manualHours || {})[rtId] || 0;
    const currentManualValues = (window.manualResources?.manualValues || {})[rtId] || 0;
    let displayValue = '';
    let displayUnit = 'h';
    
    if (isNonLabour) {
        displayValue = currentManualValues || '';
    } else {
        if (currentManualHours > 0) {
            if (currentManualHours % 8 === 0) {
                displayValue = currentManualHours / 8;
                displayUnit = 'd';
            } else {
                displayValue = currentManualHours;
                displayUnit = 'h';
            }
        }
    }
    
    if (isNonLabour) {
        // For Non-Labour: show a numerical input for values
        row.innerHTML = `
            <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
                <div class="factor-item-content" style="flex: 1;">
                    <div class="factor-name">${resource.name}</div>
                    <div class="factor-resources">(Manual ${resource.resource_category} Resource)</div>
                </div>
                <input type="number" min="0" step="0.01" id="manual-${rtId}" 
                       value="${displayValue}"
                       style="width: 80px;" 
                       placeholder="0"
                       oninput="window.updateFactorCalculations()">
                <span style="font-size: 0.9em; color: #666; width: 40px;">units</span>
            </div>
        `;
    } else {
        // For Labour: show hours/days input with dropdown
        row.innerHTML = `
            <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
                <div class="factor-item-content" style="flex: 1;">
                    <div class="factor-name">${resource.name}</div>
                    <div class="factor-resources">(Manual ${resource.resource_category} Resource)</div>
                </div>
                <input type="number" min="0" id="manual-${rtId}" 
                       value="${displayValue}"
                       style="width: 60px;" 
                       placeholder="0"
                       oninput="window.updateFactorCalculations()">
                <select id="manual-unit-${rtId}" style="width: 50px;" onchange="window.updateFactorCalculations()">
                    <option value="h" ${displayUnit === 'h' ? 'selected' : ''}>h</option>
                    <option value="d" ${displayUnit === 'd' ? 'selected' : ''}>d</option>
                </select>
            </div>
        `;
    }
    
    container.appendChild(row);
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

