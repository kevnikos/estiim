/**
 * public/js/main.js
 * * Main application entry point for the frontend.
 * - Initializes the app
 * - Sets up event listeners
 * - Orchestrates calls between api.js, state.js, and ui.js
 */

import appState from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

// --- DATA LOADING & STATE MANAGEMENT ---

async function loadAllData() {
    try {
        // Fetch all primary data sources in parallel.
        const [initiatives, factors, rts, sizes] = await Promise.all([
            api.getInitiatives(),
            api.getEstimationFactors(),
            api.getResourceTypes(),
            api.getShirtSizes()
        ]);
        // Update the central state.
        appState.initiatives = initiatives;
        appState.estimationFactors = factors;
        appState.resourceTypes = rts;
        appState.shirtSizes = sizes;
        console.log("All initial data loaded.", appState);
    } catch (error) {
        ui.showMessage('Error', 'Failed to load initial application data.', 'error');
    }
}

function loadPreferences() {
    const prefsCookie = document.cookie.split('; ').find(row => row.startsWith('estiim_prefs='));
    if (prefsCookie) {
        try {
            const parsed = JSON.parse(decodeURIComponent(prefsCookie.split('=')[1]));
            appState.preferences = { ...appState.preferences, ...parsed };
        } catch (e) {
            console.error("Error parsing preferences cookie:", e);
        }
    }
}

function savePreferences() {
    const maxInit = document.getElementById('pref-max-initiatives').value;
    const maxRT = document.getElementById('pref-max-resource-types').value;
    const maxEF = document.getElementById('pref-max-estimation-factors').value;

    appState.preferences.maxInitiatives = parseInt(maxInit, 10) || 8;
    appState.preferences.maxResourceTypes = parseInt(maxRT, 10) || 5;
    appState.preferences.maxEstimationFactors = parseInt(maxEF, 10) || 5;

    const d = new Date();
    d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = `estiim_prefs=${encodeURIComponent(JSON.stringify(appState.preferences))};${expires};path=/`;
    
    ui.showMessage('Success', 'Preferences saved successfully!', 'success');
    refreshAllTables();
}

// --- EVENT HANDLERS SETUP ---

function setupEventListeners() {
    // Navigation
    window.addEventListener('hashchange', handleNavigation);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = e.target.getAttribute('href');
        });
    });

    // Header Flyout Menu
    document.getElementById('gear-icon').addEventListener('click', ui.toggleFlyoutMenu);
    
    // Main page "Add" buttons
    document.getElementById('add-initiative-btn').addEventListener('click', handleAddInitiative);
    document.getElementById('add-rt-btn').addEventListener('click', handleAddResourceType);
    document.getElementById('add-ef-btn').addEventListener('click', handleAddEstimationFactor);

    // Modal close buttons (delegated)
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.modal .close, .modal .cancel-btn')) {
            ui.closeModal(e.target.dataset.modal);
        }
    });

    // Modal "Save" buttons
    document.getElementById('save-initiative-btn').addEventListener('click', handleSaveInitiative);
    document.getElementById('save-rt-btn').addEventListener('click', handleSaveResourceType);
    document.getElementById('save-ef-btn').addEventListener('click', handleSaveEstimationFactor);
    document.getElementById('save-shirt-sizes-btn').addEventListener('click', handleSaveShirtSizes);
    document.getElementById('save-prefs-btn').addEventListener('click', savePreferences);

    // Table-level event delegation for edit/delete/audit buttons
    document.getElementById('init-table').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.classList.contains('edit-init-btn')) handleEditInitiative(target.dataset.id);
        if (target.classList.contains('del-init-btn')) handleDeleteInitiative(target.dataset.id);
    });
    document.getElementById('rt-table').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.classList.contains('edit-rt-btn')) handleEditResourceType(target.dataset.id);
        if (target.classList.contains('del-rt-btn')) handleDeleteResourceType(target.dataset.id);
    });
    document.getElementById('ef-table').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.classList.contains('edit-ef-btn')) handleEditEstimationFactor(target.dataset.id);
        if (target.classList.contains('del-ef-btn')) handleDeleteEstimationFactor(target.dataset.id);
    });

    // Search inputs
    document.getElementById('init-search-input').addEventListener('input', () => ui.renderInitiativesTable());
    document.getElementById('rt-search-input').addEventListener('input', () => ui.renderResourceTypesTable());
    document.getElementById('ef-search-input').addEventListener('input', () => ui.renderEstimationFactorsTable());
    document.getElementById('factor-search-input').addEventListener('input', (e) => ui.renderFactorPicker(e.target.value));

    // Factor Picker interactions
    document.getElementById('select-factors-btn').addEventListener('click', handleOpenFactorPicker);
    document.getElementById('save-factors-btn').addEventListener('click', handleSaveFactors);
    document.getElementById('factor-picker').addEventListener('change', handleFactorSelectionChange);
    document.getElementById('factor-picker').addEventListener('input', handleFactorQtyChange);

    // Message box OK
    document.getElementById('message-box-ok-btn').addEventListener('click', ui.hideMessage);
}

// --- INITIATIVE HANDLERS ---

function handleAddInitiative() {
    appState.currentInitiativeId = null;
    appState.selectedFactors = [];
    appState.currentInitiativeJournal = [];
    ui.populateInitiativeModal(null); // Pass null to clear the form
    ui.openModal('init');
}

function handleEditInitiative(id) {
    const initiative = appState.initiatives.find(i => i.id == id);
    if (!initiative) return;

    appState.currentInitiativeId = id;
    // Deep copy factors and journal to prevent modifying the main state directly
    appState.selectedFactors = JSON.parse(JSON.stringify(initiative.selected_factors || []));
    appState.currentInitiativeJournal = initiative.journal_entries || [];
    
    ui.populateInitiativeModal(initiative);
    ui.openModal('init');
}

async function handleSaveInitiative() {
    const initiativeData = ui.getInitiativeFormData(); // Get data from UI
    if (!initiativeData.name) {
        return ui.showMessage('Error', 'Initiative name is required.', 'error');
    }

    try {
        await api.saveInitiative(initiativeData);
        ui.closeModal('init');
        await refreshAllData();
        ui.showMessage('Success', `Initiative "${initiativeData.name}" saved.`, 'success');
    } catch (error) {
        ui.showMessage('Error', `Failed to save initiative: ${error.message}`, 'error');
    }
}

async function handleDeleteInitiative(id) {
    // A proper implementation would use a custom, non-blocking modal.
    // For now, we proceed without confirmation to avoid using `confirm()`.
    try {
        await api.deleteInitiative(id);
        await refreshAllData();
        ui.showMessage('Success', 'Initiative deleted.', 'success');
    } catch (error) {
        ui.showMessage('Error', `Failed to delete initiative: ${error.message}`, 'error');
    }
}

// --- FACTOR PICKER HANDLERS ---

function handleOpenFactorPicker() {
    ui.renderFactorPicker();
    ui.openModal('factors');
}

function handleSaveFactors() {
    ui.closeModal('factors');
    ui.updateSelectedFactorsSummary();
    ui.updateInitiativeShirtSizeDisplay();
}

function handleFactorSelectionChange(event) {
    if (event.target.type !== 'checkbox') return;
    
    const factorId = event.target.dataset.id;
    const isChecked = event.target.checked;
    
    if (isChecked) {
        const factor = appState.estimationFactors.find(f => f.id === factorId);
        if (factor && !appState.selectedFactors.some(sf => sf.factorId === factorId)) {
            appState.selectedFactors.push({
                factorId: factor.id,
                quantity: 1,
                name: factor.name,
                hoursPerResourceType: factor.hoursPerResourceType
            });
        }
    } else {
        appState.selectedFactors = appState.selectedFactors.filter(sf => sf.factorId !== factorId);
    }
    ui.renderFactorPicker(document.getElementById('factor-search-input').value);
}

function handleFactorQtyChange(event) {
    if (!event.target.classList.contains('factor-qty')) return;
    
    const factorId = event.target.id.replace('qty-', '');
    const quantity = +event.target.value;

    const selectedFactor = appState.selectedFactors.find(sf => sf.factorId === factorId);
    if (selectedFactor) {
        selectedFactor.quantity = quantity;
    }
    ui.updateFactorCalculations();
}

// --- OTHER RESOURCE HANDLERS ---

function handleAddResourceType() {
    ui.populateResourceTypeModal(null);
    ui.openModal('rt');
}

function handleEditResourceType(id) {
    const rt = appState.resourceTypes.find(r => r.id === id);
    ui.populateResourceTypeModal(rt);
    ui.openModal('rt');
}

async function handleSaveResourceType() {
    const rtData = ui.getResourceTypeFormData();
    if (!rtData.name) return ui.showMessage('Error', 'Name is required.', 'error');
    
    try {
        await api.saveResourceType(rtData);
        ui.closeModal('rt');
        await refreshAllData();
    } catch (error) {
        ui.showMessage('Error', `Failed to save resource type: ${error.message}`, 'error');
    }
}

async function handleDeleteResourceType(id) {
    try {
        await api.deleteResourceType(id);
        await refreshAllData();
    } catch (error) {
        ui.showMessage('Error', `Failed to delete resource type: ${error.message}`, 'error');
    }
}

function handleAddEstimationFactor() {
    appState.currentFactorId = null;
    appState.currentEstimationFactorJournal = [];
    ui.populateEstimationFactorModal(null);
    ui.openModal('ef');
}

function handleEditEstimationFactor(id) {
    const factor = appState.estimationFactors.find(f => f.id === id);
    if (!factor) return;

    appState.currentFactorId = id;
    appState.currentEstimationFactorJournal = factor.journal_entries || [];
    ui.populateEstimationFactorModal(factor);
    ui.openModal('ef');
}

async function handleSaveEstimationFactor() {
    const factorData = ui.getEstimationFactorFormData();
    if (!factorData.name) return ui.showMessage('Error', 'Name is required.', 'error');

    try {
        await api.saveEstimationFactor(factorData);
        ui.closeModal('ef');
        await refreshAllData();
    } catch (error) {
        ui.showMessage('Error', `Failed to save estimation factor: ${error.message}`, 'error');
    }
}

async function handleDeleteEstimationFactor(id) {
    try {
        await api.deleteEstimationFactor(id);
        await refreshAllData();
    } catch (error) {
        ui.showMessage('Error', `Failed to delete estimation factor: ${error.message}`, 'error');
    }
}

async function handleSaveShirtSizes() {
    const newSizes = ui.getShirtSizeFormData();
    try {
        await api.saveShirtSizes(newSizes);
        await refreshAllData();
        ui.showMessage('Success', 'Shirt sizes saved.', 'success');
    } catch (error) {
        ui.showMessage('Error', `Failed to save shirt sizes: ${error.message}`, 'error');
    }
}

// --- INITIALIZATION & NAVIGATION ---

async function refreshAllData() {
    await loadAllData();
    refreshAllTables();
}

function refreshAllTables() {
    ui.renderInitiativesTable();
    ui.renderResourceTypesTable();
    ui.renderEstimationFactorsTable();
    ui.renderShirtSizesTable();
}

function handleNavigation() {
    const hash = window.location.hash || '#home';
    ui.showPage(hash);
    
    switch (hash) {
        case '#home':
            ui.renderInitiativesTable();
            break;
        case '#factors':
            ui.renderResourceTypesTable();
            ui.renderEstimationFactorsTable();
            break;
        case '#shirt-sizes':
            ui.renderShirtSizesTable();
            break;
        case '#prefs':
            ui.populatePrefsPage();
            break;
    }
}

// App's main entry point
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed");
    lucide.createIcons();
    loadPreferences();
    await refreshAllData();
    setupEventListeners();
    handleNavigation();
});
