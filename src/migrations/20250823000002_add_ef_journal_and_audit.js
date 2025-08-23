/**
 * Migration: Add journal and audit for estimation factors
 * Version: 20250823000002
 */

export const version = '20250823000002';

export async function up(db) {
    // Add journal_entries column to estimation_factors if it doesn't exist
    const efColumns = await db.all("PRAGMA table_info(estimation_factors)");
    if (!efColumns.find(col => col.name === 'journal_entries')) {
        await db.exec(`
            ALTER TABLE estimation_factors 
            ADD COLUMN journal_entries TEXT;
        `);
    }

    // Add description column to estimation_factors if it doesn't exist
    if (!efColumns.find(col => col.name === 'description')) {
        await db.exec(`
            ALTER TABLE estimation_factors 
            ADD COLUMN description TEXT;
        `);
    }

    // Create estimation_factor_audit table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS estimation_factor_audit (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            old_data TEXT,
            new_data TEXT,
            timestamp TEXT NOT NULL
        );
    `);
}

export async function down(db) {
    // We can't remove columns in SQLite, but we can remove the audit table
    await db.exec('DROP TABLE IF EXISTS estimation_factor_audit;');
}
