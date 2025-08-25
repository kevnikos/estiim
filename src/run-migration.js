/**
 * Manual migration runner for resource types audit
 * Run this to manually apply the journal_entries migration
 */
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, 'estiim.db');

async function runMigration() {
    try {
        const db = await open({
            filename: DB_FILE_PATH,
            driver: sqlite3.Database
        });

        console.log('Checking current resource_types table structure...');
        const tableInfo = await db.all(`PRAGMA table_info(resource_types)`);
        console.log('Current columns:', tableInfo.map(col => col.name).join(', '));
        
        const journalEntriesExists = tableInfo.some(col => col.name === 'journal_entries');
        
        if (!journalEntriesExists) {
            console.log('Adding journal_entries column...');
            await db.run('ALTER TABLE resource_types ADD COLUMN journal_entries TEXT');
            console.log('✅ journal_entries column added successfully');
        } else {
            console.log('✅ journal_entries column already exists');
        }

        // Verify the column was added
        const updatedTableInfo = await db.all(`PRAGMA table_info(resource_types)`);
        console.log('Updated columns:', updatedTableInfo.map(col => col.name).join(', '));

        await db.close();
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
