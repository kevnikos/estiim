/**
 * Migration to add resource_category and resource_cost columns to resource_types table
 */
import { addColumn } from './migrationUtils.js';

export const version = '20250824000001';

export async function up(db) {
    try {
        // Check if columns already exist
        const tableInfo = await db.all(`PRAGMA table_info(resource_types)`);
        const resourceCategoryExists = tableInfo.some(col => col.name === 'resource_category');
        const resourceCostExists = tableInfo.some(col => col.name === 'resource_cost');

        if (!resourceCategoryExists) {
            // Add the resource_category column (TEXT, nullable, default to 'Labour')
            await addColumn(db, 'resource_types', 'resource_category', 'TEXT DEFAULT "Labour"');
            console.log('[MIGRATION] Added resource_category column to resource_types table');
        } else {
            console.log('[MIGRATION] Column resource_category already exists in resource_types table, skipping');
        }

        if (!resourceCostExists) {
            // Add the resource_cost column (REAL, nullable)
            await addColumn(db, 'resource_types', 'resource_cost', 'REAL');
            console.log('[MIGRATION] Added resource_cost column to resource_types table');
        } else {
            console.log('[MIGRATION] Column resource_cost already exists in resource_types table, skipping');
        }

        try {
            // Attempt to add audit entry for the migration
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration', CURRENT_TIMESTAMP, ?)`,
                ['resource_types', 'Added resource_category and resource_cost columns']
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
        // Drop the added columns
        await db.run(`ALTER TABLE resource_types DROP COLUMN resource_category`);
        await db.run(`ALTER TABLE resource_types DROP COLUMN resource_cost`);
        console.log('[MIGRATION] Dropped resource_category and resource_cost columns from resource_types table');

        try {
            // Attempt to add audit entry for the rollback
            await db.run(
                `INSERT INTO audit_log (table_name, action, timestamp, details)
                VALUES (?, 'migration_rollback', CURRENT_TIMESTAMP, ?)`,
                ['resource_types', 'Dropped resource_category and resource_cost columns']
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
