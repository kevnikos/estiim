/**
 * routes/estimationFactors.js
 * * Defines API routes for the Estimation Factors resource.
 */
import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid';
import { areHoursPerResourceTypeEqual } from '../utils.js';

/**
 * Creates and returns an Express router for estimation factor-related routes.
 * @param {Database} db - The initialized SQLite database instance.
 * @returns {Router} The configured Express router.
 */
export default function createEstimationFactorsRouter(db) {
    const router = express.Router();

    // Helper to parse JSON fields from a database row
    const parseFactorRow = (row) => {
        if (!row) return null;
        row.hoursPerResourceType = JSON.parse(row.hours_per_resource_type || '{}');
        row.journal_entries = JSON.parse(row.journal_entries || '[]');
        row.journal_entries.forEach(entry => {
            if (entry.type === 'audit') {
                try {
                    if (typeof entry.old_data === 'string') entry.old_data = JSON.parse(entry.old_data);
                    if (typeof entry.new_data === 'string') entry.new_data = JSON.parse(entry.new_data);
                } catch (e) {
                    console.error("Error parsing audit data in EF journal entry:", e);
                    entry.old_data = {};
                    entry.new_data = {};
                }
            }
        });
        delete row.hours_per_resource_type;
        return row;
    };

    // GET /api/estimation-factors
    router.get('/', async (req, res) => {
        const rows = await db.all('SELECT * FROM estimation_factors');
        res.json(rows.map(parseFactorRow));
    });

    // GET /api/estimation-factors/:id/audit
    router.get('/:id/audit', async (req, res) => {
        const { id } = req.params;
        const row = await db.get('SELECT journal_entries FROM estimation_factors WHERE id = ?', [id]);
        if (!row) {
            return res.status(404).json({ message: 'Estimation Factor not found' });
        }
        const factor = parseFactorRow({ journal_entries: row.journal_entries, hours_per_resource_type: '{}' });
        res.json(factor.journal_entries);
    });

    // POST /api/estimation-factors
    router.post('/',
        body('name').notEmpty().withMessage('Name is required'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const now = new Date().toISOString();
            const { name, description, hoursPerResourceType, journal_entries } = req.body;

            const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || []));
            const newDataForAudit = { name, description, hoursPerResourceType: hoursPerResourceType || {} };
            const auditEntry = {
                timestamp: now, type: 'audit', action: 'created',
                old_data: JSON.stringify({}),
                new_data: JSON.stringify(newDataForAudit)
            };
            newJournalEntries.push(auditEntry);

            const newId = uuid();
            await db.run(
                'INSERT INTO estimation_factors (id, name, description, hours_per_resource_type, journal_entries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [newId, name, description, JSON.stringify(hoursPerResourceType || {}), JSON.stringify(newJournalEntries), now, now]
            );
            const newEF = await db.get('SELECT * FROM estimation_factors WHERE id = ?', [newId]);
            res.status(201).json(parseFactorRow(newEF));
        }
    );

    // PUT /api/estimation-factors/:id
    router.put('/:id',
        body('name').notEmpty().withMessage('Name is required'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { id } = req.params;
            const now = new Date().toISOString();
            const { name, description, hoursPerResourceType, journal_entries } = req.body;

            const oldFactor = await db.get('SELECT * FROM estimation_factors WHERE id = ?', [id]);
            if (!oldFactor) {
                return res.status(404).json({ message: 'Estimation Factor not found' });
            }

            const updateFields = {
                name, description,
                hours_per_resource_type: JSON.stringify(hoursPerResourceType || {}),
                journal_entries: JSON.stringify(journal_entries || []),
                updated_at: now
            };
            const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(updateFields), id];
            await db.run(`UPDATE estimation_factors SET ${setClause} WHERE id = ?`, values);

            const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || []));
            const oldDataForAudit = {
                name: oldFactor.name,
                description: oldFactor.description,
                hoursPerResourceType: JSON.parse(oldFactor.hours_per_resource_type || '{}'),
            };
            const newDataForAudit = { name, description, hoursPerResourceType: hoursPerResourceType || {} };

            if (oldDataForAudit.name !== newDataForAudit.name || 
                oldDataForAudit.description !== newDataForAudit.description ||
                !areHoursPerResourceTypeEqual(oldDataForAudit.hoursPerResourceType, newDataForAudit.hoursPerResourceType)) {
                
                const auditEntry = {
                    timestamp: now, type: 'audit', action: 'updated',
                    old_data: JSON.stringify(oldDataForAudit),
                    new_data: JSON.stringify(newDataForAudit)
                };
                newJournalEntries.push(auditEntry);
                await db.run('UPDATE estimation_factors SET journal_entries = ? WHERE id = ?', [JSON.stringify(newJournalEntries), id]);
            }
            
            const updatedEF = await db.get('SELECT * FROM estimation_factors WHERE id = ?', [id]);
            res.json(parseFactorRow(updatedEF));
        }
    );

    // DELETE /api/estimation-factors/:id
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        await db.run('DELETE FROM estimation_factors WHERE id = ?', [id]);
        res.status(204).send();
    });

    return router;
}
