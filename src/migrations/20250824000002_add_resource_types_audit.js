/**
 * Migration to add journal_entries column to resource_types table for audit trail
 */
import { addColumn } from './migrationUtils.js';

export const version = '20250824000002';

export async function up(db) {
    try {
        // Check if column already exists
        const tableInfo = await db.all(`PRAGMA table_info(resource_types)`);
        const journalEntriesExists = tableInfo.some(col => col.name === 'journal_entries');

        if (!journalEntriesExists) {
            // Add the journal_entries column (TEXT, nullable)
            await addColumn(db, 'resource_types', 'journal_entries', 'TEXT');
            console.log('[MIGRATION] Added journal_entries column to resource_types table');
        } else {
            console.log('[MIGRATION] Column journal_entries already exists in resource_types table, skipping');
        }

        try {
            // Attempt to add audit entry for the migration
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration', CURRENT_TIMESTAMP, ?)`,
                ['resource_types', 'Added journal_entries column for audit trail']
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
        // Drop the journal_entries column
        await db.run(`ALTER TABLE resource_types DROP COLUMN journal_entries`);
        console.log('[MIGRATION] Dropped journal_entries column from resource_types table');

        try {
            // Attempt to add audit entry for the rollback
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration_rollback', CURRENT_TIMESTAMP, ?)`,
                ['resource_types', 'Dropped journal_entries column']
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
