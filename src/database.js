/**
 * database.js
 * * Manages SQLite database connection and schema setup.
 */
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { 
  initMigrationsTable, 
  getCurrentVersion,
  recordMigration,
  hasBeenApplied 
} from './migrations/migrationUtils.js';
import * as buildInfoMigration from './migrations/20250823000001_add_build_info.js';
import * as efJournalMigration from './migrations/20250823000002_add_ef_journal_and_audit.js';
import * as shirtSizeAuditMigration from './migrations/20250823000003_add_shirt_size_audit.js';
import * as dropdownCreatedAtMigration from './migrations/20250823000004_add_dropdown_options_created_at.js';
import * as systemSettingsMigration from './migrations/20250823000005_add_system_settings.js';
import * as estimatedDurationMigration from './migrations/20250823000006_add_estimated_duration.js';
import * as categoriesMigration from './migrations/20250823000007_add_categories.js';
import * as resourceTypePropertiesMigration from './migrations/20250824000001_add_resource_type_properties.js';
import * as resourceTypesAuditMigration from './migrations/20250824000002_add_resource_types_audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the database file path based on environment
const getDbPath = () => {
  // If running in Docker (can be set in docker-compose.yml or Dockerfile)
  if (process.env.DOCKER_ENV === 'true') {
    return path.join(__dirname, 'data', 'estiim.db');
  }
  // Default path for local development
  return path.join(__dirname, 'estiim.db');
};

const DB_FILE_PATH = getDbPath();

// Create data directory if it doesn't exist when in Docker
if (process.env.DOCKER_ENV === 'true') {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Define all migrations in order
const migrations = [
  buildInfoMigration,
  efJournalMigration,
  shirtSizeAuditMigration,
  dropdownCreatedAtMigration,
  systemSettingsMigration,
  estimatedDurationMigration,
  categoriesMigration,
  resourceTypePropertiesMigration,
  resourceTypesAuditMigration
];

/**
 * Apply pending migrations
 * @param {object} db - Database connection
 */
async function runMigrations(db) {
  await initMigrationsTable(db);
  
  for (const migration of migrations) {
    const isApplied = await hasBeenApplied(db, migration.version);
    if (!isApplied) {
      console.log(`INFO: Applying migration ${migration.version}...`);
      await migration.up(db);
      await recordMigration(db, migration.version);
      console.log(`INFO: Migration ${migration.version} applied successfully.`);
    }
  }
}

/**
 * Initializes and opens the SQLite database.
 * Creates tables if they don't exist and seeds default data.
 * @returns {Promise<Database>} A promise that resolves to the database instance.
 */
export async function initializeDatabase() {
  console.log(`INFO: Database file path: ${DB_FILE_PATH}`);

  const db = await open({
    filename: DB_FILE_PATH,
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
      estimation_type TEXT,
      classification TEXT,
      scope TEXT,
      out_of_scope TEXT,
      selected_factors TEXT,
      computed_hours REAL,
      shirt_size TEXT,
      journal_entries TEXT,
      start_date TEXT,
      end_date TEXT,
      estimated_duration INTEGER,
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
      description TEXT,
      hours_per_resource_type TEXT,
      journal_entries TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS estimation_factor_audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shirt_sizes (
      size TEXT PRIMARY KEY,
      threshold_hours REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dropdown_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT,
      UNIQUE(category, value)
    );

    CREATE TABLE IF NOT EXISTS shirt_size_audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    console.log('INFO: Default shirt sizes seeded.');
  }

  // Seed default dropdown options if none exist
  const existingOptions = await db.all('SELECT * FROM dropdown_options');
  if (existingOptions.length === 0) {
    // Status options
    const defaultStatuses = [
      'Accepted',
      'Draft',
      'Done',
      'Estimated',
      'Hold',
      'Not Required',
      'Partial',
      'Rejected',
      'Re-Estimation',
      'To Do'
    ];
    for (const status of defaultStatuses) {
      await db.run(
        'INSERT INTO dropdown_options (category, value, created_at) VALUES (?, ?, datetime())',
        'status', status
      );
    }

    // Estimation type options
    const defaultTypes = [
      'E4E',
      'High',
      'Medium',
      'Low',
      'WAG'
    ];
    for (const type of defaultTypes) {
      await db.run(
        'INSERT INTO dropdown_options (category, value, created_at) VALUES (?, ?, datetime())',
        'type', type
      );
    }

    // Priority options
    const defaultPriorities = [
      'High',
      'Medium',
      'Low'
    ];
    for (const priority of defaultPriorities) {
      await db.run(
        'INSERT INTO dropdown_options (category, value, created_at) VALUES (?, ?, datetime())',
        'priority', priority
      );
    }

    console.log('INFO: Default dropdown options seeded.');
  }

  // Run any pending migrations
  await runMigrations(db);

  return db;
}
