import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../database.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const router = express.Router();

// POST /api/auth/register - Register a new user
router.post('/register', async (req, res) => {
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

    // Validate required fields
    if (!first_name || !last_name || !display_name || !email || !phone_number || !address || !ethnicity || !password) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if email already exists in user_registrations
    const [existingReg] = await pool.query(
      'SELECT * FROM user_registrations WHERE email = ?',
      [email]
    );

    if (existingReg.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert into user_registrations table
    const [result] = await pool.query(
      `INSERT INTO user_registrations 
       (first_name, last_name, display_name, email, phone_number, address, ethnicity, password_hash, birth_certificate_data, registration_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [first_name, last_name, display_name, email, phone_number, address, ethnicity, password_hash, birth_certificate_data]
    );

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Awaiting admin approval.',
      registration_id: result.insertId
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find approved user in users table
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_approved = TRUE AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      // Check if user is pending approval
      const [pendingUsers] = await pool.query(
        'SELECT * FROM user_registrations WHERE email = ? AND registration_status = "pending"',
        [email]
      );

      if (pendingUsers.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending admin approval. Please wait for approval before logging in.'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Create JWT token with longer expiration
    const payload = {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d' // 7 days instead of 24 hours
    });

    // Return token and user data
    res.json({
      success: true,
      token,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        phone: user.phone_number,
        address: user.address
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// POST /api/auth/refresh - Refresh expired token
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const token = authHeader.substring(7);
    
    // Decode token without verification to get user info
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.user_id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Verify user still exists and is active
    const [users] = await pool.query(
      'SELECT * FROM users WHERE user_id = ? AND is_approved = TRUE AND is_active = TRUE',
      [decoded.user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const user = users[0];

    // Create new token
    const payload = {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      token: newToken,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh',
      error: error.message
    });
  }
});

export default router;