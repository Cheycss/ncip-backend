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
    const users = await pool.query(
      'SELECT user_id, username, first_name, last_name, email, password_hash, role, is_active, is_approved FROM users WHERE email = $1',
      [email]
    );
    
    if (users.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    const user = users.rows[0];

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

    // Delete any existing unused codes for this user and type
    await pool.query(
      'DELETE FROM verification_codes WHERE user_id = $1 AND code_type = $2 AND is_used = FALSE',
      [user.user_id, 'login']
    );

    // Insert new verification code
    const result = await pool.query(
      'INSERT INTO verification_codes (user_id, code, code_type, expires_at) VALUES ($1, $2, $3, $4) RETURNING code_id',
      [user.user_id, code, 'login', expiresAt]
    );
    
    // Send verification code via email
    const emailResult = await sendVerificationCode(
      email, 
      code, 
      user.first_name || user.display_name
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
    const verificationRecords = await pool.query(
      `SELECT vc.*, u.email FROM verification_codes vc 
       JOIN users u ON vc.user_id = u.user_id 
       WHERE u.email = $1 AND vc.code = $2 AND vc.code_type = $3 AND vc.is_used = FALSE`,
      [email, code, 'login']
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

    // Mark code as used
    await pool.query(
      'UPDATE verification_codes SET is_used = TRUE WHERE code_id = $1',
      [verificationRecord.code_id]
    );

    // Get user details
    const users = await pool.query(
      'SELECT user_id, username, first_name, last_name, email, password_hash, role, is_active, is_approved FROM users WHERE email = $1',
      [email]
    );
    
    if (users.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = users.rows[0];

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
    const users = await pool.query(
      'SELECT user_id, username, first_name, last_name, email, password_hash, role, is_active, is_approved FROM users WHERE email = $1',
      [email]
    );
    
    if (users.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const user = users.rows[0];

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unused codes for this user and type
    await pool.query(
      'DELETE FROM verification_codes WHERE user_id = $1 AND code_type = $2 AND is_used = FALSE',
      [user.user_id, 'login']
    );

    // Insert new verification code
    const result = await pool.query(
      'INSERT INTO verification_codes (user_id, code, code_type, expires_at) VALUES ($1, $2, $3, $4) RETURNING code_id',
      [user.user_id, code, 'login', expiresAt]
    );
    
    // Send new code
    const emailResult = await sendVerificationCode(
      email, 
      code, 
      user.first_name || user.display_name
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
