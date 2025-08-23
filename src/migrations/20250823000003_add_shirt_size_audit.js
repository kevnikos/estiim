/**
 * Migration: Add shirt size audit table
 * Version: 20250823000003
 */

export const version = '20250823000003';

export async function up(db) {
    // Create shirt_size_audit table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS shirt_size_audit (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            old_data TEXT,
            new_data TEXT,
            timestamp TEXT NOT NULL
        );
    `);
}

export async function down(db) {
    await db.exec('DROP TABLE IF EXISTS shirt_size_audit;');
}
