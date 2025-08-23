/**
 * Migration utilities for handling database schema upgrades
 */

/**
 * Creates the migrations table if it doesn't exist
 * @param {object} db - Database connection
 */
export async function initMigrationsTable(db) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT NOT NULL UNIQUE,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

/**
 * Gets the current schema version from the migrations table
 * @param {object} db - Database connection
 * @returns {string} Current schema version
 */
export async function getCurrentVersion(db) {
    try {
        const result = await db.get(
            'SELECT version FROM schema_migrations ORDER BY id DESC LIMIT 1'
        );
        return result ? result.version : '0';
    } catch (err) {
        console.error('Error getting current version:', err);
        return '0';
    }
}

/**
 * Records a migration as being applied
 * @param {object} db - Database connection
 * @param {string} version - Version number of the migration
 */
export async function recordMigration(db, version) {
    await db.run(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        version
    );
}

/**
 * Checks if a specific migration has been applied
 * @param {object} db - Database connection
 * @param {string} version - Version to check
 * @returns {boolean} Whether the migration has been applied
 */
export async function hasBeenApplied(db, version) {
    const result = await db.get(
        'SELECT 1 FROM schema_migrations WHERE version = ?',
        version
    );
    return !!result;
}
