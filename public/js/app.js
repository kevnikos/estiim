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

// --- Global State ---
// This section defines variables that are used across different modules.
// They are attached to the `window` object to be accessible globally,
// which minimizes changes to the original logic of the onclick handlers in the HTML.
window.API = '';
window.selectedFactors = [];
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
    maxInitiatives: 8,
    maxResourceTypes: 5,
    maxEstimationFactors: 5
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

// --- Navigation ---
// The main navigation function for showing/hiding sections.
window.show = function(hash) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  const id = (hash || '#home').slice(1);
  const sec = document.getElementById(id);
  if (sec) {
      sec.classList.add('active');
      const headerHeight = document.getElementById('main-header').offsetHeight;
      setTimeout(() => {
          window.scrollTo({
              top: sec.offsetTop - headerHeight,
              behavior: 'smooth'
          });
      }, 50);
  }

  // Load data for the shown section
  if (id === 'home') window.loadInitiatives(window.currentSortColumn, window.currentSortDirection);
  if (id === 'factors') {
    window.loadRT().then(window.loadEF);
  }
  if (id === 'shirt-sizes') window.loadShirtSizes();
  if (id === 'prefs') window.populatePrefsPage();
  
  // Close the flyout menu if it's open
  const flyoutMenu = document.getElementById('flyout-menu');
  if (flyoutMenu.classList.contains('active')) {
      flyoutMenu.classList.remove('active');
  }
}

// --- Initialization ---
// This is the main entry point when the page is loaded.
window.addEventListener('DOMContentLoaded', () => { 
    // 1. Load user preferences from cookies first.
    window.loadPreferences(); 
    
    // 2. Load foundational data (Resource Types, then Estimation Factors).
    window.loadRT().then(() => { 
        window.loadEF(); 
    }); 
    
    // 3. Load the main initiatives table.
    window.loadInitiatives(); 
    
    // 4. Set up routing based on the URL hash.
    window.addEventListener('hashchange', () => window.show(location.hash));
    // Also handle initial page load
    if(location.hash) {
        window.show(location.hash);
    }
});
