/**
 * Migration to add categories support to initiatives table
 */
import { addColumn, dropColumn } from './migrationUtils.js';

export const version = '20250823000007';

const tableName = 'initiatives';
const columnName = 'categories';

export async function up(db) {
    try {
        // Check if column already exists
        const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
        const columnExists = tableInfo.some(col => col.name === columnName);
        
        if (!columnExists) {
            // Add the categories column as TEXT (will store JSON array of strings)
            await addColumn(db, tableName, columnName, 'TEXT');
            console.log(`[MIGRATION] Added ${columnName} column to ${tableName} table`);

            // Set default value for existing records
            await db.run(`UPDATE ${tableName} SET ${columnName} = '[]'`);
        } else {
            console.log(`[MIGRATION] Column ${columnName} already exists in ${tableName} table, skipping`);
        }

        // Add categories table for lookup and autocomplete
        await db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                last_used_at TEXT,
                usage_count INTEGER DEFAULT 0
            )
        `);

        try {
            // Attempt to add audit entry for the migration
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration', CURRENT_TIMESTAMP, ?)`,
                [tableName, `Added ${columnName} column and categories table for initiative categorization`]
            );
        } catch (auditError) {
            // Log but don't fail the migration if audit logging fails
            console.warn('[MIGRATION] Warning: Could not create audit log entry:', auditError.message);
        }
    } catch (error) {
        console.error('[MIGRATION] Error applying migration:', error);
        throw error;
    }
}

export async function down(db) {
    try {
        // Check if column exists before trying to remove it
        const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
        const columnExists = tableInfo.some(col => col.name === columnName);
        
        if (columnExists) {
            // Remove the categories column
            await dropColumn(db, tableName, columnName);
            console.log(`[MIGRATION] Removed ${columnName} column from ${tableName} table`);
        } else {
            console.log(`[MIGRATION] Column ${columnName} does not exist in ${tableName} table, skipping`);
        }

        // Drop the categories table
        await db.run('DROP TABLE IF EXISTS categories');

        try {
            // Attempt to add audit entry for the rollback
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration_rollback', CURRENT_TIMESTAMP, ?)`,
                [tableName, `Removed ${columnName} column and categories table`]
            );
        } catch (auditError) {
            // Log but don't fail the migration if audit logging fails
            console.warn('[MIGRATION] Warning: Could not create audit log entry:', auditError.message);
        }
    } catch (error) {
        console.error('[MIGRATION] Error rolling back migration:', error);
        throw error;
    }
}
