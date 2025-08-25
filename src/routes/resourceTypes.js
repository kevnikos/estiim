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
            const now = new Date().toISOString();
            
            // Create audit entry for creation
            const newDataForAudit = {
                name,
                description: description || '',
                resource_category: resource_category || 'Labour',
                resource_cost: resource_cost || null
            };
            
            // Check if journal_entries column exists
            const tableInfo = await db.all(`PRAGMA table_info(resource_types)`);
            const hasJournalEntries = tableInfo.some(col => col.name === 'journal_entries');
            
            if (hasJournalEntries) {
                const auditEntry = {
                    timestamp: now,
                    type: 'audit',
                    action: 'created',
                    old_data: JSON.stringify({}),
                    new_data: JSON.stringify(newDataForAudit)
                };
                
                const journalEntries = [auditEntry];
                
                await db.run(
                    'INSERT INTO resource_types (id, name, description, resource_category, resource_cost, journal_entries) VALUES (?, ?, ?, ?, ?, ?)', 
                    [newId, name, description, resource_category || 'Labour', resource_cost || null, JSON.stringify(journalEntries)]
                );
            } else {
                // Journal entries column doesn't exist yet, insert without it
                await db.run(
                    'INSERT INTO resource_types (id, name, description, resource_category, resource_cost) VALUES (?, ?, ?, ?, ?)', 
                    [newId, name, description, resource_category || 'Labour', resource_cost || null]
                );
            }
            
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
            const now = new Date().toISOString();
            
            // Get existing resource type for audit comparison
            const existingRT = await db.get('SELECT * FROM resource_types WHERE id = ?', [id]);
            if (!existingRT) {
                return res.status(404).json({ message: 'Resource type not found' });
            }
            
            // Prepare audit data
            const oldDataForAudit = {
                name: existingRT.name,
                description: existingRT.description || '',
                resource_category: existingRT.resource_category || 'Labour',
                resource_cost: existingRT.resource_cost || null
            };
            
            const newDataForAudit = {
                name,
                description: description || '',
                resource_category,
                resource_cost
            };
            
            // Check if there are actual changes
            if (JSON.stringify(oldDataForAudit) !== JSON.stringify(newDataForAudit)) {
                // Check if journal_entries column exists
                const tableInfo = await db.all(`PRAGMA table_info(resource_types)`);
                const hasJournalEntries = tableInfo.some(col => col.name === 'journal_entries');
                
                if (hasJournalEntries) {
                    const auditEntry = {
                        timestamp: now,
                        type: 'audit',
                        action: 'updated',
                        old_data: JSON.stringify(oldDataForAudit),
                        new_data: JSON.stringify(newDataForAudit)
                    };
                    
                    // Get existing journal entries
                    let journalEntries = [];
                    if (existingRT.journal_entries) {
                        try {
                            journalEntries = JSON.parse(existingRT.journal_entries);
                        } catch (e) {
                            console.error("Error parsing existing journal entries:", e);
                            journalEntries = [];
                        }
                    }
                    
                    journalEntries.push(auditEntry);
                    
                    await db.run(
                        'UPDATE resource_types SET name = ?, description = ?, resource_category = ?, resource_cost = ?, journal_entries = ? WHERE id = ?', 
                        [name, description, resource_category, resource_cost, JSON.stringify(journalEntries), id]
                    );
                } else {
                    // Journal entries column doesn't exist yet, update without it
                    await db.run(
                        'UPDATE resource_types SET name = ?, description = ?, resource_category = ?, resource_cost = ? WHERE id = ?', 
                        [name, description, resource_category, resource_cost, id]
                    );
                }
            } else {
                // No changes, just update without audit entry
                await db.run(
                    'UPDATE resource_types SET name = ?, description = ?, resource_category = ?, resource_cost = ? WHERE id = ?', 
                    [name, description, resource_category, resource_cost, id]
                );
            }
            
            const updatedRT = await db.get('SELECT * FROM resource_types WHERE id = ?', [id]);
            res.json(updatedRT);
        }
    );

    // GET /api/resource-types/:id/audit
    router.get('/:id/audit', async (req, res) => {
        const { id } = req.params;
        
        // Check if journal_entries column exists
        const tableInfo = await db.all(`PRAGMA table_info(resource_types)`);
        const hasJournalEntries = tableInfo.some(col => col.name === 'journal_entries');
        
        if (!hasJournalEntries) {
            // Column doesn't exist yet, return empty audit trail
            return res.json([]);
        }
        
        const row = await db.get('SELECT journal_entries FROM resource_types WHERE id = ?', [id]);
        if (!row) {
            return res.status(404).json({ message: 'Resource type not found' });
        }
        
        let journalEntries = [];
        if (row.journal_entries) {
            try {
                journalEntries = JSON.parse(row.journal_entries);
            } catch (e) {
                console.error("Error parsing journal entries for resource type:", e);
                journalEntries = [];
            }
        }
        
        // Filter for audit entries only
        const auditEntries = journalEntries.filter(entry => entry.type === 'audit');
        res.json(auditEntries);
    });

    // DELETE /api/resource-types/:id
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        await db.run('DELETE FROM resource_types WHERE id = ?', [id]);
        res.status(204).send();
    });

    return router;
}
