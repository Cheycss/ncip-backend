import express from 'express';
import pool from '../database.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// GET /api/profile - Get user profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Create user_profiles table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        profile_id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT UNIQUE NOT NULL,
        display_name VARCHAR(150),
        nickname VARCHAR(100),
        position VARCHAR(100),
        avatar_url LONGTEXT,
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // Get user basic info
    const [users] = await pool.query(
      `SELECT user_id, username, first_name, last_name, email, phone_number, address, role, created_at 
       FROM users WHERE user_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get extended profile info
    const [profiles] = await pool.query(
      `SELECT display_name, nickname, position, avatar_url, bio 
       FROM user_profiles WHERE user_id = ?`,
      [userId]
    );

    const profile = {
      ...users[0],
      ...(profiles.length > 0 ? profiles[0] : {})
    };

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// PUT /api/profile - Update user profile
router.put('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      first_name,
      last_name,
      phone_number,
      address,
      display_name,
      nickname,
      position,
      avatar_url,
      bio
    } = req.body;

    // Update users table
    const userUpdates = [];
    const userParams = [];

    if (first_name !== undefined) {
      userUpdates.push('first_name = ?');
      userParams.push(first_name);
    }
    if (last_name !== undefined) {
      userUpdates.push('last_name = ?');
      userParams.push(last_name);
    }
    if (phone_number !== undefined) {
      userUpdates.push('phone_number = ?');
      userParams.push(phone_number);
    }
    if (address !== undefined) {
      userUpdates.push('address = ?');
      userParams.push(address);
    }

    if (userUpdates.length > 0) {
      userParams.push(userId);
      await pool.query(
        `UPDATE users SET ${userUpdates.join(', ')} WHERE user_id = ?`,
        userParams
      );
    }

    // Update or insert user_profiles table
    const [existingProfile] = await pool.query(
      'SELECT profile_id FROM user_profiles WHERE user_id = ?',
      [userId]
    );

    if (existingProfile.length > 0) {
      // Update existing profile
      const profileUpdates = [];
      const profileParams = [];

      if (display_name !== undefined) {
        profileUpdates.push('display_name = ?');
        profileParams.push(display_name);
      }
      if (nickname !== undefined) {
        profileUpdates.push('nickname = ?');
        profileParams.push(nickname);
      }
      if (position !== undefined) {
        profileUpdates.push('position = ?');
        profileParams.push(position);
      }
      if (avatar_url !== undefined) {
        profileUpdates.push('avatar_url = ?');
        profileParams.push(avatar_url);
      }
      if (bio !== undefined) {
        profileUpdates.push('bio = ?');
        profileParams.push(bio);
      }

      if (profileUpdates.length > 0) {
        profileParams.push(userId);
        await pool.query(
          `UPDATE user_profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`,
          profileParams
        );
      }
    } else {
      // Insert new profile
      await pool.query(
        `INSERT INTO user_profiles (user_id, display_name, nickname, position, avatar_url, bio) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, display_name || null, nickname || null, position || null, avatar_url || null, bio || null]
      );
    }

    // Fetch updated profile
    const [users] = await pool.query(
      `SELECT user_id, username, first_name, last_name, email, phone_number, address, role, created_at 
       FROM users WHERE user_id = ?`,
      [userId]
    );

    const [profiles] = await pool.query(
      `SELECT display_name, nickname, position, avatar_url, bio 
       FROM user_profiles WHERE user_id = ?`,
      [userId]
    );

    const profile = {
      ...users[0],
      ...(profiles.length > 0 ? profiles[0] : {})
    };

    res.json({ success: true, profile, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// POST /api/profile/avatar - Upload avatar (base64)
router.post('/avatar', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { avatar_data } = req.body;

    // Allow null to remove avatar
    if (avatar_data === undefined) {
      return res.status(400).json({ success: false, message: 'Avatar data is required' });
    }

    // Create user_profiles table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        profile_id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT UNIQUE NOT NULL,
        display_name VARCHAR(150),
        nickname VARCHAR(100),
        position VARCHAR(100),
        avatar_url LONGTEXT,
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // Check if profile exists
    const [existingProfile] = await pool.query(
      'SELECT profile_id FROM user_profiles WHERE user_id = ?',
      [userId]
    );

    if (existingProfile.length > 0) {
      await pool.query(
        'UPDATE user_profiles SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [avatar_data, userId]
      );
    } else {
      await pool.query(
        'INSERT INTO user_profiles (user_id, avatar_url) VALUES (?, ?)',
        [userId, avatar_data]
      );
    }

    res.json({ success: true, avatar_url: avatar_data, message: 'Avatar updated successfully' });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ success: false, message: 'Failed to upload avatar', error: error.message });
  }
});

export default router;
