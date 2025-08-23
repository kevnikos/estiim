/**
 * Handles backup-related routes
 */
import express from 'express';
import { backupDatabase, listBackups, restoreDatabase } from '../utils.js';

/**
 * Creates a router for backup operations.
 * @param {object} db - Database connection
 * @param {function} updateBackupInterval - Function to update the backup interval
 * @returns {express.Router} Express router
 */
export default function createBackupRouter(db, updateBackupInterval) {
    const router = express.Router();

    // Get current backup frequency
    router.get('/frequency', async (req, res) => {
        try {
            const result = await db.get(
                'SELECT value FROM system_settings WHERE key = ?',
                ['backup_frequency_minutes']
            );
            res.json({ frequency: parseInt(result.value, 10) });
        } catch (err) {
            console.error('Error getting backup frequency:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Update backup frequency
    router.put('/frequency', async (req, res) => {
        try {
            const { frequency } = req.body;
            if (!frequency || typeof frequency !== 'number' || frequency < 5 || frequency > 1440) {
                return res.status(400).json({ 
                    error: 'Invalid frequency. Must be between 5 and 1440 minutes.' 
                });
            }

            // Update the database
            await db.run(
                `UPDATE system_settings 
                 SET value = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE key = ?`,
                [frequency.toString(), 'backup_frequency_minutes']
            );

            // Update the backup interval
            updateBackupInterval(frequency);
            res.json({ message: 'Backup frequency updated successfully' });
        } catch (err) {
            console.error('Error updating backup frequency:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Get list of backups
    router.get('/list', async (req, res) => {
        try {
            const backups = await listBackups();
            res.json(backups);
        } catch (err) {
            console.error('Error listing backups:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Create a manual backup
    router.post('/create', async (req, res) => {
        try {
            const backupFile = await backupDatabase();
            res.json({ 
                message: 'Backup created successfully',
                backup: backupFile
            });
        } catch (err) {
            console.error('Error creating backup:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Restore from a backup
    router.post('/restore/:filename', async (req, res) => {
        try {
            const { filename } = req.params;
            await restoreDatabase(filename);
            res.json({ message: 'Database restored successfully' });
        } catch (err) {
            console.error('Error restoring backup:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
