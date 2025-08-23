/**
 * Migration: Add build info table
 * Version: 20250823000001
 */

export const version = '20250823000001';

export async function up(db) {
    // Create the build_info table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS build_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            build_number TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Insert initial build number
    await db.run(
        'INSERT INTO build_info (build_number) VALUES (?)',
        'R20250804161100'
    );
}

export async function down(db) {
    await db.exec('DROP TABLE IF EXISTS build_info;');
}
