import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../database.js';
import { sendRegistrationVerificationCode } from '../services/emailService.js';

const router = express.Router();

// Admin sends verification code for new user creation
router.post('/send-user-verification', async (req, res) => {
  try {
    const { email, firstName } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if email already exists
    const existingUsers = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUsers.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'A user with this email already exists' 
      });
    }

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete any existing unused codes (no user_id yet, store in temp way)
    // Note: For admin creation, we can't use user_id since user doesn't exist yet
    // We'll use a workaround: store with user_id = NULL and email in code field prefix
    await pool.query(
      'DELETE FROM verification_codes WHERE user_id IS NULL AND code_type = $1 AND is_used = FALSE',
      ['admin_create:' + email]
    );

    // Insert new verification code
    const result = await pool.query(
      'INSERT INTO verification_codes (user_id, code, code_type, expires_at) VALUES (NULL, $1, $2, $3) RETURNING code_id',
      [code, 'admin_create:' + email, expiresAt]
    );
    
    // Send verification code via email
    const emailResult = await sendRegistrationVerificationCode(
      email, 
      code, 
      firstName
    );

    if (!emailResult.success) {
      // If email fails, delete the verification code
      await pool.query(
        'DELETE FROM verification_codes WHERE code_id = $1',
        [result.rows[0].code_id]
      );
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send verification email. Please try again.' 
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent to the user\'s email address',
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email for security
      expiresIn: '15 minutes'
    });

  } catch (error) {
    console.error('Send admin user verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again.' 
    });
  }
});

// Admin verifies code and creates user
router.post('/verify-and-create-user', async (req, res) => {
  try {
    const { 
      email, 
      code, 
      firstName, 
      lastName, 
      displayName, 
      phoneNumber, 
      address, 
      ethnicity, 
      role,
      status,
      tempPassword 
    } = req.body;

    // Validate required fields
    if (!email || !code || !firstName || !lastName || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, code, first name, last name, and role are required' 
      });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code must be 6 digits' 
      });
    }

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role specified' 
      });
    }

    // Find valid verification code
    const verificationRecords = await pool.query(
      'SELECT * FROM verification_codes WHERE code = $1 AND code_type = $2 AND is_used = FALSE',
      [code, 'admin_create:' + email]
    );
    
    if (verificationRecords.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification code' 
      });
    }

    const verificationRecord = verificationRecords.rows[0];

    // Check if code is expired
    if (new Date() > new Date(verificationRecord.expires_at)) {
      await pool.query(
        'DELETE FROM verification_codes WHERE code_id = $1',
        [verificationRecord.code_id]
      );
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new one.' 
      });
    }

    // Check if email already exists (double check)
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'A user with this email already exists' 
      });
    }

    // Generate temporary password if not provided
    const password = tempPassword || Math.random().toString(36).slice(-8) + 'A1!';
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user (admin-created users are automatically approved)
    const userResult = await pool.query(
      `INSERT INTO users (
        username, first_name, last_name, email, phone_number, 
        address, password_hash, role, is_approved, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING user_id`,
      [
        email, // Use email as username
        firstName,
        lastName,
        email,
        phoneNumber || null,
        address || null,
        hashedPassword,
        role || 'user',
        true, // Admin-created users are automatically approved
        true  // Active by default
      ]
    );

    // Mark verification code as used
    await pool.query(
      'UPDATE verification_codes SET is_used = TRUE WHERE code_id = $1',
      [verificationRecord.code_id]
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User created successfully!',
      user: {
        id: userResult.rows[0].user_id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        username: email,
        role: role || 'user',
        is_approved: true,
        is_active: true
      },
      ...(tempPassword ? {} : { temporaryPassword: password }) // Only return if we generated it
    });

  } catch (error) {
    console.error('Admin verify and create user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'User creation failed. Please try again.' 
    });
  }
});

// Resend verification code for admin user creation
router.post('/resend-user-verification', async (req, res) => {
  try {
    const { email, firstName } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'A user with this email already exists' 
      });
    }

    // Generate new verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    // Delete old codes
    await pool.query(
      'DELETE FROM verification_codes WHERE user_id IS NULL AND code_type = $1 AND is_used = FALSE',
      ['admin_create:' + email]
    );
    
    // Insert new code
    const result = await pool.query(
      'INSERT INTO verification_codes (user_id, code, code_type, expires_at) VALUES (NULL, $1, $2, $3) RETURNING code_id',
      [code, 'admin_create:' + email, expiresAt]
    );
    
    // Send new code
    const emailResult = await sendRegistrationVerificationCode(
      email, 
      code, 
      firstName
    );

    if (!emailResult.success) {
      await pool.query(
        'DELETE FROM verification_codes WHERE code_id = $1',
        [result.rows[0].code_id]
      );
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send verification email. Please try again.' 
      });
    }

    res.json({
      success: true,
      message: 'New verification code sent to the user\'s email'
    });

  } catch (error) {
    console.error('Resend admin user verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again.' 
    });
  }
});

export default router;
