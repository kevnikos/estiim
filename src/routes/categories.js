/**
 * routes/categories.js
 * Handles API routes for managing categories
 */
import express from 'express';

export default function createCategoriesRouter(db) {
    const router = express.Router();

    // GET /api/categories - Get all categories
    router.get('/', async (req, res) => {
        const { query } = req.query;
        let sql = 'SELECT * FROM categories';
        const params = [];

        if (query) {
            sql += ' WHERE name LIKE ?';
            params.push(`%${query}%`);
        }

        sql += ' ORDER BY usage_count DESC, name ASC';
        const categories = await db.all(sql, params);
        res.json(categories);
    });

    // POST /api/categories/recalculate - Recalculate all usage counts
    router.post('/recalculate', async (req, res) => {
        try {
            // First, reset all counts to 0
            await db.run('UPDATE categories SET usage_count = 0, last_used_at = NULL');

            // Get all initiatives with their categories
            const initiatives = await db.all('SELECT categories FROM initiatives WHERE categories IS NOT NULL');

            // Process each initiative's categories
            for (const initiative of initiatives) {
                if (!initiative.categories) continue;

                let categories;
                try {
                    categories = JSON.parse(initiative.categories);
                } catch (e) {
                    console.error('Error parsing categories:', e);
                    continue;
                }

                if (!Array.isArray(categories)) continue;

                // Update usage count and last_used_at for each category
                for (const categoryName of categories) {
                    await db.run(
                        `UPDATE categories 
                         SET usage_count = usage_count + 1,
                             last_used_at = CASE 
                                WHEN last_used_at IS NULL OR last_used_at < CURRENT_TIMESTAMP 
                                THEN CURRENT_TIMESTAMP 
                                ELSE last_used_at 
                             END
                         WHERE name = ?`,
                        [categoryName]
                    );
                }
            }

            // Return the updated categories
            const updatedCategories = await db.all('SELECT * FROM categories ORDER BY usage_count DESC, name ASC');
            res.json(updatedCategories);
        } catch (error) {
            console.error('Error recalculating usage counts:', error);
            res.status(500).json({ message: 'Failed to recalculate usage counts' });
        }
    });

    // POST /api/categories - Create a new category
    router.post('/', async (req, res) => {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        try {
            const now = new Date().toISOString();
            const result = await db.run(
                'INSERT INTO categories (name, created_at, last_used_at, usage_count) VALUES (?, ?, ?, ?)',
                [name.trim(), now, now, 1]
            );
            const newCategory = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
            res.status(201).json(newCategory);
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT') {
                return res.status(409).json({ message: 'Category already exists' });
            }
            throw error;
        }
    });

    // PUT /api/categories/:id - Update a category
    router.put('/:id', async (req, res) => {
        const { id } = req.params;
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        try {
            await db.run(
                'UPDATE categories SET name = ? WHERE id = ?',
                [name.trim(), id]
            );
            const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
            if (!updatedCategory) {
                return res.status(404).json({ message: 'Category not found' });
            }
            res.json(updatedCategory);
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT') {
                return res.status(409).json({ message: 'Category name already exists' });
            }
            throw error;
        }
    });

    // DELETE /api/categories/:id - Delete a category
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        await db.run('DELETE FROM categories WHERE id = ?', [id]);
        res.status(204).send();
    });

    // POST /api/categories/:id/increment - Increment usage count
    router.post('/:id/increment', async (req, res) => {
        const { id } = req.params;
        const now = new Date().toISOString();
        
        await db.run(
            'UPDATE categories SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?',
            [now, id]
        );
        
        const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(updatedCategory);
    });

    return router;
}
