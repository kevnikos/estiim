/**
 * Routes for managing dropdown options (status, type, priority)
 */
import express from 'express';

export default function createDropdownOptionsRouter(db) {
    const router = express.Router();

    // Get all dropdown options across all categories
    router.get('/', async (req, res) => {
        try {
            const status = await db.all(
                'SELECT value FROM dropdown_options WHERE category = ? ORDER BY value',
                'status'
            );
            const type = await db.all(
                'SELECT value FROM dropdown_options WHERE category = ? ORDER BY value',
                'type'
            );
            const priority = await db.all(
                'SELECT value FROM dropdown_options WHERE category = ? ORDER BY value',
                'priority'
            );
        
        res.json({
            status: status.map(s => s.value),
            type: type.map(t => t.value),
            priority: priority.map(p => p.value)
        });
    } catch (error) {
        console.error('Error fetching dropdown options:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get options for a specific category
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const options = await db.all(
            'SELECT * FROM dropdown_options WHERE category = ? ORDER BY value',
            category
        );
        res.json(options);
    } catch (error) {
        console.error('Error fetching dropdown options:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add a new option
router.post('/', async (req, res) => {
    try {
        const { category, value } = req.body;
        
        if (!category || !value) {
            return res.status(400).json({ error: 'Category and value are required' });
        }

        // Check if option already exists
        const exists = await db.get(
            'SELECT 1 FROM dropdown_options WHERE category = ? AND value = ?',
            category, value
        );
        
        if (exists) {
            return res.status(400).json({ error: 'Option already exists' });
        }

        await db.run(
            'INSERT INTO dropdown_options (category, value, created_at) VALUES (?, ?, datetime())',
            category, value
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding dropdown option:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update an option
router.put('/', async (req, res) => {
    try {
        const { category, oldValue, newValue } = req.body;
        
        if (!category || !oldValue || !newValue) {
            return res.status(400).json({ error: 'Category, oldValue, and newValue are required' });
        }

        // Check if new value already exists
        const exists = await db.get(
            'SELECT 1 FROM dropdown_options WHERE category = ? AND value = ?',
            category, newValue
        );
        
        if (exists) {
            return res.status(400).json({ error: 'Option already exists' });
        }

        await db.run(
            'UPDATE dropdown_options SET value = ?, updated_at = datetime() WHERE category = ? AND value = ?',
            newValue, category, oldValue
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating dropdown option:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete an option
router.delete('/', async (req, res) => {
    try {
        const { category, value } = req.body;
        
        if (!category || !value) {
            return res.status(400).json({ error: 'Category and value are required' });
        }

        await db.run(
            'DELETE FROM dropdown_options WHERE category = ? AND value = ?',
            category, value
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting dropdown option:', error);
        res.status(500).json({ error: error.message });
    }
});

    return router;
}
