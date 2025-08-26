/**
 * app.js
 * Main application entry point.
 * Initializes the application, sets up global state, and wires up event listeners.
 */

// Import all functions from the new modules
import * as ui from './ui.js';
import * as initiatives from './initiatives.js';
import * as factors from './factors.js';
import * as factorPicker from './factorPicker.js';
import * as resourceTypes from './resourceTypes.js';
import * as shirtSizes from './shirtSizes.js';
import * as preferences from './preferences.js';
import * as dropdownOptions from './dropdownOptions.js';
import * as categories from './categories.js';

// --- Global State ---
// This section defines variables that are used across different modules.
// They are attached to the `window` object to be accessible globally,
// which minimizes changes to the original logic of the onclick handlers in the HTML.
window.API = '';
window.selectedFactors = [];
window.selectedCategories = [];
window.efList = [];
window.rtList = [];
window.shirtSizes = [];
window.currentInitiativeJournal = [];
window.currentEstimationFactorJournal = [];

// Sorting state for the main initiatives table
window.currentSortColumn = 'created_at';
window.currentSortDirection = 'desc';

// User preferences for display limits, loaded from cookies
window.userPreferences = {
    initiativeStatusFilter: ''
};

// --- Function Wiring ---
// Attach all imported functions to the `window` object so that
// the inline `onclick="..."` attributes in `index.html` can find them.
Object.assign(window, ui);
Object.assign(window, initiatives);
Object.assign(window, factors);
Object.assign(window, factorPicker);
Object.assign(window, resourceTypes);
Object.assign(window, shirtSizes);
Object.assign(window, preferences);
Object.assign(window, dropdownOptions);
Object.assign(window, categories);

// --- Dynamic Layout ---
// Function to dynamically resize the initiatives table to fill available space
window.resizeInitiativesTable = function() {
  const container = document.getElementById('init-table-container');
  if (!container) return;
  
  // Only resize when on home section
  const homeSection = document.getElementById('home');
  if (!homeSection || !homeSection.classList.contains('active')) return;
  
  // Calculate available height
  const viewportHeight = window.innerHeight;
  const headerHeight = document.getElementById('main-header')?.offsetHeight || 0;
  const sectionPadding = 48; // 24px top + 24px bottom
  
  // Get the height of elements above the table
  const controlsCard = homeSection.querySelector('.card:first-child');
  const controlsHeight = controlsCard?.offsetHeight || 0;
  const controlsMargin = 24; // margin-bottom on card
  
  // Calculate table container height
  const tableCardPadding = 40; // 20px padding on each side of card
  const tableContainerPadding = 20; // 10px padding on each side of container
  const minHeight = 200;
  
  const availableHeight = viewportHeight - headerHeight - sectionPadding - controlsHeight - controlsMargin - tableCardPadding - tableContainerPadding;
  const finalHeight = Math.max(minHeight, availableHeight);
  
  container.style.height = finalHeight + 'px';
};

// Debounced resize function
let resizeTimeout;
window.debouncedResize = function() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    window.resizeInitiativesTable();
  }, 100);
};

// --- Navigation ---
// The main navigation function for showing/hiding sections.
window.show = function(hash) {
  console.log('Navigating to:', hash); // Debug log
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  const id = (hash || '#home').slice(1);
  const sec = document.getElementById(id);
  if (sec) {
      sec.classList.add('active');
      // Update the URL hash
      if (window.location.hash !== hash) {
          window.location.hash = hash;
      }
      const headerHeight = document.getElementById('main-header').offsetHeight;
      setTimeout(() => {
          window.scrollTo({
              top: sec.offsetTop - headerHeight,
              behavior: 'smooth'
          });
      }, 50);
  } else {
      console.warn('Section not found:', id);
  }

  // Load data for the shown section
  if (id === 'home') {
    window.populatePrefsPage(); // Ensure preferences are loaded into the UI before loading initiatives
    window.initStatusFilter(); // Initialize/restore the status filter
    window.loadInitiatives(window.currentSortColumn, window.currentSortDirection);
    // Resize the table after a short delay to ensure DOM is ready
    setTimeout(() => {
      window.resizeInitiativesTable();
    }, 100);
  }
  if (id === 'factors') {
    window.loadRT().then(window.loadEF);
  }
  if (id === 'shirt-sizes') window.loadShirtSizes();
  if (id === 'prefs') {
    window.populatePrefsPage();
    // Give the DOM time to update before initializing categories
    setTimeout(async () => {
      try {
        await window.initCategoryManagement();
      } catch (error) {
        console.error('Error initializing categories:', error);
      }
    }, 100);
  }
  if (id === 'backups') {
    if (window.refreshBackupList) {
      window.refreshBackupList();
    }
    // Extra defensive close in case earlier logic didn't run due to timing
    const flyoutMenu2 = document.getElementById('flyout-menu');
    if (flyoutMenu2 && flyoutMenu2.classList.contains('active')) {
      flyoutMenu2.classList.remove('active');
    }
  }
  // About page is static content, no initialization needed
  
  // Close the flyout menu if it's open
  const flyoutMenu = document.getElementById('flyout-menu');
  if (flyoutMenu.classList.contains('active')) {
      flyoutMenu.classList.remove('active');
  }
}

// --- Branding ---
// Update header and page title based on enableBranding preference
window.applyBranding = function() {
  const brandingEnabled = window.userPreferences.enableBranding !== false;
  // Update header text
  const headerTitle = document.querySelector('#main-header h1');
  if (headerTitle) {
    headerTitle.textContent = brandingEnabled ? 'Estiim' : 'Home';
  }
  // Update page title
  document.title = brandingEnabled ? 'Estiim – T-Shirt Estimator' : 'EST';
};

// --- Initialization ---
// This is the main entry point when the page is loaded.
window.addEventListener('DOMContentLoaded', async () => { 
    // 1. Load user preferences from cookies first.
    window.loadPreferences(); 
    window.populatePrefsPage();
    window.applyBranding(); // Apply branding on load

    // 2. Initialize dropdown options
    await window.initDropdownOptions();

    // 3. Load foundational data (Resource Types, then Estimation Factors).
    window.loadRT().then(() => { 
        window.loadEF(); 
    }); 

    // 4. Load the main initiatives table.
    window.loadInitiatives(); 
    
    // 5. Set up routing based on the URL hash.
    window.addEventListener('hashchange', () => window.show(location.hash));
    
    // 6. Set up window resize listener for dynamic table sizing
    window.addEventListener('resize', window.debouncedResize);
    
    // Also handle initial page load
    if(location.hash) {
        window.show(location.hash);
    }
});
