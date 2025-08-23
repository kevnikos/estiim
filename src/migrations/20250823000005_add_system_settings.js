/**
 * Migration: Add system settings table
 * Version: 20250823000005
 */

export const version = '20250823000005';

export async function up(db) {
    // Create system_settings table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Insert default backup frequency
    await db.run(
        'INSERT INTO system_settings (key, value) VALUES (?, ?)',
        ['backup_frequency_minutes', '30']
    );
}

export async function down(db) {
    await db.exec('DROP TABLE IF EXISTS system_settings;');
}
