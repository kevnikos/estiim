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
        body('resource_category').isIn(['Labour', 'Non-Labour']).withMessage('Resource category must be Labour or Non-Labour'),
        body('resource_cost').optional().isFloat({ min: 0 }).withMessage('Resource cost must be a positive number'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { name, description, resource_category, resource_cost } = req.body;
            const newId = uuid();
            await db.run(
                'INSERT INTO resource_types (id, name, description, resource_category, resource_cost) VALUES (?, ?, ?, ?, ?)', 
                [newId, name, description, resource_category || 'Labour', resource_cost || null]
            );
            const newRT = await db.get('SELECT * FROM resource_types WHERE id = ?', [newId]);
            res.status(201).json(newRT);
        }
    );

    // PUT /api/resource-types/:id
    router.put('/:id',
        body('name').notEmpty().withMessage('Name is required'),
        body('resource_category').isIn(['Labour', 'Non-Labour']).withMessage('Resource category must be Labour or Non-Labour'),
        body('resource_cost').optional().isFloat({ min: 0 }).withMessage('Resource cost must be a positive number'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { id } = req.params;
            const { name, description, resource_category, resource_cost } = req.body;
            await db.run(
                'UPDATE resource_types SET name = ?, description = ?, resource_category = ?, resource_cost = ? WHERE id = ?', 
                [name, description, resource_category, resource_cost, id]
            );
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
