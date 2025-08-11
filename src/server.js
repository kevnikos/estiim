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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function createApp() {
  // Perform database backup immediately on startup
  await backupDatabase();

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

  // Create routers and pass the database connection
  const initiativesRouter = createInitiativesRouter(db);
  const estimationFactorsRouter = createEstimationFactorsRouter(db);
  const resourceTypesRouter = createResourceTypesRouter(db);
  const shirtSizesRouter = createShirtSizesRouter(db);
  const dropdownOptionsRouter = createDropdownOptionsRouter(db);

  // Mount the routers
  app.use('/api/initiatives', initiativesRouter);
  app.use('/api/estimation-factors', estimationFactorsRouter);
  app.use('/api/resource-types', resourceTypesRouter);
  app.use('/api/shirt-sizes', shirtSizesRouter);
  app.use('/api/dropdown-options', dropdownOptionsRouter);

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
