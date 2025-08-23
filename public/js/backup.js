/**
 * Handles the backup settings page functionality
 */

let currentFrequency = null;

// Format file size in a human-readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format the timestamp in a readable format
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString();
}

// Fetch and display the backup list
async function refreshBackupList() {
    try {
        const response = await fetch('/api/backup/list');
        if (!response.ok) throw new Error('Failed to fetch backups');
        const backups = await response.json();

        const listElement = document.getElementById('backupsList');
        listElement.innerHTML = '';

        backups.forEach(backup => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${backup.filename}</td>
                <td>${formatTimestamp(backup.timestamp)}</td>
                <td>${formatFileSize(backup.size)}</td>
                <td>
                    <button class="restore-button" data-filename="${backup.filename}">
                        Restore
                    </button>
                </td>
            `;
            listElement.appendChild(row);
        });

        // Add click handlers for restore buttons
        document.querySelectorAll('.restore-button').forEach(button => {
            button.addEventListener('click', handleRestore);
        });
    } catch (error) {
        console.error('Error fetching backups:', error);
        alert('Failed to load backups list');
    }
}

// Handle backup restoration
async function handleRestore(event) {
    const filename = event.target.dataset.filename;
    if (!confirm(`Are you sure you want to restore the database from backup: ${filename}?\n\nThis will replace your current database with the backup version.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/backup/restore/${filename}`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to restore backup');
        alert('Database restored successfully. The page will now reload.');
        window.location.reload();
    } catch (error) {
        console.error('Error restoring backup:', error);
        alert('Failed to restore backup');
    }
}

// Create a manual backup
async function createManualBackup() {
    try {
        const response = await fetch('/api/backup/create', {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to create backup');
        alert('Backup created successfully');
        refreshBackupList();
    } catch (error) {
        console.error('Error creating backup:', error);
        alert('Failed to create backup');
    }
}

// Update backup frequency
async function updateBackupFrequency(frequency) {
    try {
        const response = await fetch('/api/backup/frequency', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ frequency: parseInt(frequency, 10) })
        });

        if (!response.ok) throw new Error('Failed to update backup frequency');
        currentFrequency = frequency;
        document.getElementById('currentFrequency').textContent = `${frequency} minutes`;
    } catch (error) {
        console.error('Error updating backup frequency:', error);
        alert('Failed to update backup frequency');
        // Reset the input to the current frequency
        document.getElementById('backupFrequency').value = currentFrequency;
    }
}

// Initialize the backup settings page
async function initBackupSettings() {
    try {
        // Fetch current backup frequency
        const response = await fetch('/api/backup/frequency');
        if (!response.ok) throw new Error('Failed to fetch backup frequency');
        const data = await response.json();
        currentFrequency = data.frequency;
        
        document.getElementById('backupFrequency').value = currentFrequency;
        document.getElementById('currentFrequency').textContent = `${currentFrequency} minutes`;

        // Add event listeners
        document.getElementById('updateFrequency').addEventListener('click', () => {
            const frequency = document.getElementById('backupFrequency').value;
            updateBackupFrequency(frequency);
        });

        document.getElementById('createBackup').addEventListener('click', createManualBackup);

        // Load initial backup list
        refreshBackupList();
    } catch (error) {
        console.error('Error initializing backup settings:', error);
        alert('Failed to initialize backup settings');
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initBackupSettings);
