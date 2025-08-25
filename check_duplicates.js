const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./src/estiim.db');

// Check for existing factors with "Copy" in name
db.all('SELECT name FROM estimation_factors WHERE name LIKE "%Copy%"', (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Factors with Copy in name:');
        rows.forEach(r => console.log(r.name));
    }
    
    // Check table schema
    db.all('PRAGMA table_info(estimation_factors)', (err2, schema) => {
        if (err2) {
            console.error(err2);
        } else {
            console.log('\nTable schema:');
            schema.forEach(col => {
                console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
            });
        }
        
        // Check for unique constraints
        db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='estimation_factors'", (err3, tables) => {
            if (err3) {
                console.error(err3);
            } else {
                console.log('\nTable creation SQL:');
                tables.forEach(t => console.log(t.sql));
            }
            db.close();
        });
    });
});
