import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../database.js';
import { sendVerificationCode } from '../services/emailService.js';

const router = express.Router();

// Step 1: Request verification code (replaces direct login)
router.post('/request-verification', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Find user by email
    const [users] = await pool.execute(
      'SELECT user_id, username, first_name, last_name, email, password_hash, role, is_active, is_approved FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check if user account is approved
    if (!user.is_approved) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account is pending approval. Please wait for administrator approval.' 
      });
    }

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unused codes for this email and type
    await pool.execute(
      'DELETE FROM verification_codes WHERE email = ? AND type = ? AND used = FALSE',
      [email, 'login']
    );

    // Insert new verification code
    const [result] = await pool.execute(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, 'login', expiresAt]
    );
    
    // Send verification code via email
    const emailResult = await sendVerificationCode(
      email, 
      code, 
      user.first_name || user.display_name
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
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email for security
    });

  } catch (error) {
    console.error('Request verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again.' 
    });
  }
});

// Step 2: Verify code and complete login
router.post('/verify-login', async (req, res) => {
  try {
    const { email, code } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and verification code are required' 
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
      [email, code, 'login']
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

    // Mark code as used
    await pool.execute(
      'UPDATE verification_codes SET used = TRUE WHERE id = ?',
      [verificationRecord.id]
    );

    // Get user details
    const [users] = await pool.execute(
      'SELECT user_id, username, first_name, last_name, email, password_hash, role, is_active, is_approved FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = users[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login (if you have these columns)
    // await pool.execute(
    //   'UPDATE users SET last_login = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE user_id = ?',
    //   [user.user_id]
    // );

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Verify login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again.' 
    });
  }
});

// Resend verification code
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT user_id, username, first_name, last_name, email, password_hash, role, is_active, is_approved FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = users[0];

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unused codes for this email and type
    await pool.execute(
      'DELETE FROM verification_codes WHERE email = ? AND type = ? AND used = FALSE',
      [email, 'login']
    );

    // Insert new verification code
    const [result] = await pool.execute(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, 'login', expiresAt]
    );
    
    // Send new code
    const emailResult = await sendVerificationCode(
      email, 
      code, 
      user.first_name || user.display_name
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
    console.error('Resend code error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again.' 
    });
  }
});

export default router;
