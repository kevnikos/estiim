/**
 * Estiim API – Express 4.x + sqlite3 (with debug logging)
 * 2025-08-04 (schema-bootstrap fix, user-specified scaled sizes, TEXT type for hours, INTEGER PRIMARY KEY for initiative ID)
 */
import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid'; // Still needed for audit trail and other IDs
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// T-Shirt size calculation logic
async function getShirtSize(db, hours) {
  console.log('DEBUG: getShirtSize called with hours:', hours);
  // Order by threshold_hours ASC to easily find the correct size
  const sizes = await db.all('SELECT size, threshold_hours FROM shirt_sizes ORDER BY threshold_hours ASC');
  console.log('DEBUG: Shirt sizes from DB for calculation:', sizes);

  let determinedSize = 'XS'; // Default to XS if no other size is met

  for (const size of sizes) {
    console.log(`DEBUG: Checking hours (${hours}) against size ${size.size} threshold (${size.threshold_hours})`);
    if (hours >= size.threshold_hours) {
      determinedSize = size.size; // This size's threshold is met, so it's a candidate
    } else {
      // If current hours are less than the threshold, the previous size was the correct one.
      // This break ensures we pick the smallest size that fits the hours.
      break; 
    }
  }
  console.log('DEBUG: Determined size:', determinedSize);
  return determinedSize;
}

// Factor calculation logic
async function calculateFactors(db, selectedFactors) {
  let totalHours = 0;
  if (!selectedFactors || selectedFactors.length === 0) {
    return { totalHours: 0, shirtSize: await getShirtSize(db, 0) };
  }

  // Ensure selectedFactors is an array of objects, not a JSON string
  let parsedFactors = selectedFactors;
  if (typeof selectedFactors === 'string') {
    try {
      parsedFactors = JSON.parse(selectedFactors);
    } catch (e) {
      console.error("Error parsing selected_factors JSON:", e);
      parsedFactors = [];
    }
  }

  for (const sf of parsedFactors) {
    const factor = await db.get('SELECT hoursPerResourceType FROM estimation_factors WHERE id = ?', [sf.factorId]);
    if (factor && factor.hoursPerResourceType) {
      try {
        const hoursPerResourceType = JSON.parse(factor.hoursPerResourceType);
        const factorTotalHours = Object.values(hoursPerResourceType).reduce((sum, h) => sum + h, 0);
        totalHours += factorTotalHours * (sf.quantity || 1);
      } catch (e) {
        console.error("Error parsing hoursPerResourceType JSON for factor:", sf.factorId, e);
      }
    }
  }
  const shirtSize = await getShirtSize(db, totalHours);
  return { totalHours, shirtSize };
}


export async function createApp() {
  const db = await open({
    filename: './estiim.db',
    driver: sqlite3.Database
  });

  // Enable foreign key constraints
  await db.run('PRAGMA foreign_keys = ON;');

  // Schema bootstrap
  await db.exec(`
    CREATE TABLE IF NOT EXISTS initiatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      custom_id TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      priority TEXT,
      priority_num INTEGER,
      status TEXT,
      classification TEXT,
      scope TEXT,
      out_of_scope TEXT,
      selected_factors TEXT, -- Stored as JSON string
      journal_entries TEXT, -- Stored as JSON string
      computed_hours REAL DEFAULT 0,
      shirt_size TEXT DEFAULT 'XS',
      start_date TEXT, -- YYYY-MM-DD
      end_date TEXT, -- YYYY-MM-DD
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resource_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS estimation_factors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      hoursPerResourceType TEXT -- Stored as JSON string {resourceTypeId: hours}
    );

    CREATE TABLE IF NOT EXISTS shirt_sizes (
      size TEXT PRIMARY KEY,
      threshold_hours INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shirt_size_audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed initial shirt sizes if not present
  const existingShirtSizes = await db.all('SELECT * FROM shirt_sizes');
  if (existingShirtSizes.length === 0) {
    console.log('Seeding initial shirt sizes...');
    await db.run('INSERT OR IGNORE INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['XS', 0]);
    await db.run('INSERT OR IGNORE INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['S', 40]);
    await db.run('INSERT OR IGNORE INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['M', 120]);
    await db.run('INSERT OR IGNORE INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['L', 300]);
    await db.run('INSERT OR IGNORE INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['XL', 600]);
    await db.run('INSERT OR IGNORE INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['XXL', 1000]);
  }

  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR)); // Serve static files from public directory

  // Middleware for logging all API requests
  app.use((req, res, next) => {
    console.log(`API Request: ${req.method} ${req.url}`);
    next();
  });

  // Routes for Initiatives
  app.get('/api/initiatives', async (req, res) => {
    const initiatives = await db.all('SELECT * FROM initiatives');
    // Parse JSON fields before sending
    const parsedInitiatives = initiatives.map(init => ({
      ...init,
      selected_factors: init.selected_factors ? JSON.parse(init.selected_factors) : [],
      journal_entries: init.journal_entries ? JSON.parse(init.journal_entries) : []
    }));
    res.json(parsedInitiatives);
  });

  app.get('/api/initiatives/:id', async (req, res) => {
    const { id } = req.params;
    const initiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
    if (!initiative) {
      return res.status(404).json({ message: 'Initiative not found' });
    }
    // Parse JSON fields before sending
    initiative.selected_factors = initiative.selected_factors ? JSON.parse(initiative.selected_factors) : [];
    initiative.journal_entries = initiative.journal_entries ? JSON.parse(initiative.journal_entries) : [];
    res.json(initiative);
  });

  app.post('/api/initiatives',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        custom_id, name, description, priority, priority_num, status,
        classification, scope, out_of_scope, selected_factors, journal_entries,
        start_date, end_date
      } = req.body;
      const now = new Date().toISOString();

      // Calculate computed_hours and shirt_size based on selected_factors
      const { totalHours, shirtSize } = await calculateFactors(db, selected_factors);

      const result = await db.run(
        `INSERT INTO initiatives (custom_id, name, description, priority, priority_num, status,
          classification, scope, out_of_scope, selected_factors, journal_entries,
          computed_hours, shirt_size, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          custom_id || null, name, description || null, priority || 'Low', priority_num || 0, status || 'To Do',
          classification || 'Internal', scope || null, out_of_scope || null,
          JSON.stringify(selected_factors || []), // Store as JSON string
          JSON.stringify(journal_entries || []), // Store as JSON string
          totalHours, shirtSize,
          start_date || null, end_date || null,
          now, now
        ]
      );

      const newInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [result.lastID]);
      
      // Add audit entry for creation
      const auditEntry = {
        timestamp: now,
        type: 'audit',
        action: 'created',
        new_data: { // Store relevant new data for audit
            name: newInitiative.name,
            custom_id: newInitiative.custom_id,
            computed_hours: newInitiative.computed_hours,
            shirt_size: newInitiative.shirt_size,
            // Include other fields as needed for audit trail
            selected_factors: newInitiative.selected_factors // Already stringified
        }
      };
      // Fetch current journal entries, add audit entry, then update
      let currentJournal = newInitiative.journal_entries ? JSON.parse(newInitiative.journal_entries) : [];
      currentJournal.push(auditEntry);
      await db.run('UPDATE initiatives SET journal_entries = ? WHERE id = ?', [JSON.stringify(currentJournal), newInitiative.id]);

      // Parse JSON fields before sending response
      newInitiative.selected_factors = JSON.parse(newInitiative.selected_factors);
      newInitiative.journal_entries = JSON.parse(JSON.stringify(currentJournal)); // Re-parse to ensure consistency
      res.status(201).json(newInitiative);
    }
  );

  app.put('/api/initiatives/:id',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const {
        custom_id, name, description, priority, priority_num, status,
        classification, scope, out_of_scope, selected_factors, journal_entries,
        start_date, end_date
      } = req.body;
      const now = new Date().toISOString();

      const oldInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
      if (!oldInitiative) {
        return res.status(404).json({ message: 'Initiative not found' });
      }

      // Calculate computed_hours and shirt_size based on updated selected_factors
      const { totalHours, shirtSize } = await calculateFactors(db, selected_factors);

      await db.run(
        `UPDATE initiatives SET
          custom_id = ?, name = ?, description = ?, priority = ?, priority_num = ?, status = ?,
          classification = ?, scope = ?, out_of_scope = ?, selected_factors = ?, journal_entries = ?,
          computed_hours = ?, shirt_size = ?, start_date = ?, end_date = ?, updated_at = ?
         WHERE id = ?`,
        [
          custom_id || null, name, description || null, priority || 'Low', priority_num || 0, status || 'To Do',
          classification || 'Internal', scope || null, out_of_scope || null,
          JSON.stringify(selected_factors || []), // Store as JSON string
          JSON.stringify(journal_entries || []), // Store as JSON string
          totalHours, shirtSize,
          start_date || null, end_date || null,
          now, id
        ]
      );

      const updatedInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);

      // Add audit entry for update
      const auditEntry = {
        timestamp: now,
        type: 'audit',
        action: 'updated',
        old_data: { // Store relevant old data for audit
            name: oldInitiative.name,
            custom_id: oldInitiative.custom_id,
            description: oldInitiative.description,
            priority: oldInitiative.priority,
            priority_num: oldInitiative.priority_num,
            status: oldInitiative.status,
            classification: oldInitiative.classification,
            scope: oldInitiative.scope,
            out_of_scope: oldInitiative.out_of_scope,
            computed_hours: oldInitiative.computed_hours,
            shirt_size: oldInitiative.shirt_size,
            start_date: oldInitiative.start_date,
            end_date: oldInitiative.end_date,
            selected_factors: oldInitiative.selected_factors // Already stringified
        },
        new_data: { // Store relevant new data for audit
            name: updatedInitiative.name,
            custom_id: updatedInitiative.custom_id,
            description: updatedInitiative.description,
            priority: updatedInitiative.priority,
            priority_num: updatedInitiative.priority_num,
            status: updatedInitiative.status,
            classification: updatedInitiative.classification,
            scope: updatedInitiative.scope,
            out_of_scope: updatedInitiative.out_of_scope,
            computed_hours: updatedInitiative.computed_hours,
            shirt_size: updatedInitiative.shirt_size,
            start_date: updatedInitiative.start_date,
            end_date: updatedInitiative.end_date,
            selected_factors: updatedInitiative.selected_factors // Already stringified
        }
      };
      // Fetch current journal entries, add audit entry, then update
      let currentJournal = updatedInitiative.journal_entries ? JSON.parse(updatedInitiative.journal_entries) : [];
      currentJournal.push(auditEntry);
      await db.run('UPDATE initiatives SET journal_entries = ? WHERE id = ?', [JSON.stringify(currentJournal), updatedInitiative.id]);


      // Parse JSON fields before sending response
      updatedInitiative.selected_factors = JSON.parse(updatedInitiative.selected_factors);
      updatedInitiative.journal_entries = JSON.parse(JSON.stringify(currentJournal)); // Re-parse for consistency
      res.json(updatedInitiative);
    }
  );

  app.delete('/api/initiatives/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM initiatives WHERE id = ?', [id]);
    res.status(204).send();
  });

  // New endpoint for importing initiatives
  app.post('/api/initiatives/import', async (req, res) => {
    const initiativesToImport = req.body;
    let importedCount = 0;
    const now = new Date().toISOString();

    for (const init of initiativesToImport) {
        // Calculate computed_hours and shirt_size for imported initiatives
        const { totalHours, shirtSize } = await calculateFactors(db, init.selected_factors);

        try {
            const result = await db.run(
                `INSERT INTO initiatives (custom_id, name, description, priority, priority_num, status,
                  classification, scope, out_of_scope, selected_factors, journal_entries,
                  computed_hours, shirt_size, start_date, end_date, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  init.custom_id || null, init.name, init.description || null, init.priority || 'Low', init.priority_num || 0, init.status || 'To Do',
                  init.classification || 'Imported', init.scope || null, init.out_of_scope || null,
                  JSON.stringify(init.selected_factors || []), // Store as JSON string
                  JSON.stringify(init.journal_entries || []), // Store as JSON string
                  totalHours, shirtSize,
                  init.start_date || null, init.end_date || null,
                  now, now
                ]
            );
            importedCount++;

            // Add audit entry for imported initiative
            const newInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [result.lastID]);
            const auditEntry = {
                timestamp: now,
                type: 'audit',
                action: 'created',
                new_data: {
                    name: newInitiative.name,
                    custom_id: newInitiative.custom_id,
                    computed_hours: newInitiative.computed_hours,
                    shirt_size: newInitiative.shirt_size,
                    selected_factors: newInitiative.selected_factors
                }
            };
            let currentJournal = newInitiative.journal_entries ? JSON.parse(newInitiative.journal_entries) : [];
            currentJournal.push(auditEntry);
            await db.run('UPDATE initiatives SET journal_entries = ? WHERE id = ?', [JSON.stringify(currentJournal), newInitiative.id]);

        } catch (error) {
            console.error('Error importing initiative:', init.name, error);
            // Continue to next initiative even if one fails
        }
    }
    res.status(200).json({ message: 'Import complete', importedCount });
});


  // Endpoint to get audit trail for a specific initiative
  app.get('/api/initiatives/:id/audit', async (req, res) => {
    const { id } = req.params;
    const initiative = await db.get('SELECT journal_entries FROM initiatives WHERE id = ?', [id]);
    if (!initiative) {
      return res.status(404).json({ message: 'Initiative not found' });
    }
    const journalEntries = initiative.journal_entries ? JSON.parse(initiative.journal_entries) : [];
    res.json(journalEntries);
  });


  // Routes for Resource Types
  app.get('/api/resource-types', async (req, res) => {
    const rows = await db.all('SELECT * FROM resource_types');
    res.json(rows);
  });

  app.post('/api/resource-types',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, description } = req.body;
      const id = uuid();
      await db.run('INSERT INTO resource_types (id, name, description) VALUES (?, ?, ?)', [id, name, description || null]);
      res.status(201).json({ id, name, description });
    }
  );

  app.put('/api/resource-types/:id',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { id } = req.params;
      const { name, description } = req.body;
      await db.run('UPDATE resource_types SET name = ?, description = ? WHERE id = ?', [name, description || null, id]);
      res.json({ id, name, description });
    }
  );

  app.delete('/api/resource-types/:id', async (req, res) => {
    const { id } = req.params;
    // TODO: Add cascade delete or validation for associated estimation factors
    await db.run('DELETE FROM resource_types WHERE id = ?', [id]);
    res.status(204).send();
  });

  // Routes for Estimation Factors
  app.get('/api/estimation-factors', async (req, res) => {
    const factors = await db.all('SELECT * FROM estimation_factors');
    // Parse hoursPerResourceType JSON string before sending
    const parsedFactors = factors.map(f => ({
      ...f,
      hoursPerResourceType: f.hoursPerResourceType ? JSON.parse(f.hoursPerResourceType) : {}
    }));
    res.json(parsedFactors);
  });

  app.post('/api/estimation-factors',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, hoursPerResourceType } = req.body;
      const id = uuid();
      await db.run('INSERT INTO estimation_factors (id, name, hoursPerResourceType) VALUES (?, ?, ?)', [id, name, JSON.stringify(hoursPerResourceType || {})]);
      res.status(201).json({ id, name, hoursPerResourceType });
    }
  );

  app.put('/api/estimation-factors/:id',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { id } = req.params;
      const { name, hoursPerResourceType } = req.body;
      await db.run('UPDATE estimation_factors SET name = ?, hoursPerResourceType = ? WHERE id = ?', [name, JSON.stringify(hoursPerResourceType || {}), id]);
      res.json({ id, name, hoursPerResourceType });
    }
  );

  app.delete('/api/estimation-factors/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM estimation_factors WHERE id = ?', [id]);
    res.status(204).send();
  });

  // Routes for Shirt Sizes
  app.get('/api/shirt-sizes', async (req, res) => {
    const rows = await db.all('SELECT * FROM shirt_sizes ORDER BY threshold_hours');
    res.json(rows);
  });
  
  app.put('/api/shirt-sizes',
    body().isArray(),
    async (req, res) => {
      const now = new Date().toISOString();
      const newSizes = req.body;
      const oldSizes = await db.all('SELECT * FROM shirt_sizes');

      const dbUpdates = newSizes.map(size =>
        db.run('UPDATE shirt_sizes SET threshold_hours=? WHERE size=?', [size.threshold_hours, size.size])
      );
      await Promise.all(dbUpdates);
      
      await db.run(
        `INSERT INTO shirt_size_audit (id, action, old_data, new_data, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [uuid(), 'updated', JSON.stringify(oldSizes), JSON.stringify(newSizes), now]
      );
      
      const updatedSizes = await db.all('SELECT * FROM shirt_sizes ORDER BY threshold_hours');
      res.json(updatedSizes);
    }
  );

  app.get('/api/shirt-sizes/audit', async (req, res) => {
    const rows = await db.all('SELECT * FROM shirt_size_audit ORDER BY timestamp DESC');
    res.json(rows);
  });

  return app;
}

if (import.meta.main) {
  createApp()
    .then(app => {
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        console.log(`Estiim API listening at http://localhost:${port}`);
      });
    })
    .catch(err => {
      console.error('Failed to start Estiim API:', err);
      process.exit(1);
    });
}
