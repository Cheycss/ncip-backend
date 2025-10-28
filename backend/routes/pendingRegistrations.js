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
    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Check if there's already a pending registration with this email
    const [pendingUsers] = await pool.execute(
      'SELECT id FROM pending_registrations WHERE email = ? AND status = "pending"',
      [email]
    );

    if (pendingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A registration with this email is already pending approval'
      });
    }

    // Hash password for temporary storage
    const hashedPassword = await bcrypt.hash(password, 12);

    // Store in pending_registrations table
    const [result] = await pool.execute(
      `INSERT INTO pending_registrations (
        first_name, last_name, display_name, email, phone_number, 
        address, ethnicity, password_hash, birth_certificate_data, 
        status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        first_name,
        last_name,
        display_name,
        email,
        phone_number,
        address,
        ethnicity,
        hashedPassword,
        birth_certificate_data
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Registration submitted successfully! Please wait for admin approval.',
      registration_id: result.insertId
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
    const [pendingRegistrations] = await pool.execute(
      `SELECT id, first_name, last_name, display_name, email, phone_number, 
              address, ethnicity, birth_certificate_data, submitted_at
       FROM pending_registrations 
       WHERE status = 'pending' 
       ORDER BY submitted_at DESC`
    );

    res.json({
      success: true,
      registrations: pendingRegistrations
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
    const [pendingRegistrations] = await pool.execute(
      'SELECT * FROM pending_registrations WHERE id = ? AND status = "pending"',
      [id]
    );

    if (pendingRegistrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending registration not found'
      });
    }

    const registration = pendingRegistrations[0];

    // Check if email already exists in users table (double-check)
    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [registration.email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create actual user account
    const [userResult] = await pool.execute(
      `INSERT INTO users (
        username, first_name, last_name, email, phone_number, 
        address, password_hash, role, is_approved, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 1, 1)`,
      [
        registration.email, // Use email as username
        registration.first_name,
        registration.last_name,
        registration.email,
        registration.phone_number,
        registration.address,
        registration.password_hash
      ]
    );

    // Update pending registration status
    await pool.execute(
      'UPDATE pending_registrations SET status = "approved", approved_at = NOW() WHERE id = ?',
      [id]
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
      user_id: userResult.insertId
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
    const [pendingRegistrations] = await pool.execute(
      'SELECT * FROM pending_registrations WHERE id = ? AND status = "pending"',
      [id]
    );

    if (pendingRegistrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending registration not found'
      });
    }

    const registration = pendingRegistrations[0];

    // Update pending registration status with rejection comment
    await pool.execute(
      'UPDATE pending_registrations SET status = "rejected", rejection_comment = ?, rejected_at = NOW() WHERE id = ?',
      [comment.trim(), id]
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
    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.json({
        success: true,
        status: 'approved',
        message: 'Account has been approved and is active'
      });
    }

    // Check pending registration
    const [pendingRegistrations] = await pool.execute(
      'SELECT status, rejection_comment, submitted_at, rejected_at FROM pending_registrations WHERE email = ? ORDER BY submitted_at DESC LIMIT 1',
      [email]
    );

    if (pendingRegistrations.length === 0) {
      return res.json({
        success: true,
        status: 'not_found',
        message: 'No registration found for this email'
      });
    }

    const registration = pendingRegistrations[0];

    res.json({
      success: true,
      status: registration.status,
      message: registration.status === 'pending' 
        ? 'Registration is pending admin approval'
        : registration.status === 'rejected'
        ? 'Registration was rejected'
        : 'Registration status updated',
      rejection_comment: registration.rejection_comment,
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
