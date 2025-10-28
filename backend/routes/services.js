import express from 'express';
import pool from '../database.js';

const router = express.Router();

const parseRequirements = (value) => {
  if (!value) return [];
  try {
    if (Array.isArray(value)) return value;
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse requirements JSON:', error.message);
    return [];
  }
};

// Fetch all services with optional status filter
router.get('/', async (req, res) => {
  try {
    const { is_active } = req.query;
    let query = 'SELECT * FROM services';
    const params = [];

    if (is_active !== undefined) {
      query += ' WHERE is_active = ?';
      params.push(is_active === 'true' || is_active === true);
    }

    query += ' ORDER BY created_at DESC';
    const [services] = await pool.query(query, params);

    res.json({ success: true, services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
});

// Create a new service
router.post('/', async (req, res) => {
  try {
    const { service_code, service_name, description, requirements, processing_time, is_active = true } = req.body;

    if (!service_code || !service_name) {
      return res.status(400).json({ success: false, message: 'Service code and name are required' });
    }

    const requirementsJson = requirements ? JSON.stringify(requirements) : null;

    const [result] = await pool.query(
      `INSERT INTO services (service_code, service_name, description, requirements, processing_time, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [service_code, service_name, description, requirementsJson, processing_time, is_active]
    );

    const [newServiceRows] = await pool.query(
      'SELECT * FROM services WHERE service_id = ?',
      [result.insertId]
    );

    res.status(201).json({ success: true, service: newServiceRows[0] });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ success: false, message: 'Failed to create service' });
  }
});

// Update a service
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, status } = req.body;

    const [existingRows] = await pool.query(
      'SELECT * FROM service_catalog WHERE service_id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await pool.query(
      `UPDATE service_catalog
       SET code = COALESCE(?, code),
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           status = COALESCE(?, status)
       WHERE service_id = ?`,
      [code, name, description, status, id]
    );

    const [updatedRows] = await pool.query(
      'SELECT * FROM service_catalog WHERE service_id = ?',
      [id]
    );

    res.json({ success: true, service: updatedRows[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ success: false, message: 'Failed to update service' });
  }
});

// Delete a service
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existingRows] = await pool.query(
      'SELECT * FROM service_catalog WHERE service_id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await pool.query('DELETE FROM service_catalog WHERE service_id = ?', [id]);

    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ success: false, message: 'Failed to delete service' });
  }
});

// Purposes
router.get('/:id/purposes', async (req, res) => {
  try {
    const { id } = req.params;

    const [purposes] = await pool.query(
      'SELECT * FROM service_purposes WHERE service_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json({ success: true, purposes });
  } catch (error) {
    console.error('Error fetching service purposes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service purposes' });
  }
});

router.post('/:id/purposes', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, is_default = false } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const [serviceRows] = await pool.query(
      'SELECT service_id FROM service_catalog WHERE service_id = ?',
      [id]
    );

    if (serviceRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const [result] = await pool.query(
      `INSERT INTO service_purposes (service_id, title, description, is_default)
       VALUES (?, ?, ?, ?)`,
      [id, title, description, is_default]
    );

    const [newPurposeRows] = await pool.query(
      'SELECT * FROM service_purposes WHERE purpose_id = ?',
      [result.insertId]
    );

    res.status(201).json({ success: true, purpose: newPurposeRows[0] });
  } catch (error) {
    console.error('Error creating service purpose:', error);
    res.status(500).json({ success: false, message: 'Failed to create service purpose' });
  }
});

router.put('/purposes/:purposeId', async (req, res) => {
  try {
    const { purposeId } = req.params;
    const { title, description, is_default } = req.body;

    const [existingRows] = await pool.query(
      'SELECT * FROM service_purposes WHERE purpose_id = ?',
      [purposeId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purpose not found' });
    }

    await pool.query(
      `UPDATE service_purposes
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           is_default = COALESCE(?, is_default)
       WHERE purpose_id = ?`,
      [title, description, is_default, purposeId]
    );

    const [updatedRows] = await pool.query(
      'SELECT * FROM service_purposes WHERE purpose_id = ?',
      [purposeId]
    );

    res.json({ success: true, purpose: updatedRows[0] });
  } catch (error) {
    console.error('Error updating service purpose:', error);
    res.status(500).json({ success: false, message: 'Failed to update service purpose' });
  }
});

router.delete('/purposes/:purposeId', async (req, res) => {
  try {
    const { purposeId } = req.params;

    const [existingRows] = await pool.query(
      'SELECT * FROM service_purposes WHERE purpose_id = ?',
      [purposeId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purpose not found' });
    }

    await pool.query('DELETE FROM service_purposes WHERE purpose_id = ?', [purposeId]);

    res.json({ success: true, message: 'Purpose deleted successfully' });
  } catch (error) {
    console.error('Error deleting service purpose:', error);
    res.status(500).json({ success: false, message: 'Failed to delete service purpose' });
  }
});

export default router;
