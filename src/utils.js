/**
 * utils.js
 * * Contains reusable helper functions for the application.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE_PATH = path.join(__dirname, 'estiim.db');
const BACKUPS_DIR = path.join(__dirname, 'backups');

/**
 * Calculates the T-shirt size based on the number of hours.
 * @param {Database} db - The database instance.
 * @param {number} hours - The total estimated hours.
 * @returns {Promise<string>} The calculated T-shirt size (e.g., 'XS', 'S', 'M').
 */
export async function getShirtSize(db, hours) {
  console.log('DEBUG: getShirtSize called with hours:', hours);
  const sizes = await db.all('SELECT size, threshold_hours FROM shirt_sizes ORDER BY threshold_hours ASC');
  
  let determinedSize = 'XS'; // Default size
  for (const size of sizes) {
    if (hours >= size.threshold_hours) {
      determinedSize = size.size;
    } else {
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
  }
}

/**
 * Creates a timestamped backup of the database file.
 */
export async function backupDatabase() {
  await ensureBackupDirectory();
  try {
    await fs.access(DB_FILE_PATH, fs.constants.F_OK);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `estiim-db-${timestamp}.bak`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);
    await fs.copyFile(DB_FILE_PATH, backupFilePath);
    console.log(`INFO: Database backed up to: ${backupFilePath}`);
    return backupFileName;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`WARN: Database file not found at ${DB_FILE_PATH}. Skipping backup.`);
    } else {
      console.error(`ERROR: Failed to backup database:`, error);
    }
    throw error;
  }
}

/**
 * Lists all available database backups.
 * @returns {Promise<Array>} Array of backup info objects with filename and timestamp
 */
export async function listBackups() {
  await ensureBackupDirectory();
  const files = await fs.readdir(BACKUPS_DIR);
  const backups = await Promise.all(files
    .filter(file => file.endsWith('.bak'))
    .map(async file => {
      const stats = await fs.stat(path.join(BACKUPS_DIR, file));
      return {
        filename: file,
        timestamp: stats.mtime.toISOString(),
        size: stats.size
      };
    }));
  return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Restores the database from a backup file.
 * @param {string} backupFileName - The name of the backup file to restore from
 */
export async function restoreDatabase(backupFileName) {
  const backupPath = path.join(BACKUPS_DIR, backupFileName);
  try {
    // First verify the backup file exists
    await fs.access(backupPath, fs.constants.F_OK);
    
    // Create a backup of current state before restore
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preRestoreBackup = `estiim-db-prerestore-${timestamp}.bak`;
    await fs.copyFile(DB_FILE_PATH, path.join(BACKUPS_DIR, preRestoreBackup));
    
    // Perform the restore
    await fs.copyFile(backupPath, DB_FILE_PATH);
    console.log(`INFO: Database restored from backup: ${backupFileName}`);
    return true;
  } catch (error) {
    console.error(`ERROR: Failed to restore database from ${backupFileName}:`, error);
    throw error;
  }
}

/**
 * Helper function for deep comparison of hoursPerResourceType objects.
 * @param {object} obj1 - First object to compare.
 * @param {object} obj2 - Second object to compare.
 * @returns {boolean} True if objects are equal, false otherwise.
 */
export function areHoursPerResourceTypeEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  return true;
}
