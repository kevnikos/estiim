/**
 * routes/resourceTypes.js
 * * Defines API routes for the Resource Types resource.
 */
import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid';

/**
 * Creates and returns an Express router for resource type-related routes.
 * @param {Database} db - The initialized SQLite database instance.
 * @returns {Router} The configured Express router.
 */
export default function createResourceTypesRouter(db) {
    const router = express.Router();

    // GET /api/resource-types
    router.get('/', async (req, res) => {
        const rows = await db.all('SELECT * FROM resource_types');
        res.json(rows);
    });

    // POST /api/resource-types
    router.post('/',
        body('name').notEmpty().withMessage('Name is required'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { name, description } = req.body;
            const newId = uuid();
            await db.run('INSERT INTO resource_types (id, name, description) VALUES (?, ?, ?)', [newId, name, description]);
            const newRT = await db.get('SELECT * FROM resource_types WHERE id = ?', [newId]);
            res.status(201).json(newRT);
        }
    );

    // PUT /api/resource-types/:id
    router.put('/:id',
        body('name').notEmpty().withMessage('Name is required'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { id } = req.params;
            const { name, description } = req.body;
            await db.run('UPDATE resource_types SET name = ?, description = ? WHERE id = ?', [name, description, id]);
            const updatedRT = await db.get('SELECT * FROM resource_types WHERE id = ?', [id]);
            res.json(updatedRT);
        }
    );

    // DELETE /api/resource-types/:id
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        await db.run('DELETE FROM resource_types WHERE id = ?', [id]);
        res.status(204).send();
    });

    return router;
}
