/**
 * public/js/state.js
 * * Manages the global state of the frontend application.
 */

// This object holds the application's state.
// Other modules can import this and access or modify the state.
const appState = {
    // Lists of data fetched from the API
    initiatives: [],
    estimationFactors: [],
    resourceTypes: [],
    shirtSizes: [],

    // State for the currently edited initiative or factor
    currentInitiativeId: null,
    currentFactorId: null,
    
    // Factors selected in the factor picker modal
    selectedFactors: [],
    
    // Journal entries for the currently open modal
    currentInitiativeJournal: [],
    currentEstimationFactorJournal: [],

    // State for sorting the initiatives table
    initiativesSort: {
        column: 'created_at',
        direction: 'desc',
    },

    // User preferences
    preferences: {
        maxInitiatives: 8,
        maxResourceTypes: 5,
        maxEstimationFactors: 5,
    },
};

export default appState;
