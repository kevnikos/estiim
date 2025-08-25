/**
 * Migration to add value_per_resource_type column to estimation_factors table
 * This will store non-labour resource values separately from labour hours
 */
import { addColumn } from './migrationUtils.js';

export const version = '20250824000003';

export async function up(db) {
    try {
        // Check if column already exists
        const tableInfo = await db.all(`PRAGMA table_info(estimation_factors)`);
        const valuePerResourceTypeExists = tableInfo.some(col => col.name === 'value_per_resource_type');

        if (!valuePerResourceTypeExists) {
            // Add the value_per_resource_type column (TEXT, nullable)
            await addColumn(db, 'estimation_factors', 'value_per_resource_type', 'TEXT');
            console.log('[MIGRATION] Added value_per_resource_type column to estimation_factors table');
        } else {
            console.log('[MIGRATION] Column value_per_resource_type already exists in estimation_factors table, skipping');
        }

        try {
            // Attempt to add audit entry for the migration
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration', CURRENT_TIMESTAMP, ?)`,
                ['estimation_factors', 'Added value_per_resource_type column for non-labour resource values']
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
        // Drop the value_per_resource_type column
        await db.run(`ALTER TABLE estimation_factors DROP COLUMN value_per_resource_type`);
        console.log('[MIGRATION] Dropped value_per_resource_type column from estimation_factors table');

        try {
            // Attempt to add audit entry for the rollback
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration_rollback', CURRENT_TIMESTAMP, ?)`,
                ['estimation_factors', 'Dropped value_per_resource_type column']
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
