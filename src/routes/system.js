/**
 * System information routes
 */
import express from 'express';

/**
 * Creates a router for system information operations.
 * @param {object} db - Database connection
 * @returns {express.Router} Express router
 */
export default function createSystemRouter(db) {
    const router = express.Router();

    // Get build information
    router.get('/build-info', async (req, res) => {
        try {
            // Get latest build info
            const buildInfo = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM build_info ORDER BY created_at DESC LIMIT 1',
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            // Get system settings that might be relevant
            const systemSettings = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT key, value FROM system_settings',
                    (err, rows) => {
                        if (err) reject(err);
                        else {
                            const settings = {};
                            rows.forEach(row => {
                                settings[row.key] = row.value;
                            });
                            resolve(settings);
                        }
                    }
                );
            });

            res.json({
                buildInfo: buildInfo || { build_number: 'Unknown', created_at: null },
                systemSettings,
                serverInfo: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    uptime: process.uptime()
                }
            });
        } catch (error) {
            console.error('Error fetching system info:', error);
            res.status(500).json({ error: 'Failed to fetch system information' });
        }
    });

    return router;
}
