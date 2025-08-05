/**
 * public/js/api.js
 * * Handles all fetch requests to the backend API.
 */

const API_BASE_URL = ''; // Adjust if your API is hosted elsewhere

/**
 * A helper function to handle fetch requests and JSON parsing.
 * @param {string} url - The URL to fetch.
 * @param {object} [options={}] - The options for the fetch request.
 * @returns {Promise<any>} The JSON response from the API.
 */
async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(API_BASE_URL + url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        if (response.status === 204) { // No Content
            return null;
        }
        return response.json();
    } catch (error) {
        console.error('API call failed:', error);
        // In a real app, you might want to show an error message to the user here.
        throw error; // Re-throw the error to be handled by the caller
    }
}

// --- Initiatives API ---
export const getInitiatives = () => fetchAPI('/api/initiatives');
export const saveInitiative = (initiative) => {
    const { id, ...data } = initiative;
    const url = id ? `/api/initiatives/${id}` : '/api/initiatives';
    const method = id ? 'PUT' : 'POST';
    return fetchAPI(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
};
export const deleteInitiative = (id) => fetchAPI(`/api/initiatives/${id}`, { method: 'DELETE' });
export const importInitiatives = (initiatives) => fetchAPI('/api/initiatives/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initiatives),
});


// --- Resource Types API ---
export const getResourceTypes = () => fetchAPI('/api/resource-types');
export const saveResourceType = (resourceType) => {
    const { id, ...data } = resourceType;
    const url = id ? `/api/resource-types/${id}` : '/api/resource-types';
    const method = id ? 'PUT' : 'POST';
    return fetchAPI(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
};
export const deleteResourceType = (id) => fetchAPI(`/api/resource-types/${id}`, { method: 'DELETE' });

// --- Estimation Factors API ---
export const getEstimationFactors = () => fetchAPI('/api/estimation-factors');
export const saveEstimationFactor = (factor) => {
    const { id, ...data } = factor;
    const url = id ? `/api/estimation-factors/${id}` : '/api/estimation-factors';
    const method = id ? 'PUT' : 'POST';
    return fetchAPI(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
};
export const deleteEstimationFactor = (id) => fetchAPI(`/api/estimation-factors/${id}`, { method: 'DELETE' });
export const getFactorAuditTrail = (id) => fetchAPI(`/api/estimation-factors/${id}/audit`);


// --- Shirt Sizes API ---
export const getShirtSizes = () => fetchAPI('/api/shirt-sizes');
export const saveShirtSizes = (sizes) => fetchAPI('/api/shirt-sizes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sizes),
});
export const getShirtSizeAuditTrail = () => fetchAPI('/api/shirt-sizes/audit');
