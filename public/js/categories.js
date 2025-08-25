/**
 * categories.js
 * Handles CRUD operations and UI for categories
 */

// Cache for categories to avoid unnecessary API calls
let categoriesCache = null;
let lastFetchTime = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize categories UI in the initiative modal
 */
window.initCategoriesUI = function() {
    // Get the input element for categories
    const categoriesInput = document.getElementById('init-categories');
    
    // Get existing categories and ensure it's an array
    let selectedCategories;
    if (typeof window.selectedCategories === 'string') {
        try {
            selectedCategories = JSON.parse(window.selectedCategories || '[]');
        } catch (e) {
            selectedCategories = [];
        }
    } else {
        selectedCategories = Array.isArray(window.selectedCategories) ? window.selectedCategories : [];
    }
    window.selectedCategories = selectedCategories;
    
    // Clear the input
    categoriesInput.value = '';
    
    // Display selected categories
    updateCategoriesDisplay(selectedCategories);

    // Set up event listeners if not already done
    if (!categoriesInput.hasListener) {
        categoriesInput.hasListener = true;
        categoriesInput.addEventListener('input', handleCategoryInput);
        categoriesInput.addEventListener('keydown', handleCategoryKeydown);
    }
};

/**
 * Handle category input changes
 */
async function handleCategoryInput(e) {
    const input = e.target;
    const query = input.value.trim();
    const suggestionsDiv = document.getElementById('category-suggestions');

    if (query) {
        // Search for matching categories
        const categories = await searchCategories(query);
        
        // Show suggestions
        if (categories.length > 0) {
            suggestionsDiv.innerHTML = '';
            categories.forEach(category => {
                const div = document.createElement('div');
                div.className = 'category-suggestion';
                div.textContent = category.name;
                div.onclick = () => addCategory(category.name);
                suggestionsDiv.appendChild(div);
            });
            suggestionsDiv.style.display = 'block';
        } else {
            suggestionsDiv.style.display = 'none';
        }
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

/**
 * Handle category input keydown
 */
function handleCategoryKeydown(e) {
    // Remove comma from the input if it was typed
    const input = e.target;
    const value = input.value.replace(/,/g, '').trim();
    
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (value) {
            addCategory(value);
        }
    }
}

/**
 * Add a category to the selected categories
 */
async function addCategory(categoryName) {
    // Initialize the array if it doesn't exist
    if (!window.selectedCategories) {
        window.selectedCategories = [];
    }
    
    try {
        // Check if the category already exists
        const existingCategories = await loadCategories(true);
        const existingCategory = existingCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        
        if (!existingCategory) {
            // Only create if it doesn't exist
            await createCategory(categoryName);
        }
        
        // Add the category if it's not already selected
        if (!window.selectedCategories.includes(categoryName)) {
            window.selectedCategories.push(categoryName);
            updateCategoriesDisplay(window.selectedCategories);
        }
        
        // Clear the input and hide suggestions
        const input = document.getElementById('init-categories');
        input.value = '';
        document.getElementById('category-suggestions').style.display = 'none';
    } catch (error) {
        console.error('Error adding category:', error);
        window.showMessage('Error', error.message, 'error');
    }
}

/**
 * Remove a category from the selected categories
 */
function removeCategory(categoryName) {
    if (window.selectedCategories) {
        window.selectedCategories = window.selectedCategories.filter(cat => cat !== categoryName);
        updateCategoriesDisplay(window.selectedCategories);
    }
}

/**
 * Update the categories display
 */
function updateCategoriesDisplay(categories) {
    const displayDiv = document.getElementById('categories-display');
    displayDiv.innerHTML = '';
    
    // Ensure categories is an array and handle string JSON if needed
    const categoryArray = Array.isArray(categories) ? categories : 
                        (typeof categories === 'string' ? JSON.parse(categories || '[]') : []);
    
    categoryArray.forEach(category => {
        const tag = document.createElement('span');
        tag.className = 'category-tag';
        tag.innerHTML = `${category} <span class="remove-tag" onclick="removeCategory('${category}')">&times;</span>`;
        displayDiv.appendChild(tag);
    });
}

// Make removeCategory available globally
window.removeCategory = removeCategory;



/**
 * Fetch all categories, using cache if available and not expired
 */
export async function loadCategories(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && categoriesCache && lastFetchTime && (now - lastFetchTime < CACHE_TTL)) {
        console.log('Using cached categories:', categoriesCache);
        return categoriesCache;
    }

    try {
        console.log('Fetching categories from API');
        const res = await fetch(window.API + '/api/categories');
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        categoriesCache = await res.json();
        console.log('Received categories:', categoriesCache);
        lastFetchTime = now;
        return categoriesCache;
    } catch (error) {
        console.error('Error loading categories:', error);
        return [];
    }
}

/**
 * Search categories with a query string
 */
export async function searchCategories(query) {
    const res = await fetch(window.API + `/api/categories?query=${encodeURIComponent(query)}`);
    return await res.json();
}

/**
 * Create a new category
 */
export async function createCategory(name) {
    const res = await fetch(window.API + '/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create category');
    }
    
    categoriesCache = null; // Invalidate cache
    return await res.json();
}

/**
 * Delete a category
 */
export async function deleteCategory(id) {
    await fetch(window.API + `/api/categories/${id}`, { method: 'DELETE' });
    categoriesCache = null; // Invalidate cache
}

/**
 * Update a category
 */
export async function updateCategory(id, name) {
    const res = await fetch(window.API + `/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update category');
    }
    
    categoriesCache = null; // Invalidate cache
    updateSelectedCategoriesList(); // Update the selected categories list
    return await res.json();
}

/**
 * Increment the usage count for a category
 */
export async function incrementCategoryUsage(id) {
    const res = await fetch(window.API + `/api/categories/${id}/increment`, {
        method: 'POST'
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update category usage');
    }
    
    categoriesCache = null; // Invalidate cache
    return await res.json();
}

/**
 * Clean up any existing category management sections
 */
function cleanupCategoryManagement() {
    const prefsContent = document.getElementById('preferences-content');
    if (!prefsContent) return;
    
    // Remove any existing categories management cards
    const categoriesSections = Array.from(prefsContent.querySelectorAll('div.card')).filter(card => {
        const h3 = card.querySelector('h3');
        return h3 && h3.textContent.trim() === 'Categories';
    });
    
    categoriesSections.forEach(section => {
        console.log('Removing existing categories section');
        section.remove();
    });
}

/**
 * Initialize category management in the preferences section
 */
export async function initCategoryManagement() {
    console.log('Initializing category management');
    
    // Clean up any existing sections first
    cleanupCategoryManagement();
    
    const prefsContent = document.getElementById('preferences-content');
    if (!prefsContent) {
        console.error('Preferences content container not found');
        return;
    }
    
    // Find the General Preferences card to insert before it
    const generalPrefsCard = document.getElementById('prefs-card');
    if (!generalPrefsCard) {
        console.error('General preferences card not found');
        return;
    }
    
    const categoriesSection = document.createElement('div');
    categoriesSection.className = 'card';
    categoriesSection.id = 'categories-management-card'; // Add unique ID
    categoriesSection.innerHTML = `
        <h3>Categories</h3>
        <div class="pref-content">
            <div class="pref-row" style="margin-bottom: 12px;">
                <input type="text" id="new-category" placeholder="New category name">
                <button onclick="window.addCategory()">Add</button>
            </div>
            <div id="categories-list" class="list-container"></div>
        </div>
    `;
    
    // Insert the categories section before the general preferences card
    prefsContent.insertBefore(categoriesSection, generalPrefsCard);
    
    // Recalculate counts before showing the list
    try {
        await fetch(window.API + '/api/categories/recalculate', { method: 'POST' });
    } catch (error) {
        console.error('Error recalculating category counts:', error);
    }
    
    refreshCategoriesList();
}

/**
 * Refresh the categories list in the preferences section
 */
export async function refreshCategoriesList() {
    const categories = await loadCategories(true);
    const listContainer = document.getElementById('categories-list');
    if (!listContainer) {
        console.error('Categories list container not found');
        return;
    }
    listContainer.innerHTML = '';
    
    console.log('Refreshing categories list with:', categories);
    
    categories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <span class="item-name">${category.name}</span>
            <span class="item-info">Used ${category.usage_count || 0} times</span>
            <div class="item-actions">
                <button onclick="window.deleteCategory(${category.id})">Delete</button>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

// Global functions for HTML onclick handlers
window.addCategory = async function() {
    const input = document.getElementById('new-category');
    const name = input.value.trim();
    if (!name) return;
    
    try {
        await createCategory(name);
        input.value = '';
        refreshCategoriesList();
        window.showMessage('Success', 'Category added successfully', 'success');
    } catch (error) {
        window.showMessage('Error', error.message, 'error');
    }
}

window.deleteCategory = async function(id) {
    if (!confirm('Delete this category?')) return;
    
    try {
        await deleteCategory(id);
        refreshCategoriesList();
        window.showMessage('Success', 'Category deleted successfully', 'success');
    } catch (error) {
        window.showMessage('Error', error.message, 'error');
    }
}

window.recalculateCategoryCounts = async function() {
    try {
        await fetch(window.API + '/api/categories/recalculate', { method: 'POST' });
        await refreshCategoriesList();
        window.showMessage('Success', 'Category usage counts recalculated', 'success');
    } catch (error) {
        window.showMessage('Error', 'Failed to recalculate category usage counts', 'error');
    }
}
