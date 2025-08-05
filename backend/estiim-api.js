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
import fs from 'fs/promises'; // Import Node.js file system promises API

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Define database file path
const DB_FILE_PATH = path.join(__dirname, 'estiim.db');
const BACKUPS_DIR = path.join(__dirname, 'backups'); // Define backups directory

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
      // If hours are less than the current size's threshold,
      // then the previously determinedSize (which met its threshold) is the correct one.
      break;
    }
  }
  console.log('DEBUG: Determined shirtSize:', determinedSize);
  return determinedSize;
}

/**
 * Ensures the backup directory exists.
 */
async function ensureBackupDirectory() {
  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    console.log(`INFO: Ensured backup directory exists at: ${BACKUPS_DIR}`);
  } catch (error) {
    console.error(`ERROR: Failed to create backup directory ${BACKUPS_DIR}:`, error);
    // Continue even if directory creation fails, as it might just be a permission issue
    // and the app might still function without backups.
  }
}

/**
 * Creates a timestamped backup of the database file.
 */
async function backupDatabase() {
  await ensureBackupDirectory(); // Ensure backup directory exists before backing up

  try {
    // Check if the database file exists before attempting to copy
    await fs.access(DB_FILE_PATH, fs.constants.F_OK);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const backupFileName = `estiim-db-${yyyy}${mm}${dd}${hh}${min}${ss}.bak`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

    await fs.copyFile(DB_FILE_PATH, backupFilePath);
    console.log(`INFO: Database backed up to: ${backupFilePath}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`WARN: Database file not found at ${DB_FILE_PATH}. Skipping backup.`);
    } else {
      console.error(`ERROR: Failed to backup database:`, error);
    }
  }
}

/**
 * Helper function for deep comparison of hoursPerResourceType objects.
 * @param {object} obj1 - First object to compare.
 * @param {object} obj2 - Second object to compare.
 * @returns {boolean} True if objects have the same keys and values, false otherwise.
 */
function areHoursPerResourceTypeEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }
  return true;
}


export async function createApp() {
  // Perform database backup immediately on startup
  await backupDatabase();

  // Express app
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  // Debug logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  console.log(`INFO: Database file path: ${DB_FILE_PATH}`); // Log the database file path

  // Open the database
  const db = await open({
    filename: DB_FILE_PATH, // Use the defined path
    driver: sqlite3.Database
  });

  // Database schema bootstrap
  await db.exec(`
    CREATE TABLE IF NOT EXISTS initiatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      custom_id TEXT,
      description TEXT,
      priority TEXT,
      priority_num INTEGER,
      status TEXT,
      classification TEXT,
      scope TEXT,
      out_of_scope TEXT,
      selected_factors TEXT, -- Stored as JSON string
      computed_hours REAL,
      shirt_size TEXT,
      journal_entries TEXT, -- Stored as JSON string, holds comments and audit trail
      start_date TEXT, -- Added start_date column
      end_date TEXT,   -- Added end_date column
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS resource_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS estimation_factors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT, -- Added description field to estimation_factors
      hours_per_resource_type TEXT, -- Stored as JSON string { "resourceTypeId": hours }
      journal_entries TEXT, -- Stored as JSON string, holds comments and audit trail
      created_at TEXT, -- Added created_at column
      updated_at TEXT -- Added updated_at column
    );

    CREATE TABLE IF NOT EXISTS estimation_factor_audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      old_data TEXT, -- JSON string of old estimation factor data
      new_data TEXT, -- JSON string of new estimation factor data
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shirt_sizes (
      size TEXT PRIMARY KEY,
      threshold_hours REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shirt_size_audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      old_data TEXT, -- JSON string of old shirt_sizes array
      new_data TEXT, -- JSON string of new shirt_sizes array
      timestamp TEXT NOT NULL
    );
  `);

  // Seed default shirt sizes if table is empty
  const existingSizes = await db.all('SELECT * FROM shirt_sizes');
  if (existingSizes.length === 0) {
    await db.run('INSERT INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['XS', 0]);
    await db.run('INSERT INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['S', 40]);
    await db.run('INSERT INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['M', 80]);
    await db.run('INSERT INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['L', 160]);
    await db.run('INSERT INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['XL', 320]);
    await db.run('INSERT INTO shirt_sizes (size, threshold_hours) VALUES (?, ?)', ['XXL', 640]);
    console.log('Default shirt sizes seeded.');
  }

  // Routes for Initiatives
  app.get('/api/initiatives', async (req, res) => {
    const rows = await db.all('SELECT * FROM initiatives');
    // Parse JSON fields before sending to client
    rows.forEach(row => {
      row.selected_factors = JSON.parse(row.selected_factors || '[]');
      row.journal_entries = JSON.parse(row.journal_entries || '[]');
      // Also parse old_data and new_data within journal_entries if they exist and are strings
      row.journal_entries.forEach(entry => {
        if (entry.type === 'audit') {
          try {
            if (typeof entry.old_data === 'string') {
              entry.old_data = JSON.parse(entry.old_data);
            }
          } catch (e) {
            console.error("Error parsing old_data in audit entry:", e, entry.old_data);
            entry.old_data = {}; // Default to empty object on error
          }
          try {
            if (typeof entry.new_data === 'string') {
              entry.new_data = JSON.parse(entry.new_data);
            }
          } catch (e) {
            console.error("Error parsing new_data in audit entry:", e, entry.new_data);
            entry.new_data = {}; // Default to empty object on error
          }
        }
      });
    });
    res.json(rows);
  });

  app.get('/api/initiatives/:id', async (req, res) => {
    const { id } = req.params;
    const row = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ message: 'Initiative not found' });
    }
    // Parse JSON fields before sending to client
    row.selected_factors = JSON.parse(row.selected_factors || '[]');
    row.journal_entries = JSON.parse(row.journal_entries || '[]');
    // Also parse old_data and new_data within journal_entries if they exist and are strings
    row.journal_entries.forEach(entry => {
      if (entry.type === 'audit') {
        try {
          if (typeof entry.old_data === 'string') {
            entry.old_data = JSON.parse(entry.old_data);
          }
        } catch (e) {
          console.error("Error parsing old_data in audit entry:", e, entry.old_data);
          entry.old_data = {}; // Default to empty object on error
        }
        try {
          if (typeof entry.new_data === 'string') {
            entry.new_data = JSON.parse(entry.new_data);
          }
        } catch (e) {
          console.error("Error parsing new_data in audit entry:", e, entry.new_data);
          entry.new_data = {}; // Default to empty object on error
        }
      }
    });
    res.json(row);
  });

  // Route to get audit trail for a specific initiative (returns journal_entries)
  app.get('/api/initiatives/:id/audit', async (req, res) => {
    const { id } = req.params;
    const row = await db.get('SELECT journal_entries FROM initiatives WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ message: 'Initiative not found' });
    }
    const journalEntries = JSON.parse(row.journal_entries || '[]');
    // Parse old_data and new_data within journal_entries if they exist and are strings
    journalEntries.forEach(entry => {
      if (entry.type === 'audit') {
        try {
          if (typeof entry.old_data === 'string') {
            entry.old_data = JSON.parse(entry.old_data);
          }
        } catch (e) {
          console.error("Error parsing old_data in audit entry:", e, entry.old_data);
          entry.old_data = {}; // Default to empty object on error
        }
        try {
          if (typeof entry.new_data === 'string') {
            entry.new_data = JSON.parse(entry.new_data);
            }
          } catch (e) {
            console.error("Error parsing new_data in audit entry:", e, entry.new_data);
            entry.new_data = {};
          }
        }
      });
    res.json(journalEntries);
  });

  app.post('/api/initiatives',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const now = new Date().toISOString();
      const {
        name, custom_id, description, priority, priority_num, status,
        classification, scope, out_of_scope, selected_factors, journal_entries,
        start_date, end_date // Destructure new date fields
      } = req.body;

      console.log('DEBUG (POST): selected_factors received:', selected_factors);

      // Calculate computed_hours and shirt_size from selected_factors
      let computedHours = 0;
      if (selected_factors && Array.isArray(selected_factors)) {
        for (const factor of selected_factors) {
          if (factor.hoursPerResourceType) {
            const totalFactorHours = Object.values(factor.hoursPerResourceType).reduce((sum, h) => sum + h, 0);
            computedHours += totalFactorHours * (factor.quantity || 1);
          }
        }
      }
      // Round to one decimal place to avoid floating point inaccuracies
      computedHours = parseFloat(computedHours.toFixed(1));

      console.log('DEBUG (POST): Calculated computedHours:', computedHours);

      const shirtSize = await getShirtSize(db, computedHours);
      console.log('DEBUG (POST): Determined shirtSize:', shirtSize);

      const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || [])); // Deep copy

      // Prepare new data for audit snapshot
      const newDataForAudit = {
        name, custom_id, description, priority, priority_num, status,
        classification, scope, out_of_scope,
        selected_factors: JSON.stringify(selected_factors || []), // CRITICAL FIX: Always stringify selected_factors for audit
        computed_hours: computedHours.toFixed(1), // Store as string for consistency
        shirt_size: shirtSize,
        start_date: start_date || null, // Include in audit snapshot
        end_date: end_date || null      // Include in audit snapshot
      };

      // Add audit entry for creation
      const auditEntry = {
        timestamp: now,
        type: 'audit',
        action: 'created',
        old_data: JSON.stringify({}), // Store empty object as JSON string
        new_data: JSON.stringify(newDataForAudit) // Store new data as JSON string
      };
      newJournalEntries.push(auditEntry);

      const result = await db.run(
        `INSERT INTO initiatives (name, custom_id, description, priority, priority_num, status, classification, scope, out_of_scope, selected_factors, computed_hours, shirt_size, journal_entries, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name, custom_id, description, priority, priority_num, status,
          classification, scope, out_of_scope,
          JSON.stringify(selected_factors || []),
          computedHours,
          shirtSize,
          JSON.stringify(newJournalEntries), // Store journal entries as JSON string
          start_date, // Pass start_date
          end_date,   // Pass end_date
          now, now
        ]
      );
      const newInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [result.lastID]);
      // Parse JSON fields before sending to client
      newInitiative.selected_factors = JSON.parse(newInitiative.selected_factors || '[]');
      newInitiative.journal_entries = JSON.parse(newInitiative.journal_entries || '[]');
      // Also parse old_data and new_data within journal_entries if they exist and are strings
      newInitiative.journal_entries.forEach(entry => {
        if (entry.type === 'audit') {
          try {
            if (typeof entry.old_data === 'string') {
              entry.old_data = JSON.parse(entry.old_data);
            }
          } catch (e) {
            console.error("Error parsing old_data in audit entry:", e, entry.old_data);
            entry.old_data = {}; // Default to empty object on error
          }
          try {
            if (typeof entry.new_data === 'string') {
              entry.new_data = JSON.parse(entry.new_data);
            }
          } catch (e) {
            console.error("Error parsing new_data in audit entry:", e, entry.new_data);
            entry.new_data = {}; // Default to empty object on error
          }
        }
      });
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
      const now = new Date().toISOString();
      const {
        name, custom_id, description, priority, priority_num, status,
        classification, scope, out_of_scope, selected_factors, journal_entries,
        start_date, end_date // Destructure new date fields
      } = req.body;

      console.log('DEBUG (PUT): selected_factors received:', selected_factors);

      let oldInitiative;
      try {
        oldInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
        if (!oldInitiative) {
          return res.status(404).json({ message: 'Initiative not found' });
        }
      } catch (err) {
        console.error('Error fetching old initiative:', err);
        return res.status(500).json({ message: 'Database error fetching old initiative' });
      }

      // Calculate computed_hours and shirt_size from selected_factors
      let newComputedHours = 0;
      if (selected_factors && Array.isArray(selected_factors)) {
        for (const factor of selected_factors) {
          if (factor.hoursPerResourceType) {
            const totalFactorHours = Object.values(factor.hoursPerResourceType).reduce((sum, h) => sum + h, 0);
            newComputedHours += totalFactorHours * (factor.quantity || 1);
          }
        }
      }
      // Round to one decimal place to avoid floating point inaccuracies
      newComputedHours = parseFloat(newComputedHours.toFixed(1));

      console.log('DEBUG (PUT): Calculated newComputedHours:', newComputedHours);

      const newShirtSize = await getShirtSize(db, newComputedHours);
      console.log('DEBUG (PUT): Determined newShirtSize:', newShirtSize);

      // Prepare data for update
      const updateFields = {
        name, custom_id, description, priority, priority_num, status,
        classification, scope, out_of_scope,
        selected_factors: JSON.stringify(selected_factors || []), // Store as JSON string
        journal_entries: JSON.stringify(journal_entries || []),   // Store as JSON string
        computed_hours: newComputedHours, // Store as number
        shirt_size: newShirtSize,
        start_date: start_date || null, // Include in update fields
        end_date: end_date || null,     // Include in update fields
        updated_at: now
      };

      // Construct the SET clause for the SQL UPDATE statement
      const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updateFields);
      values.push(id); // Add ID for WHERE clause

      try {
        await db.run(`UPDATE initiatives SET ${setClause} WHERE id = ?`, values);
      } catch (err) {
        console.error('Error updating initiative:', err);
        return res.status(500).json({ message: 'Database error updating initiative' });
      }

      // --- Audit Trail Logic ---
      const oldJournalEntries = JSON.parse(oldInitiative.journal_entries || '[]');
      const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || [])); // Deep copy to avoid mutation

      // Create a snapshot of the old and new initiative data for audit comparison
      // Ensure selected_factors is the raw JSON string from the database for oldDataForAudit
      const oldDataForAudit = {
        name: oldInitiative.name,
        custom_id: oldInitiative.custom_id,
        description: oldInitiative.description,
        priority: oldInitiative.priority,
        priority_num: oldInitiative.priority_num,
        status: oldInitiative.status,
        classification: oldInitiative.classification,
        scope: oldInitiative.scope,
        out_of_scope: oldInitiative.out_of_scope,
        selected_factors: oldInitiative.selected_factors || '[]', // Keep as string for comparison
        computed_hours: parseFloat(oldInitiative.computed_hours || 0).toFixed(1), // Normalize to string
        shirt_size: oldInitiative.shirt_size,
        start_date: oldInitiative.start_date || null, // Include in audit snapshot
        end_date: oldInitiative.end_date || null      // Include in audit snapshot
      };

      const newDataForAudit = {
        name: name,
        custom_id: custom_id,
        description: description,
        priority: priority,
        priority_num: priority_num,
        status: status,
        classification: classification,
        scope: scope,
        out_of_scope: out_of_scope,
        selected_factors: JSON.stringify(selected_factors || []), // Keep as string for comparison
        computed_hours: newComputedHours.toFixed(1), // Normalize to string
        shirt_size: newShirtSize,
        start_date: start_date || null, // Include in audit snapshot
        end_date: end_date || null      // Include in audit snapshot
      };

      let changesDetected = false;
      
      // Compare fields
      const keysToCompare = [
          'name', 'custom_id', 'description', 'priority', 'priority_num',
          'status', 'classification', 'scope', 'out_of_scope',
          'computed_hours', 'shirt_size', 'start_date', 'end_date'
      ];

      for (const key of keysToCompare) {
          // Special handling for date fields to compare only YYYY-MM-DD part
          if (key === 'start_date' || key === 'end_date') {
              const oldDate = (oldDataForAudit[key] || '').substring(0, 10);
              const newDate = (newDataForAudit[key] || '').substring(0, 10);
              if (oldDate !== newDate) {
                  changesDetected = true;
              }
          } else {
              // Compare other fields directly.
              if (oldDataForAudit[key] !== newDataForAudit[key]) {
                  changesDetected = true;
              }
          }
      }

      // Compare selected_factors as parsed objects, not raw strings
      const parsedOldFactors = JSON.parse(oldDataForAudit.selected_factors || '[]');
      const parsedNewFactors = JSON.parse(newDataForAudit.selected_factors || '[]');

      // Sort them for consistent comparison
      const sortedOldFactors = [...parsedOldFactors].sort((a, b) => (a?.factorId || '').localeCompare(b?.factorId || ''));
      const sortedNewFactors = [...parsedNewFactors].sort((a, b) => (a?.factorId || '').localeCompare(b?.factorId || ''));

      if (JSON.stringify(sortedOldFactors) !== JSON.stringify(sortedNewFactors)) {
          changesDetected = true;
      }


      if (changesDetected) {
        const auditEntry = {
          timestamp: now,
          type: 'audit',
          action: 'updated',
          old_data: JSON.stringify(oldDataForAudit), // Store as JSON string
          new_data: JSON.stringify(newDataForAudit)  // Store as JSON string
        };
        newJournalEntries.push(auditEntry); // Add to the new journal entries array
      }

      // Update the journal_entries in the database again with the new audit entry
      try {
        await db.run('UPDATE initiatives SET journal_entries = ? WHERE id = ?', [JSON.stringify(newJournalEntries), id]);
      } catch (err) {
        console.error('Error updating journal entries with audit:', err);
        // This is a critical error, but we should still respond to the client
        return res.status(500).json({ message: 'Database error updating journal entries with audit' });
      }

      const updatedInitiative = await db.get('SELECT * FROM initiatives WHERE id = ?', [id]);
      // Parse JSON fields before sending to client
      updatedInitiative.selected_factors = JSON.parse(updatedInitiative.selected_factors || '[]');
      updatedInitiative.journal_entries = JSON.parse(updatedInitiative.journal_entries || '[]');
      // Also parse old_data and new_data within journal_entries if they exist and are strings
      updatedInitiative.journal_entries.forEach(entry => {
        if (entry.type === 'audit') {
          try {
            if (typeof entry.old_data === 'string') {
              entry.old_data = JSON.parse(entry.old_data);
            }
          } catch (e) {
            console.error("Error parsing old_data in audit entry:", e, entry.old_data);
            entry.old_data = {}; // Default to empty object on error
          }
          try {
            if (typeof entry.new_data === 'string') {
              entry.new_data = JSON.parse(entry.new_data);
            }
          } catch (e) {
            console.error("Error parsing new_data in audit entry:", e, entry.new_data);
            entry.new_data = {}; // Default to empty object on error
          }
        }
      });
      res.json(updatedInitiative);
    }
  );

  app.delete('/api/initiatives/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.run('DELETE FROM initiatives WHERE id = ?', [id]);
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting initiative:', err);
      res.status(500).json({ message: 'Database error deleting initiative' });
    }
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
      try {
        await db.run('INSERT INTO resource_types (id, name, description) VALUES (?, ?, ?)', [uuid(), name, description]);
        const newRT = await db.get('SELECT * FROM resource_types WHERE name = ?', [name]);
        res.status(201).json(newRT);
      } catch (err) {
        console.error('Error adding resource type:', err);
        res.status(500).json({ message: 'Database error adding resource type' });
      }
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
      try {
        await db.run('UPDATE resource_types SET name = ?, description = ? WHERE id = ?', [name, description, id]);
        const updatedRT = await db.get('SELECT * FROM resource_types WHERE id = ?', [id]);
        res.json(updatedRT);
      } catch (err) {
        console.error('Error updating resource type:', err);
        res.status(500).json({ message: 'Database error updating resource type' });
      }
    }
  );

  app.delete('/api/resource-types/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.run('DELETE FROM resource_types WHERE id = ?', [id]);
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting resource type:', err);
      res.status(500).json({ message: 'Database error deleting resource type' });
    }
  });

  // Routes for Estimation Factors
  app.get('/api/estimation-factors', async (req, res) => {
    const rows = await db.all('SELECT * FROM estimation_factors');
    rows.forEach(row => {
      row.hoursPerResourceType = JSON.parse(row.hours_per_resource_type || '{}');
      row.journal_entries = JSON.parse(row.journal_entries || '[]'); // Parse journal entries
      // This is the crucial part for the nested audit data
      row.journal_entries.forEach(entry => {
        if (entry.type === 'audit') {
          try {
            if (typeof entry.old_data === 'string') {
              entry.old_data = JSON.parse(entry.old_data);
            }
          } catch (e) {
            console.error("Error parsing old_data in EF audit entry (GET /):", e, entry.old_data);
            entry.old_data = {};
          }
          try {
            if (typeof entry.new_data === 'string') {
              entry.new_data = JSON.parse(entry.new_data);
            }
          } catch (e) {
            console.error("Error parsing new_data in EF audit entry (GET /):", e, entry.new_data);
            entry.new_data = {};
          }
        }
      });
      delete row.hours_per_resource_type; // Clean up internal field
    });
    res.json(rows);
  });

  app.get('/api/estimation-factors/:id/audit', async (req, res) => {
    const { id } = req.params;
    const row = await db.get('SELECT journal_entries FROM estimation_factors WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ message: 'Estimation Factor not found' });
    }
    const journalEntries = JSON.parse(row.journal_entries || '[]');
    // Parse old_data and new_data within journal_entries if they exist and are strings
    journalEntries.forEach(entry => {
      if (entry.type === 'audit') {
        try {
          if (typeof entry.old_data === 'string') {
            entry.old_data = JSON.parse(entry.old_data);
          }
        } catch (e) {
          console.error("Error parsing old_data in EF audit entry (GET /:id/audit):", e, entry.old_data);
          entry.old_data = {};
        }
        try {
          if (typeof entry.new_data === 'string') {
            entry.new_data = JSON.parse(entry.new_data);
            }
          } catch (e) {
            console.error("Error parsing new_data in EF audit entry (GET /:id/audit):", e, entry.new_data);
            entry.new_data = {};
          }
        }
      });
    res.json(journalEntries);
  });

  app.post('/api/estimation-factors',
    body('name').notEmpty().withMessage('Name is required'),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const now = new Date().toISOString();
      const { name, description, hoursPerResourceType, journal_entries } = req.body;

      const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || [])); // Deep copy

      // Prepare new data for audit snapshot
      const newDataForAudit = {
        name,
        description,
        hoursPerResourceType: hoursPerResourceType || {},
      };

      // Add audit entry for creation
      const auditEntry = {
        timestamp: now,
        type: 'audit',
        action: 'created',
        old_data: JSON.stringify({}), // Store empty object as JSON string
        new_data: JSON.stringify(newDataForAudit) // Store new data as JSON string
      };
      newJournalEntries.push(auditEntry);

      try {
        await db.run(
          'INSERT INTO estimation_factors (id, name, description, hours_per_resource_type, journal_entries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuid(), name, description, JSON.stringify(hoursPerResourceType || {}), JSON.stringify(newJournalEntries), now, now]
        );
        const newEF = await db.get('SELECT * FROM estimation_factors WHERE name = ?', [name]);
        newEF.hoursPerResourceType = JSON.parse(newEF.hours_per_resource_type || '{}');
        newEF.journal_entries = JSON.parse(newEF.journal_entries || '[]'); // Parse journal entries
        delete newEF.hours_per_resource_type;
        res.status(201).json(newEF);
      } catch (err) {
        console.error('Error adding estimation factor:', err);
        res.status(500).json({ message: 'Database error adding estimation factor' });
      }
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
      const now = new Date().toISOString();
      const { name, description, hoursPerResourceType, journal_entries } = req.body;

      let oldEstimationFactor;
      try {
        oldEstimationFactor = await db.get('SELECT * FROM estimation_factors WHERE id = ?', [id]);
        if (!oldEstimationFactor) {
          return res.status(404).json({ message: 'Estimation Factor not found' });
        }
      } catch (err) {
        console.error('Error fetching old estimation factor:', err);
        return res.status(500).json({ message: 'Database error fetching old estimation factor' });
      }

      // Prepare data for update
      const updateFields = {
        name,
        description,
        hours_per_resource_type: JSON.stringify(hoursPerResourceType || {}),
        journal_entries: JSON.stringify(journal_entries || []),
        updated_at: now
      };

      const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updateFields);
      values.push(id);

      try {
        await db.run(`UPDATE estimation_factors SET ${setClause} WHERE id = ?`, values);
      } catch (err) {
        console.error('Error updating estimation factor:', err);
        return res.status(500).json({ message: 'Database error updating estimation factor' });
      }

      // --- Audit Trail Logic for Estimation Factors ---
      const oldJournalEntries = JSON.parse(oldEstimationFactor.journal_entries || '[]');
      const newJournalEntries = JSON.parse(JSON.stringify(journal_entries || [])); // Deep copy

      const oldDataForAudit = {
        name: oldEstimationFactor.name,
        description: oldEstimationFactor.description,
        hoursPerResourceType: JSON.parse(oldEstimationFactor.hours_per_resource_type || '{}'),
      };

      const newDataForAudit = {
        name: name,
        description: description,
        hoursPerResourceType: hoursPerResourceType || {},
      };

      let changesDetected = false;
      const efKeysToCompare = ['name', 'description'];
      for (const key of efKeysToCompare) {
        if (oldDataForAudit[key] !== newDataForAudit[key]) {
          changesDetected = true;
          break;
        }
      }

      // Use the new helper for hoursPerResourceType comparison
      if (!areHoursPerResourceTypeEqual(oldDataForAudit.hoursPerResourceType, newDataForAudit.hoursPerResourceType)) {
        changesDetected = true;
      }

      if (changesDetected) {
        const auditEntry = {
          timestamp: now,
          type: 'audit',
          action: 'updated',
          old_data: JSON.stringify(oldDataForAudit),
          new_data: JSON.stringify(newDataForAudit)
        };
        newJournalEntries.push(auditEntry);
      }

      // Update the journal_entries in the database again with the new audit entry
      try {
        await db.run('UPDATE estimation_factors SET journal_entries = ? WHERE id = ?', [JSON.stringify(newJournalEntries), id]);
      } catch (err) {
        console.error('Error updating EF journal entries with audit:', err);
        return res.status(500).json({ message: 'Database error updating EF journal entries with audit' });
      }

      const updatedEF = await db.get('SELECT * FROM estimation_factors WHERE id = ?', [id]);
      updatedEF.hoursPerResourceType = JSON.parse(updatedEF.hours_per_resource_type || '{}');
      updatedEF.journal_entries = JSON.parse(updatedEF.journal_entries || '[]');
      delete updatedEF.hours_per_resource_type;
      res.json(updatedEF);
    }
  );

  app.delete('/api/estimation-factors/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.run('DELETE FROM estimation_factors WHERE id = ?', [id]);
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting estimation factor:', err);
      res.status(500).json({ message: 'Database error deleting estimation factor' });
    }
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
        console.log(`Estiim API listening on port ${port}`);
      });
    })
    .catch(err => {
      console.error('Failed to start Estiim API:', err);
      process.exit(1);
    });
}
