import express from 'express';
import pool from '../database.js';

const router = express.Router();

// GET /api/admin/profile/:id - Get admin profile info
router.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`👤 Fetching admin profile: ${id}`);

    // Get admin user info with profile
    const [users] = await pool.query(
      `SELECT 
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.phone_number,
        u.address,
        u.is_active,
        u.created_at,
        up.display_name,
        up.nickname,
        up.position,
        up.avatar_url,
        up.bio
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = ? AND u.role = 'admin'`,
      [parseInt(id)]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const admin = users[0];

    // Get admin activity stats
    const [reviewStats] = await pool.query(
      `SELECT 
        COUNT(DISTINCT a.application_id) as applications_reviewed,
        COUNT(DISTINCT ud.id) as documents_reviewed,
        COUNT(DISTINCT CASE WHEN a.status = 'approved' THEN a.application_id END) as applications_approved,
        COUNT(DISTINCT CASE WHEN a.status = 'rejected' THEN a.application_id END) as applications_rejected
       FROM applications a
       LEFT JOIN uploaded_documents ud ON ud.reviewed_by = ?
       WHERE a.reviewed_by = ?`,
      [id, id]
    );

    const stats = reviewStats[0] || {
      applications_reviewed: 0,
      documents_reviewed: 0,
      applications_approved: 0,
      applications_rejected: 0
    };

    res.json({
      success: true,
      data: {
        admin: {
          ...admin,
          full_name: `${admin.first_name} ${admin.last_name}`,
          display_name: admin.display_name || `${admin.first_name} ${admin.last_name}`,
          avatar_url: admin.avatar_url || null
        },
        stats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin profile',
      error: error.message
    });
  }
});

// GET /api/admin/all-admins - Get all admin users
router.get('/all-admins', async (req, res) => {
  try {
    console.log('👥 Fetching all admin users...');

    const [admins] = await pool.query(
      `SELECT 
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        u.is_active,
        u.created_at,
        up.display_name,
        up.position,
        up.avatar_url,
        COUNT(DISTINCT a.application_id) as applications_reviewed,
        COUNT(DISTINCT ud.id) as documents_reviewed
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       LEFT JOIN applications a ON a.reviewed_by = u.user_id
       LEFT JOIN uploaded_documents ud ON ud.reviewed_by = u.user_id
       WHERE u.role = 'admin' AND u.is_active = 1
       GROUP BY u.user_id
       ORDER BY u.created_at DESC`
    );

    const processedAdmins = admins.map(admin => ({
      ...admin,
      full_name: `${admin.first_name} ${admin.last_name}`,
      display_name: admin.display_name || `${admin.first_name} ${admin.last_name}`,
      avatar_url: admin.avatar_url || null
    }));

    res.json({
      success: true,
      data: {
        admins: processedAdmins,
        total: processedAdmins.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin users',
      error: error.message
    });
  }
});

export default router;
