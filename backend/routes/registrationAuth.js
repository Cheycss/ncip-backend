import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../database.js';
import { sendRegistrationVerificationCode } from '../services/emailService.js';

const router = express.Router();

// Step 1: Send verification code for registration
router.post('/send-verification', async (req, res) => {
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
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'An account with this email already exists' 
      });
    }

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete any existing unused codes for this email and type
    await pool.execute(
      'DELETE FROM verification_codes WHERE email = ? AND type = ? AND used = FALSE',
      [email, 'registration']
    );

    // Insert new verification code
    const [result] = await pool.execute(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, 'registration', expiresAt]
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
      message: 'Verification code sent to your email address',
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email for security
      expiresIn: '15 minutes'
    });

  } catch (error) {
    console.error('Send registration verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again.' 
    });
  }
});

// Step 2: Verify code and complete registration
router.post('/verify-and-register', async (req, res) => {
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
      password,
      birthCertificateData 
    } = req.body;

    // Validate required fields
    if (!email || !code || !firstName || !lastName || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All required fields must be provided' 
      });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code must be 6 digits' 
      });
    }

    // Find valid verification code
    const [verificationRecords] = await pool.execute(
      'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND type = ? AND used = FALSE',
      [email, code, 'registration']
    );
    
    if (verificationRecords.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification code' 
      });
    }

    const verificationRecord = verificationRecords[0];

    // Check if code is expired
    if (new Date() > new Date(verificationRecord.expires_at)) {
      await pool.execute(
        'DELETE FROM verification_codes WHERE id = ?',
        [verificationRecord.id]
      );
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new one.' 
      });
    }

    // Check if email already exists (double check)
    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'An account with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const [userResult] = await pool.execute(
      `INSERT INTO users (
        username, first_name, last_name, email, phone_number, 
        address, password_hash, role, is_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, // Use email as username
        firstName,
        lastName,
        email,
        phoneNumber,
        address,
        hashedPassword,
        'user',
        0 // Not approved yet (0 = false)
      ]
    );

    // Mark verification code as used
    await pool.execute(
      'UPDATE verification_codes SET used = TRUE WHERE id = ?',
      [verificationRecord.id]
    );

    // Return success response (don't auto-login, require admin approval)
    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending admin approval.',
      user: {
        id: userResult.insertId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName || `${firstName} ${lastName}`,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Verify and register error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed. Please try again.' 
    });
  }
});

// Resend registration verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { email, firstName } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if email already exists
    const [existingUsers] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'An account with this email already exists' 
      });
    }

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete any existing unused codes for this email and type
    await pool.execute(
      'DELETE FROM verification_codes WHERE email = ? AND type = ? AND used = FALSE',
      [email, 'registration']
    );

    // Insert new verification code
    const [result] = await pool.execute(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, 'registration', expiresAt]
    );
    
    // Send new code
    const emailResult = await sendRegistrationVerificationCode(
      email, 
      code, 
      firstName
    );

    if (!emailResult.success) {
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
      message: 'New verification code sent to your email'
    });

  } catch (error) {
    console.error('Resend registration verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again.' 
    });
  }
});

export default router;
