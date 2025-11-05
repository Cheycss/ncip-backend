import express from 'express';
import bcrypt from 'bcryptjs';
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

// POST /api/users - Create a new user (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      username,
      password,
      role = 'user',
      phone_number,
      address
    } = req.body;

    if (!first_name || !last_name || !email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'first_name, last_name, email, username, and password are required'
      });
    }

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role provided'
      });
    }

    const existing = await pool.query(
      `SELECT user_id FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
      [email, username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with the provided email or username already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, username, password_hash, role, phone_number, address, is_approved) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE) RETURNING user_id`,
      [first_name, last_name, email, username, password_hash, role, phone_number, address]
    );

    const rows = await pool.query(
      `SELECT user_id, username, first_name, last_name, email, role, is_active, is_approved, phone_number, address, created_at, updated_at
       FROM users WHERE user_id = $1`,
      [result.rows[0].user_id]
    );

    res.status(201).json({ success: true, user: rows.rows[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// GET /api/users - Fetch all users (admin only)
router.get('/', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const rows = await pool.query(
      `SELECT user_id, username, first_name, last_name, email, role, is_active, is_approved,
              phone_number, address, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({ success: true, users: rows.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// PUT /api/users/:id - Update user details (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      username,
      password,
      role,
      phone_number,
      address,
      is_active,
      is_approved
    } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      params.push(first_name);
      paramIndex++;
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      params.push(last_name);
      paramIndex++;
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
    }
    if (username !== undefined) {
      updates.push(`username = $${paramIndex}`);
      params.push(username);
      paramIndex++;
    }
    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role provided' });
      }
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    if (phone_number !== undefined) {
      updates.push(`phone_number = $${paramIndex}`);
      params.push(phone_number);
      paramIndex++;
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex}`);
      params.push(address);
      paramIndex++;
    }
    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }
    if (typeof is_approved === 'boolean') {
      updates.push(`is_approved = $${paramIndex}`);
      params.push(is_approved);
      paramIndex++;
    }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      updates.push(`password_hash = $${paramIndex}`);
      params.push(password_hash);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`, params);

    const rows = await pool.query(
      `SELECT user_id, username, first_name, last_name, email, role, is_active, is_approved, phone_number, address, created_at, updated_at
       FROM users WHERE user_id = $1`,
      [id]
    );

    res.json({ success: true, user: rows.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// PUT /api/users/:id/status - Toggle or set user active status (admin only)
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const existing = await pool.query('SELECT is_active FROM users WHERE user_id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let newStatus;
    if (typeof is_active === 'boolean') {
      newStatus = is_active;
    } else {
      newStatus = !existing.rows[0].is_active;
    }

    await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE user_id = $2', [newStatus, id]);

    res.json({ success: true, message: 'User status updated successfully', is_active: newStatus });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM users WHERE user_id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

export default router;
