import express from 'express';
import pool from '../database.js';
import { sendApprovalEmail, sendRejectionEmail } from '../services/emailService.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Submit registration for admin approval (doesn't create user yet)
router.post('/submit', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      display_name,
      email,
      phone_number,
      address,
      ethnicity,
      password,
      birth_certificate_data
    } = req.body;

    // Check if email already exists in users table (approved users)
    const existingUsers = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUsers.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Check if there's already a pending registration with this email
    const pendingUsers = await pool.query(
      'SELECT registration_id FROM pending_registrations WHERE email = $1 AND registration_status = $2',
      [email, 'pending']
    );

    if (pendingUsers.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A registration with this email is already pending approval'
      });
    }

    // Hash password for temporary storage
    const hashedPassword = await bcrypt.hash(password, 12);

    // Store in pending_registrations table
    const result = await pool.query(
      `INSERT INTO pending_registrations (
        username, first_name, last_name, email, phone_number, 
        address, password_hash, registration_status, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING registration_id`,
      [
        email, // username
        first_name,
        last_name,
        email,
        phone_number,
        address,
        hashedPassword,
        'pending'
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Registration submitted successfully! Please wait for admin approval.',
      registration_id: result.rows[0].registration_id
    });

  } catch (error) {
    console.error('Pending registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration submission failed. Please try again.'
    });
  }
});

// Get all pending registrations (for admin)
router.get('/pending', async (req, res) => {
  try {
    const pendingRegistrations = await pool.query(
      `SELECT registration_id, username, first_name, last_name, email, phone_number, 
              address, registration_status, submitted_at
       FROM pending_registrations 
       WHERE registration_status = $1 
       ORDER BY submitted_at DESC`,
      ['pending']
    );

    res.json({
      success: true,
      registrations: pendingRegistrations.rows
    });

  } catch (error) {
    console.error('Get pending registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending registrations'
    });
  }
});

// Approve registration (create actual user account)
router.post('/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get pending registration
    const pendingRegistrations = await pool.query(
      'SELECT * FROM pending_registrations WHERE registration_id = $1 AND registration_status = $2',
      [id, 'pending']
    );

    if (pendingRegistrations.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending registration not found'
      });
    }

    const registration = pendingRegistrations.rows[0];

    // Check if email already exists in users table (double-check)
    const existingUsers = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [registration.email]
    );

    if (existingUsers.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create actual user account
    const userResult = await pool.query(
      `INSERT INTO users (
        username, first_name, last_name, email, phone_number, 
        address, password_hash, role, is_approved, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING user_id`,
      [
        registration.email, // Use email as username
        registration.first_name,
        registration.last_name,
        registration.email,
        registration.phone_number,
        registration.address,
        registration.password_hash,
        'user',
        true,
        true
      ]
    );

    // Update pending registration status
    await pool.query(
      'UPDATE pending_registrations SET registration_status = $1, processed_at = NOW() WHERE registration_id = $2',
      ['approved', id]
    );

    // Send approval email
    try {
      await sendApprovalEmail(
        registration.email,
        `${registration.first_name} ${registration.last_name}`
      );
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Continue even if email fails
    }

    res.json({
      success: true,
      message: 'Registration approved successfully',
      user_id: userResult.rows[0].user_id
    });

  } catch (error) {
    console.error('Approve registration error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    let errorMessage = 'Failed to approve registration';
    if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = 'User with this email already exists';
    } else if (error.code === 'ER_DATA_TOO_LONG') {
      errorMessage = 'Data too long for database field';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      details: error.message
    });
  }
});

// Reject registration with comment
router.post('/reject/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection comment is required'
      });
    }

    // Get pending registration
    const pendingRegistrations = await pool.query(
      'SELECT * FROM pending_registrations WHERE registration_id = $1 AND registration_status = $2',
      [id, 'pending']
    );

    if (pendingRegistrations.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending registration not found'
      });
    }

    const registration = pendingRegistrations.rows[0];

    // Update pending registration status with rejection comment
    await pool.query(
      'UPDATE pending_registrations SET registration_status = $1, processed_at = NOW() WHERE registration_id = $2',
      ['rejected', id]
    );

    // Send rejection email with admin comment
    try {
      await sendRejectionEmail(
        registration.email,
        `${registration.first_name} ${registration.last_name}`,
        comment.trim()
      );
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Continue even if email fails
    }

    res.json({
      success: true,
      message: 'Registration rejected successfully'
    });

  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject registration'
    });
  }
});

// Get registration status by email (for user to check)
router.get('/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Check if user exists (approved)
    const existingUsers = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUsers.rows.length > 0) {
      return res.json({
        success: true,
        status: 'approved',
        message: 'Account has been approved and is active'
      });
    }

    // Check pending registration
    const pendingRegistrations = await pool.query(
      'SELECT registration_status, submitted_at, processed_at FROM pending_registrations WHERE email = $1 ORDER BY submitted_at DESC LIMIT 1',
      [email]
    );

    if (pendingRegistrations.rows.length === 0) {
      return res.json({
        success: true,
        status: 'not_found',
        message: 'No registration found for this email'
      });
    }

    const registration = pendingRegistrations.rows[0];

    res.json({
      success: true,
      status: registration.registration_status,
      message: registration.registration_status === 'pending' 
        ? 'Registration is pending admin approval'
        : registration.registration_status === 'rejected'
        ? 'Registration was rejected'
        : 'Registration status updated',
      submitted_at: registration.submitted_at,
      rejected_at: registration.rejected_at
    });

  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check registration status'
    });
  }
});

export default router;
