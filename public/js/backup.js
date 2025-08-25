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

// Fetch and display the backup list with date grouping
async function refreshBackupList() {
    try {
        const response = await fetch('/api/backup/list');
        if (!response.ok) throw new Error('Failed to fetch backups');
        const backups = await response.json();

        const listElement = document.getElementById('backupsList');
        listElement.innerHTML = '';

        if (backups.length === 0) {
            listElement.innerHTML = '<p>No backups available.</p>';
            return;
        }

        // Group backups by year, month, and day
        const groupedBackups = groupBackupsByDate(backups);
        
        // Render grouped backups
        Object.keys(groupedBackups).sort().reverse().forEach(year => {
            const yearDiv = document.createElement('div');
            yearDiv.className = 'backup-year-group';
            
            const yearHeader = document.createElement('h3');
            yearHeader.textContent = year;
            yearHeader.className = 'backup-year-header collapsed';
            yearDiv.appendChild(yearHeader);
            
            const yearContent = document.createElement('div');
            yearContent.className = 'backup-year-content collapsed';
            yearContent.style.maxHeight = '0px';
            
            Object.keys(groupedBackups[year]).sort().reverse().forEach(month => {
                const monthDiv = document.createElement('div');
                monthDiv.className = 'backup-month-group';
                
                const monthHeader = document.createElement('h4');
                monthHeader.textContent = getMonthName(parseInt(month));
                monthHeader.className = 'backup-month-header collapsed';
                monthDiv.appendChild(monthHeader);
                
                const monthContent = document.createElement('div');
                monthContent.className = 'backup-month-content collapsed';
                monthContent.style.maxHeight = '0px';
                
                Object.keys(groupedBackups[year][month]).sort().reverse().forEach(day => {
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'backup-day-group';
                    
                    const dayHeader = document.createElement('h5');
                    dayHeader.textContent = `Day ${day}`;
                    dayHeader.className = 'backup-day-header collapsed';
                    dayDiv.appendChild(dayHeader);
                    
                    const dayContent = document.createElement('div');
                    dayContent.className = 'backup-day-content collapsed';
                    dayContent.style.maxHeight = '0px';
                    
                    const table = document.createElement('table');
                    table.className = 'backup-table';
                    table.innerHTML = `
                        <thead>
                            <tr>
                                <th>Backup File</th>
                                <th>Created</th>
                                <th>Size</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    `;
                    
                    const tbody = table.querySelector('tbody');
                    groupedBackups[year][month][day].backups.forEach(backup => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${backup.filename}</td>
                            <td>${formatTimestamp(backup.timestamp)}</td>
                            <td>${formatFileSize(backup.size)}</td>
                            <td>
                                <button class="restore-button" data-filename="${backup.filename}">
                                    Restore
                                </button>
                                <button class="delete-button" data-filename="${backup.filename}" style="background: var(--red); margin-left: 8px;">
                                    Delete
                                </button>
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                    
                    dayContent.appendChild(table);
                    dayDiv.appendChild(dayContent);
                    monthContent.appendChild(dayDiv);
                });
                
                monthDiv.appendChild(monthContent);
                yearContent.appendChild(monthDiv);
            });
            
            yearDiv.appendChild(yearContent);
            listElement.appendChild(yearDiv);
        });

        // Add click handlers for buttons
        document.querySelectorAll('.restore-button').forEach(button => {
            button.addEventListener('click', handleRestore);
        });
        
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', handleDelete);
        });
        
        // Add click handlers for collapsible sections
        document.querySelectorAll('.backup-year-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const isCollapsed = header.classList.toggle('collapsed');
                content.classList.toggle('collapsed', isCollapsed);
                content.style.maxHeight = isCollapsed ? '0px' : 'none';
            });
        });
        
        document.querySelectorAll('.backup-month-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const isCollapsed = header.classList.toggle('collapsed');
                content.classList.toggle('collapsed', isCollapsed);
                content.style.maxHeight = isCollapsed ? '0px' : 'none';
            });
        });
        
        document.querySelectorAll('.backup-day-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const isCollapsed = header.classList.toggle('collapsed');
                content.classList.toggle('collapsed', isCollapsed);
                content.style.maxHeight = isCollapsed ? '0px' : 'none';
            });
        });
    } catch (error) {
        console.error('Error fetching backups:', error);
        alert('Failed to load backups list');
    }
}

// Group backups by year, month, and day
function groupBackupsByDate(backups) {
    const grouped = {};
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentDay = now.getDate().toString().padStart(2, '0');
    
    backups.forEach(backup => {
        const date = new Date(backup.timestamp);
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = {};
        if (!grouped[year][month][day]) {
            grouped[year][month][day] = {
                backups: [],
                isToday: year === currentYear && month === currentMonth && day === currentDay
            };
        }
        
        grouped[year][month][day].backups.push(backup);
    });
    
    // Sort backups within each day by time (newest first)
    Object.keys(grouped).forEach(year => {
        Object.keys(grouped[year]).forEach(month => {
            Object.keys(grouped[year][month]).forEach(day => {
                grouped[year][month][day].backups.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
            });
        });
    });
    
    return grouped;
}

// Get month name from month number
function getMonthName(monthNum) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNum - 1];
}

// Handle backup deletion
async function handleDelete(event) {
    const filename = event.target.dataset.filename;
    if (!confirm(`Are you sure you want to delete the backup: ${filename}?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/backup/delete/${filename}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete backup');
        alert('Backup deleted successfully');
        refreshBackupList();
    } catch (error) {
        console.error('Error deleting backup:', error);
        alert('Failed to delete backup');
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
