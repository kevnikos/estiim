/**
 * About page functionality
 */

// Initialize the About page with static build information
window.initAboutPage = function() {
    const buildInfoHtml = `
        <div style="background: var(--background); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
            <p><strong>Version:</strong> R20250825000000</p>
            <p><strong>Built:</strong> August 25, 2025</p>
            <p><strong>Platform:</strong> Node.js + SQLite</p>
            <p><strong>Architecture:</strong> ES6 Modules + RESTful API</p>
        </div>
    `;

    // Find and update the build information section
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
        const buildInfoContainer = aboutSection.querySelector('div > div:first-child > div');
        if (buildInfoContainer) {
            buildInfoContainer.innerHTML = buildInfoHtml;
        }
    }
};
