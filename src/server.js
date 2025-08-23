/**
 * server.js
 * * Main application entry point.
 * Initializes the Express server, connects to the database, and loads API routes.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase } from './database.js';
import { backupDatabase } from './utils.js';

// Import route handlers
import createInitiativesRouter from './routes/initiatives.js';
import createEstimationFactorsRouter from './routes/estimationFactors.js';
import createResourceTypesRouter from './routes/resourceTypes.js';
import createShirtSizesRouter from './routes/shirtSizes.js';
import createDropdownOptionsRouter from './routes/dropdownOptions.js';
import createBackupRouter from './routes/backup.js';
import createCategoriesRouter from './routes/categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Backup scheduler state
let currentBackupInterval = null;
let currentBackupFrequency = null;

// Schedule database backups
function scheduleBackups(frequencyMinutes) {
  // Clear existing interval if any
  if (currentBackupInterval) {
    clearInterval(currentBackupInterval);
  }

  // Convert minutes to milliseconds
  const intervalMs = frequencyMinutes * 60 * 1000;

  // Schedule periodic backups
  currentBackupInterval = setInterval(async () => {
    try {
      console.log('[BACKUP] Starting scheduled database backup...');
      await backupDatabase();
      console.log(`[BACKUP] Scheduled backup completed successfully. Next backup in ${frequencyMinutes} minutes.`);
    } catch (err) {
      console.error('[BACKUP ERROR] Failed to perform scheduled backup:', err);
    }
  }, intervalMs);

  currentBackupFrequency = frequencyMinutes;
  console.log(`[BACKUP] Scheduler configured for every ${frequencyMinutes} minutes`);
}

// Function to update backup interval
function updateBackupInterval(frequencyMinutes) {
  scheduleBackups(frequencyMinutes);
}

async function createApp() {
  // Initialize Express app
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  // Debug logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Initialize database
  const db = await initializeDatabase();

  // Load backup frequency from database and initialize backup system
  try {
    const setting = await db.get(
      'SELECT value FROM system_settings WHERE key = ?',
      ['backup_frequency_minutes']
    );
    if (setting) {
      currentBackupFrequency = parseInt(setting.value, 10);
      console.log(`[BACKUP] Loaded backup frequency from database: ${currentBackupFrequency} minutes`);
    } else {
      console.warn('[BACKUP] No backup frequency found in database, using default');
    }

    // Perform database backup immediately on startup
    await backupDatabase();

    // Start periodic backup schedule with loaded frequency
    scheduleBackups(currentBackupFrequency);
  } catch (err) {
    console.error('[BACKUP ERROR] Failed to initialize backup system:', err);
  }

  // Create routers and pass the database connection
  const initiativesRouter = createInitiativesRouter(db);
  const estimationFactorsRouter = createEstimationFactorsRouter(db);
  const resourceTypesRouter = createResourceTypesRouter(db);
  const shirtSizesRouter = createShirtSizesRouter(db);
  const dropdownOptionsRouter = createDropdownOptionsRouter(db);
  const backupRouter = createBackupRouter(db, updateBackupInterval);
  const categoriesRouter = createCategoriesRouter(db);

  // Mount the routers
  app.use('/api/initiatives', initiativesRouter);
  app.use('/api/estimation-factors', estimationFactorsRouter);
  app.use('/api/resource-types', resourceTypesRouter);
  app.use('/api/shirt-sizes', shirtSizesRouter);
  app.use('/api/dropdown-options', dropdownOptionsRouter);
  app.use('/api/backup', backupRouter);
  app.use('/api/categories', categoriesRouter);

  // Serve the main HTML file for any other route
  app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return app;
}

// Start the server
createApp()
  .then(app => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`[BOOT] Estiim API listening on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("[BOOT ERROR]", err);
    process.exit(1);
  });
