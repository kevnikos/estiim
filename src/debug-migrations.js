/**
 * Debug script to check migration status
 */
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function checkMigrationStatus() {
    try {
        console.log(`Checking database at: ${DB_FILE_PATH}`);
        
        const db = await open({
            filename: DB_FILE_PATH,
            driver: sqlite3.Database
        });

        // Check if migrations table exists
        console.log('\n1. Checking if schema_migrations table exists...');
        const migrationTableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
        );
        console.log('Migration table exists:', !!migrationTableExists);

        if (migrationTableExists) {
            // Show all applied migrations
            console.log('\n2. Applied migrations:');
            const appliedMigrations = await db.all('SELECT * FROM schema_migrations ORDER BY id');
            appliedMigrations.forEach(m => {
                console.log(`  - ${m.version} (applied at: ${m.applied_at})`);
            });
        }

        // Check resource_types table structure
        console.log('\n3. Resource types table structure:');
        const tableInfo = await db.all(`PRAGMA table_info(resource_types)`);
        console.log('Columns:', tableInfo.map(col => `${col.name} (${col.type})`).join(', '));
        
        const hasJournalEntries = tableInfo.some(col => col.name === 'journal_entries');
        console.log('Has journal_entries column:', hasJournalEntries);

        // Check if our migration has been applied
        if (migrationTableExists) {
            const ourMigration = await db.get(
                'SELECT * FROM schema_migrations WHERE version = ?',
                '20250824000002'
            );
            console.log('\n4. Our audit migration (20250824000002) status:', !!ourMigration);
        }

        await db.close();
        
    } catch (error) {
        console.error('Error checking migration status:', error);
    }
}

checkMigrationStatus();
