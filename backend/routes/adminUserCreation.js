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
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'A user with this email already exists' 
      });
    }

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete any existing unused codes for this email and type
    await pool.execute(
      'DELETE FROM verification_codes WHERE email = ? AND type = ? AND used = FALSE',
      [email, 'admin_create']
    );

    // Insert new verification code
    const [result] = await pool.execute(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, 'admin_create', expiresAt]
    );
    
    // Send verification code via email
    const emailResult = await sendRegistrationVerificationCode(
      email, 
      code, 
      firstName
    );

    if (!emailResult.success) {
      // If email fails, delete the verification code
      await pool.execute(
        'DELETE FROM verification_codes WHERE id = ?',
        [result.insertId]
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
    const verificationRecord = await VerificationCode.findValidCode(email, code, 'admin_create');
    
    if (!verificationRecord) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification code' 
      });
    }

    // Check if code is expired
    if (verificationRecord.isExpired()) {
      await verificationRecord.destroy();
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new one.' 
      });
    }

    // Check if email already exists (double check)
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
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
    const [userResult] = await pool.execute(
      `INSERT INTO users (
        username, first_name, last_name, email, phone_number, 
        address, password_hash, role, is_approved, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, // Use email as username
        firstName,
        lastName,
        email,
        phoneNumber || null,
        address || null,
        hashedPassword,
        role || 'user',
        1, // Admin-created users are automatically approved
        1  // Active by default
      ]
    );

    // Mark verification code as used
    await pool.execute(
      'UPDATE verification_codes SET used = TRUE WHERE id = ?',
      [verificationRecord.id]
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User created successfully!',
      user: {
        id: userResult.insertId,
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
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'A user with this email already exists' 
      });
    }

    // Generate new verification code
    const verificationRecord = await VerificationCode.createVerificationCode(email, 'admin_create');
    
    // Send new code
    const emailResult = await sendRegistrationVerificationCode(
      email, 
      verificationRecord.code, 
      firstName
    );

    if (!emailResult.success) {
      await verificationRecord.destroy();
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
