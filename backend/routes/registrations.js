import express from 'express';
import pool from '../database.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.'
    });
  }
  next();
};

// GET /api/registrations - Get all registrations
router.get('/', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const rows = await pool.query(
      `SELECT * FROM user_registrations ORDER BY submitted_at DESC`
    );
    res.json({ success: true, registrations: rows.rows });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch registrations' });
  }
});

// GET /api/registrations/pending
router.get('/pending', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const rows = await pool.query(
      `SELECT * FROM user_registrations WHERE registration_status = 'pending' ORDER BY submitted_at ASC`
    );

    res.json({ success: true, registrations: rows.rows });
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending registrations' });
  }
});

// POST /api/registrations/:id/approve
router.post('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const registrationId = req.params.id;
    const adminId = req.user.user_id;

    await client.query('BEGIN');

    // Fetch pending registration
    const registrations = await client.query(
      `SELECT * FROM user_registrations WHERE registration_id = $1 FOR UPDATE`,
      [registrationId]
    );

    if (registrations.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    const registration = registrations.rows[0];

    const existingUsers = await client.query(
      `SELECT user_id FROM users WHERE email = $1 LIMIT 1`,
      [registration.email]
    );

    if (existingUsers.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    if (registration.registration_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Registration is not pending' });
    }

    const username = registration.email.split('@')[0];

    const userResult = await client.query(
      `INSERT INTO users (username, first_name, last_name, email, password_hash, role, is_active, is_approved, phone_number, address)
       VALUES ($1, $2, $3, $4, $5, 'user', TRUE, TRUE, $6, $7) RETURNING user_id`,
      [
        username,
        registration.first_name,
        registration.last_name,
        registration.email,
        registration.password_hash,
        registration.phone_number,
        registration.address
      ]
    );

    await client.query(
      `UPDATE user_registrations SET registration_status = 'approved', processed_by = $1, processed_at = NOW()
       WHERE registration_id = $2`,
      [adminId, registrationId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Registration approved successfully',
      user_id: userResult.rows[0].user_id
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving registration:', error);
    res.status(500).json({ success: false, message: 'Failed to approve registration' });
  } finally {
    client.release();
  }
});

// POST /api/registrations/:id/reject
router.post('/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const registrationId = req.params.id;
    const adminId = req.user.user_id;
    const result = await pool.query(
      `UPDATE user_registrations SET registration_status = 'rejected', processed_by = $1
       WHERE registration_id = $2 AND registration_status = 'pending'`,
      [adminId, registrationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pending registration not found' });
    }

    res.json({ success: true, message: 'Registration rejected successfully' });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({ success: false, message: 'Failed to reject registration' });
  }
});

export default router;
