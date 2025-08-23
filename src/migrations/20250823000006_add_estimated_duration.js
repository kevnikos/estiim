/**
 * Migration to add estimated_duration column to initiatives table
 */
import { addColumn, dropColumn } from './migrationUtils.js';

export const version = '20250823000006';

const tableName = 'initiatives';
const columnName = 'estimated_duration';

export async function up(db) {
    try {
        // Check if column already exists
        const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
        const columnExists = tableInfo.some(col => col.name === columnName);
        
        if (!columnExists) {
            // Add the estimated_duration column (integer, nullable)
            await addColumn(db, tableName, columnName, 'INTEGER');
            console.log(`[MIGRATION] Added ${columnName} column to ${tableName} table`);
        } else {
            console.log(`[MIGRATION] Column ${columnName} already exists in ${tableName} table, skipping`);
        }

        try {
            // Attempt to add audit entry for the migration
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration', CURRENT_TIMESTAMP, ?)`,
                [tableName, `Added ${columnName} column to track initiative duration in months`]
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
            // Remove the estimated_duration column
            await dropColumn(db, tableName, columnName);
            console.log(`[MIGRATION] Removed ${columnName} column from ${tableName} table`);
        } else {
            console.log(`[MIGRATION] Column ${columnName} does not exist in ${tableName} table, skipping`);
        }

        try {
            // Attempt to add audit entry for the rollback
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration_rollback', CURRENT_TIMESTAMP, ?)`,
                [tableName, `Removed ${columnName} column`]
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
