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

/**
 * Adds a new column to an existing table
 * @param {object} db - Database connection
 * @param {string} tableName - Name of the table to modify
 * @param {string} columnName - Name of the column to add
 * @param {string} columnType - SQLite type of the column (e.g., 'INTEGER', 'TEXT')
 */
export async function addColumn(db, tableName, columnName, columnType) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
}

/**
 * Drops a column from a table (Note: SQLite doesn't support DROP COLUMN directly,
 * so this involves creating a new table without the column and copying the data)
 * @param {object} db - Database connection
 * @param {string} tableName - Name of the table to modify
 * @param {string} columnName - Name of the column to drop
 */
export async function dropColumn(db, tableName, columnName) {
    // Get table info
    const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
    
    // Filter out the column we want to drop
    const remainingColumns = tableInfo
        .filter(col => col.name !== columnName)
        .map(col => col.name);

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
        // Create new table without the column
        const columnDefs = tableInfo
            .filter(col => col.name !== columnName)
            .map(col => {
                let def = `${col.name} ${col.type}`;
                if (col.pk) def += ' PRIMARY KEY';
                if (col.notnull) def += ' NOT NULL';
                if (col.dflt_value !== null) def += ` DEFAULT ${col.dflt_value}`;
                return def;
            })
            .join(', ');

        await db.exec(`
            CREATE TABLE ${tableName}_new (${columnDefs});
            INSERT INTO ${tableName}_new 
            SELECT ${remainingColumns.join(', ')} 
            FROM ${tableName};
            DROP TABLE ${tableName};
            ALTER TABLE ${tableName}_new RENAME TO ${tableName};
        `);

        // Commit transaction
        await db.run('COMMIT');
    } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
    }
}
