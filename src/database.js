/**
 * database.js
 * * Manages SQLite database connection and schema setup.
 */
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define database file path
const DB_FILE_PATH = path.join(__dirname, 'estiim.db');

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

    CREATE TABLE IF NOT EXISTS shirt_size_audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
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
    console.log('INFO: Default shirt sizes seeded.');
  }

  return db;
}
