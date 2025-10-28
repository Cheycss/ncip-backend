import express from 'express';
import pool from '../database.js';

const router = express.Router();

const parseRequirements = (value) => {
  if (!value) return [];
  try {
    return Array.isArray(value) ? value : JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse requirements JSON:', error.message);
    return [];
  }
};

const mapPurposeRow = (row) => ({
  purpose_id: row.purpose_id,
  name: row.purpose_name || row.name,
  code: row.code || generateCodeFromName(row.purpose_name || row.name),
  description: row.description,
  requirements: parseRequirements(row.requirements),
  created_at: row.created_at,
  updated_at: row.updated_at
});

const generateCodeFromName = (name) => {
  if (!name) return '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
};

const serializeRequirements = (requirements) => {
  if (!requirements) return JSON.stringify([]);
  if (Array.isArray(requirements)) return JSON.stringify(requirements);
  try {
    return JSON.stringify(JSON.parse(requirements));
  } catch (error) {
    return JSON.stringify([]);
  }
};

// GET /api/purposes
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM purposes ORDER BY created_at DESC');
    const purposes = rows.map(mapPurposeRow);
    res.json({ success: true, purposes });
  } catch (error) {
    console.error('Error fetching purposes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch purposes' });
  }
});

// POST /api/purposes
router.post('/', async (req, res) => {
  try {
    const { name, code, description, requirements } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const requirementsJson = serializeRequirements(requirements);
    const generatedCode = code || generateCodeFromName(name);

    const [result] = await pool.query(
      `INSERT INTO purposes (purpose_name, code, description, requirements)
       VALUES (?, ?, ?, ?)` ,
      [name, generatedCode, description || null, requirementsJson]
    );

    const [rows] = await pool.query('SELECT * FROM purposes WHERE purpose_id = ?', [result.insertId]);
    const purpose = mapPurposeRow(rows[0]);

    res.status(201).json({ success: true, purpose });
  } catch (error) {
    console.error('Error creating purpose:', error);
    res.status(500).json({ success: false, message: 'Failed to create purpose' });
  }
});

// PUT /api/purposes/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, requirements } = req.body;

    const [existing] = await pool.query('SELECT * FROM purposes WHERE purpose_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Purpose not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('purpose_name = ?');
      params.push(name);
    }
    if (code !== undefined) {
      updates.push('code = ?');
      params.push(code);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (requirements !== undefined) {
      updates.push('requirements = ?');
      params.push(serializeRequirements(requirements));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    params.push(id);

    await pool.query(`UPDATE purposes SET ${updates.join(', ')} WHERE purpose_id = ?`, params);

    const [rows] = await pool.query('SELECT * FROM purposes WHERE purpose_id = ?', [id]);
    const purpose = mapPurposeRow(rows[0]);

    res.json({ success: true, purpose });
  } catch (error) {
    console.error('Error updating purpose:', error);
    res.status(500).json({ success: false, message: 'Failed to update purpose' });
  }
});

// DELETE /api/purposes/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM purposes WHERE purpose_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Purpose not found' });
    }

    await pool.query('DELETE FROM purposes WHERE purpose_id = ?', [id]);
    res.json({ success: true, message: 'Purpose deleted successfully' });
  } catch (error) {
    console.error('Error deleting purpose:', error);
    res.status(500).json({ success: false, message: 'Failed to delete purpose' });
  }
});

// GET /api/purposes/:id/requirements - Get requirements for a purpose
router.get('/:id/requirements', async (req, res) => {
  try {
    const { id } = req.params;

    // The table uses service_id, not purpose_id
    // For now, we'll use service_id = 1 (Certificate of Confirmation)
    const [requirements] = await pool.query(
      `SELECT 
        requirement_id,
        name as requirement_name,
        description,
        is_mandatory,
        allowed_file_types as file_types_allowed,
        max_file_size_mb
       FROM document_requirements 
       WHERE service_id = 1 AND is_active = TRUE 
       ORDER BY requirement_id`,
      []
    );

    res.json({ 
      success: true, 
      requirements 
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch requirements' });
  }
});

export default router;
