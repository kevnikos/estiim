/**
 * routes/initiatives.js
 * * Defines API routes for the Initiatives resource.
 */
import express from 'express';
import { body, validationResult } from 'express-validator';
import { getShirtSize } from '../utils.js';

/**
 * Creates and returns an Express router f            selected_factors: JSON.stringify(selected_factors || []),
            computed_hours: newComputedHours,
            shirt_size: newShirtSize,
            start_date: start_date || null,
            end_date: end_date || null,
            estimated_duration: estimated_duration || null,
            categories: JSON.stringify(categories || [])tiative-related routes.
 * @param {Database} db - The initialized SQLite database instance.
 * @returns {Router} The configured Express router.
 */
export default function createInitiativesRouter(db) {
  const router = express.Router();

  // Helper to parse JSON fields from a database row
  const parseInitiativeRow = (row) => {
    if (!row) return null;
    row.selected_factors = JSON.parse(row.selected_factors || '[]');
    row.manual_resources = JSON.parse(row.manual_resources || '{}');
    row.journal_entries = JSON.parse(row.journal_entries || '[]');
    row.journal_entries.forEach(entry => {
      if (entry.type === 'audit') {
        try {
          if (typeof entry.old_data === 'string') entry.old_data = JSON.parse(entry.old_data);
          if (typeof entry.new_data === 'string') entry.new_data = JSON.parse(entry.new_data);
        } catch (e) {
          console.error("Error parsing audit data in journal entry:", e);
          entry.old_data = {};
          entry.new_data = {};
        }
      }
    });
    return row;
  };

  // GET /api/initiatives
  router.get('/', async (req, res) => {
    const { status } = req.query; // Get status from query parameters
    let query = 'SELECT * FROM initiatives';
    let params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    const rows = await db.all(query, params);
    res.json(rows.map(parseInitiativeRow));
  });

  // POST /api/initiatives/import - Handles bulk import from TSV
  router.post('/import', async (req, res) => {
    const initiativesToImport = req.body;
    if (!Array.isArray(initiativesToImport)) {
      return res.status(400).json({ message: 'Request body must be an array of initiatives.' });
    }

    let importedCount = 0;
    const now = new Date().toISOString();

    try {
      await db.run('BEGIN TRANSACTION');
      for (const init of initiativesToImport) {
        if (!init.name) {
          console.warn('Skipping initiative in import due to missing name:', init);
          continue;
        }

        // Set defaults and calculate values for the new initiative
        const computedHours = 0; // No factors on import
        const shirtSize = await getShirtSize(db, computedHours);

        const journalEntry = {
            timestamp: now,
            type: 'audit',
            action: 'created',
            old_data: {},
            new_data: { name: init.name, status: init.status || 'To Do', note: 'Imported via TSV' }
        };

        await db.run(
          `INSERT INTO initiatives (name, custom_id, description, priority, priority_num, status, classification, scope, out_of_scope, selected_factors, computed_hours, shirt_size, journal_entries, start_date, end_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            init.name,
            init.custom_id || null,
            init.description || null,
            init.priority || 'Low',
            parseInt(init.priority_num, 10) || 0,
            init.status || 'To Do',
            'Imported',
            init.scope || null,
            init.out_of_scope || null,
            '[]',
            computedHours,
            shirtSize,
            JSON.stringify([journalEntry]),
            init.start_date || null,
            init.end_date || null,
            now,
            now
          ]
        );
        importedCount++;
      }
      await db.run('COMMIT');
      res.status(201).json({ importedCount });
    } catch (error) {
      await db.run('ROLLBACK');
      console.error('Import failed:', error);
      res.status(500).json({ message: 'Failed to import initiatives due to a server error.' });
    }
  });


  // GET /api/initiatives/:id
  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const row = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ message: 'Initiative not found' });
    }
    res.json(parseInitiativeRow(row));
  });
  
  // GET /api/initiatives/:id/audit
  router.get('/:id/audit', async (req, res) => {
    const { id } = req.params;
    const row = await db.get('SELECT journal_entries FROM initiatives WHERE id = ?', [id]);
    if (!row) {
        return res.status(404).json({ message: 'Initiative not found' });
    }
    const initiative = parseInitiativeRow({ journal_entries: row.journal_entries });
    res.json(initiative.journal_entries);
  });


  // POST /api/initiatives
  router.post('/',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const now = new Date().toISOString();
      const {
        name, custom_id, description, priority, priority_num, status, estimation_type,
        classification, scope, out_of_scope, selected_factors, manual_resources, journal_entries,
        start_date, end_date, estimated_duration
      } = req.body;

      let computedHours = 0;
      if (selected_factors && Array.isArray(selected_factors)) {
        for (const factor of selected_factors) {
          if (factor.hoursPerResourceType) {
            const totalFactorHours = Object.values(factor.hoursPerResourceType).reduce((sum, h) => sum + h, 0);
            computedHours += totalFactorHours * (factor.quantity || 1);
          }
        }
      }
      
      // Add manual resource hours to computed hours
      if (manual_resources && manual_resources.manualHours) {
        const manualHoursTotal = Object.values(manual_resources.manualHours).reduce((sum, h) => sum + h, 0);
        computedHours += manualHoursTotal;
      }
      
      computedHours = parseFloat(computedHours.toFixed(1));
      const shirtSize = await getShirtSize(db, computedHours);

      const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || []));
      const newDataForAudit = {
        name, custom_id, description, priority, priority_num, status, estimation_type,
        classification, scope, out_of_scope,
        selected_factors: JSON.stringify(selected_factors || []),
        computed_hours: computedHours.toFixed(1),
        shirt_size: shirtSize,
        start_date: start_date || null,
        end_date: end_date || null,
        estimated_duration: estimated_duration || null
      };

      const auditEntry = {
        timestamp: now, type: 'audit', action: 'created',
        old_data: JSON.stringify({}),
        new_data: JSON.stringify(newDataForAudit)
      };
      newJournalEntries.push(auditEntry);

      const result = await db.run(
        `INSERT INTO initiatives (name, custom_id, description, priority, priority_num, status, estimation_type, classification, scope, out_of_scope, selected_factors, manual_resources, computed_hours, shirt_size, journal_entries, start_date, end_date, estimated_duration, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name, custom_id, description, priority, priority_num, status, estimation_type,
          classification, scope, out_of_scope,
          JSON.stringify(selected_factors || []),
          JSON.stringify(manual_resources || {}),
          computedHours, shirtSize, JSON.stringify(newJournalEntries),
          start_date, end_date, estimated_duration, now, now
        ]
      );
      const newInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [result.lastID]);
      res.status(201).json(parseInitiativeRow(newInitiative));
    }
  );

  // PUT /api/initiatives/:id
  router.put('/:id',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const now = new Date().toISOString();
        const {
            name, custom_id, description, priority, priority_num, status, estimation_type,
            classification, scope, out_of_scope, selected_factors, manual_resources, journal_entries,
            start_date, end_date, estimated_duration, categories
        } = req.body;

        const oldInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
        if (!oldInitiative) {
            return res.status(404).json({ message: 'Initiative not found' });
        }

        let newComputedHours = 0;
        if (selected_factors && Array.isArray(selected_factors)) {
            for (const factor of selected_factors) {
                if (factor.hoursPerResourceType) {
                    const totalFactorHours = Object.values(factor.hoursPerResourceType).reduce((sum, h) => sum + h, 0);
                    newComputedHours += totalFactorHours * (factor.quantity || 1);
                }
            }
        }
        
        // Add manual resource hours to computed hours
        if (manual_resources && manual_resources.manualHours) {
            const manualHoursTotal = Object.values(manual_resources.manualHours).reduce((sum, h) => sum + h, 0);
            newComputedHours += manualHoursTotal;
        }
        
        newComputedHours = parseFloat(newComputedHours.toFixed(1));
        const newShirtSize = await getShirtSize(db, newComputedHours);

        // Add debug logging
        console.log('Old Initiative from DB:', oldInitiative);
        console.log('New data from request:', req.body);

        // Parse old categories
        let oldCategories = [];
        try {
            oldCategories = typeof oldInitiative.categories === 'string' ? 
                          JSON.parse(oldInitiative.categories || '[]') : 
                          (oldInitiative.categories || []);
        } catch (e) {
            console.error('Error parsing old categories:', e);
        }

        // Parse new categories
        let newCategories = [];
        try {
            newCategories = typeof categories === 'string' ? 
                          JSON.parse(categories || '[]') : 
                          (categories || []);
        } catch (e) {
            console.error('Error parsing new categories:', e);
        }

        const updateFields = {
            name, custom_id, description, priority, priority_num, status, estimation_type,
            classification, scope, out_of_scope,
            selected_factors: JSON.stringify(selected_factors || []),
            manual_resources: JSON.stringify(manual_resources || {}),
            journal_entries: JSON.stringify(journal_entries || []),
            computed_hours: newComputedHours,
            shirt_size: newShirtSize,
            start_date: start_date || null,
            end_date: end_date || null,
            estimated_duration: estimated_duration || null,
            categories: JSON.stringify(newCategories),
            updated_at: now
        };

        const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updateFields), id];
        await db.run(`UPDATE initiatives SET ${setClause} WHERE id = ?`, values);

        const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || []));

        // Prepare audit data
        const oldDataForAudit = {
            name: oldInitiative.name, 
            custom_id: oldInitiative.custom_id, 
            description: oldInitiative.description, 
            priority: oldInitiative.priority, 
            priority_num: oldInitiative.priority_num, 
            status: oldInitiative.status,
            estimation_type: oldInitiative.estimation_type,
            classification: oldInitiative.classification, 
            scope: oldInitiative.scope, 
            out_of_scope: oldInitiative.out_of_scope,
            selected_factors: oldInitiative.selected_factors || '[]',
            computed_hours: parseFloat(oldInitiative.computed_hours || 0).toFixed(1),
            shirt_size: oldInitiative.shirt_size,
            start_date: oldInitiative.start_date || null,
            end_date: oldInitiative.end_date || null,
            estimated_duration: oldInitiative.estimated_duration !== null ? oldInitiative.estimated_duration : null,
            categories: JSON.stringify(oldCategories)
        };

        const newDataForAudit = {
            name, 
            custom_id, 
            description, 
            priority, 
            priority_num, 
            status, 
            estimation_type,
            classification, 
            scope, 
            out_of_scope,
            selected_factors: JSON.stringify(selected_factors || []),
            computed_hours: newComputedHours.toFixed(1),
            shirt_size: newShirtSize,
            start_date: start_date || null,
            end_date: end_date || null,
            estimated_duration: estimated_duration || null,
            categories: JSON.stringify(newCategories)
        };

        console.log('Old data for audit:', oldDataForAudit);
        console.log('New data for audit:', newDataForAudit);
        
        if (JSON.stringify(oldDataForAudit) !== JSON.stringify(newDataForAudit)) {
            const auditEntry = {
                timestamp: now, type: 'audit', action: 'updated',
                old_data: JSON.stringify(oldDataForAudit),
                new_data: JSON.stringify(newDataForAudit)
            };
            newJournalEntries.push(auditEntry);
            await db.run('UPDATE initiatives SET journal_entries = ? WHERE id = ?', [JSON.stringify(newJournalEntries), id]);
        }
        
        const updatedInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
        res.json(parseInitiativeRow(updatedInitiative));
    }
  );

  // DELETE /api/initiatives/:id
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM initiatives WHERE id = ?', [id]);
    res.status(204).send();
  });

  return router;
}
