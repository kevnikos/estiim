/**
 * routes/shirtSizes.js
 * * Defines API routes for the Shirt Sizes resource.
 */
import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid';

/**
 * Creates and returns an Express router for shirt size-related routes.
 * @param {Database} db - The initialized SQLite database instance.
 * @returns {Router} The configured Express router.
 */
export default function createShirtSizesRouter(db) {
    const router = express.Router();

    // GET /api/shirt-sizes
    router.get('/', async (req, res) => {
        const rows = await db.all('SELECT * FROM shirt_sizes ORDER BY threshold_hours');
        res.json(rows);
    });

    // GET /api/shirt-sizes/audit
    router.get('/audit', async (req, res) => {
        const rows = await db.all('SELECT * FROM shirt_size_audit ORDER BY timestamp DESC');
        res.json(rows);
    });

    // PUT /api/shirt-sizes
    router.put('/',
        body().isArray().withMessage('Request body must be an array of shirt sizes.'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const now = new Date().toISOString();
            const newSizes = req.body;
            const oldSizes = await db.all('SELECT * FROM shirt_sizes');

            // Use a transaction to ensure all updates succeed or none do
            try {
                await db.run('BEGIN TRANSACTION');
                for (const size of newSizes) {
                    await db.run('UPDATE shirt_sizes SET threshold_hours=? WHERE size=?', [size.threshold_hours, size.size]);
                }
                await db.run(
                    `INSERT INTO shirt_size_audit (id, action, old_data, new_data, timestamp) VALUES (?, ?, ?, ?, ?)`,
                    [uuid(), 'updated', JSON.stringify(oldSizes), JSON.stringify(newSizes), now]
                );
                await db.run('COMMIT');
            } catch (err) {
                await db.run('ROLLBACK');
                console.error("Error updating shirt sizes:", err);
                return res.status(500).json({ message: "Failed to update shirt sizes." });
            }

            const updatedSizes = await db.all('SELECT * FROM shirt_sizes ORDER BY threshold_hours');
            res.json(updatedSizes);
        }
    );

    return router;
}
