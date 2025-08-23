/**
 * Migration: Add created_at to dropdown options
 * Version: 20250823000004
 */

export const version = '20250823000004';

export async function up(db) {
    // Add created_at column to dropdown_options if it doesn't exist
    const columns = await db.all("PRAGMA table_info(dropdown_options)");
    if (!columns.find(col => col.name === 'created_at')) {
        await db.exec(`
            ALTER TABLE dropdown_options 
            ADD COLUMN created_at TEXT;
        `);

        // Update existing records to have a created_at timestamp
        await db.run(`
            UPDATE dropdown_options 
            SET created_at = datetime()
            WHERE created_at IS NULL
        `);
    }
}

export async function down(db) {
    // Cannot remove columns in SQLite
}
