/**
 * Migration: Add manual_resources column to initiatives table
 * This allows storing manual resource allocations alongside selected factors.
 */

export async function up(db) {
    console.log('Adding manual_resources column to initiatives table...');
    
    // Add manual_resources column to store manual resource hours and values
    await db.run(`
        ALTER TABLE initiatives 
        ADD COLUMN manual_resources TEXT DEFAULT '{}'
    `);
    
    console.log('manual_resources column added successfully.');
}

export async function down(db) {
    console.log('Removing manual_resources column from initiatives table...');
    
    // SQLite doesn't support DROP COLUMN directly, would need table recreation
    // For simplicity, we'll leave the column (it won't hurt to have it)
    console.log('Note: SQLite does not support DROP COLUMN. Column manual_resources will remain.');
}
