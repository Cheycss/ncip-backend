import express from 'express';
import pool from '../database.js';
import authMiddleware from '../authMiddleware.js';
import { notifyApplicationStatusChange } from '../utils/notificationHelper.js';

const router = express.Router();

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.'
    });
  }
  next();
};

// GET /api/applications - Get all applications for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Query applications for the user
    const [applications] = await pool.query(
      `SELECT 
        a.*,
        c.applicant_name,
        c.birth_date,
        c.civil_status,
        c.province,
        c.municipality,
        c.barangay,
        c.tribe_affiliation
      FROM applications a
      LEFT JOIN coc_forms c ON a.application_id = c.application_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications',
      error: error.message
    });
  }
});

// GET /api/applications/admin/all - Get all applications for admin dashboard
router.get('/admin/all', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         a.application_id,
         a.user_id,
         a.application_number,
         a.service_type,
         a.purpose,
         a.status,
         a.form_data,
         a.submitted_at,
         a.reviewed_at,
         a.completed_at,
         a.cancelled_at,
         a.reviewed_by,
         a.reviewer_notes,
         a.rejection_reason,
         a.created_at,
         a.updated_at,
         a.review_notes,
         u.first_name,
         u.last_name,
         u.email
       FROM applications a
       LEFT JOIN users u ON a.user_id = u.user_id
       ORDER BY a.created_at DESC`
    );

    const applications = rows.map(row => ({
      application_id: row.application_id,
      user_id: row.user_id,
      application_number: row.application_number,
      service_type: row.service_type,
      purpose: row.purpose,
      application_status: row.status,
      priority: row.priority,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      submission_deadline: row.submission_deadline,
      days_remaining: row.days_remaining,
      days_to_complete: row.days_to_complete,
      is_cancelled: row.is_cancelled,
      cancellation_reason: row.cancellation_reason,
      reviewer_notes: row.reviewer_notes,
      assigned_to: row.assigned_to,
      applicant_name: row.applicant_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      ethnicity: row.tribe_affiliation || row.icc_group,
      applicant: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone_number: row.phone_number,
        address: row.address,
        ethnicity: row.tribe_affiliation || row.icc_group
      },
      coc_form: row.applicant_name ? {
        applicant_name: row.applicant_name,
        birth_date: row.birth_date,
        civil_status: row.civil_status,
        province: row.province,
        municipality: row.municipality,
        barangay: row.barangay,
        belonging_location: row.belonging_location,
        icc_group: row.icc_group,
        tribe_affiliation: row.tribe_affiliation,
        years_resident: row.years_resident
      } : null
    }));

    res.json({ success: true, applications });
  } catch (error) {
    console.error('Error fetching admin applications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
});

// GET /api/applications/:id - Get specific application
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const applicationId = req.params.id;

    // Query specific application
    const [applications] = await pool.query(
      `SELECT 
        a.*,
        c.*
      FROM applications a
      LEFT JOIN coc_forms c ON a.application_id = c.application_id
      WHERE a.application_id = ? AND a.user_id = ?`,
      [applicationId, userId]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      application: applications[0]
    });

  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching application',
      error: error.message
    });
  }
});

// POST /api/applications - Create new application
router.post('/', authMiddleware, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = req.user.user_id;
    const { service_type, purpose, formData } = req.body;

    // Generate application number
    const application_number = `NCIP-${Date.now()}`;

    // Insert application
    const [appResult] = await connection.query(
      `INSERT INTO applications (user_id, application_number, service_type, purpose, status, submitted_at) 
       VALUES (?, ?, ?, ?, 'submitted', NOW())`,
      [userId, application_number, service_type, purpose]
    );

    const applicationId = appResult.insertId;

    // If it's a COC application, insert form data
    if (service_type === 'Certificate of Confirmation' && formData) {
      await connection.query(
        `INSERT INTO coc_forms 
         (application_id, applicant_name, birth_date, civil_status, province, municipality, barangay, 
          belonging_location, icc_group, tribe_affiliation, father_name, father_tribe, mother_name, 
          mother_tribe, years_resident) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          applicationId,
          formData.applicant_name || null,
          formData.birth_date || null,
          formData.civil_status || null,
          formData.province || 'SARANGANI',
          formData.municipality || null,
          formData.barangay || null,
          formData.belonging_location || null,
          formData.icc_group || null,
          formData.tribe_affiliation || null,
          formData.father_name || null,
          formData.father_tribe || null,
          formData.mother_name || null,
          formData.mother_tribe || null,
          formData.years_resident || null
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application_id: applicationId,
      application_number
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating application',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// PUT /api/applications/:id/status - Update application status (admin only)
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewer_notes } = req.body;

    const validStatuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    // Get application details before updating
    const [applications] = await pool.query(
      'SELECT user_id, application_number FROM applications WHERE application_id = ?',
      [id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const application = applications[0];

    const [result] = await pool.query(
      `UPDATE applications SET status = ?, reviewer_notes = ?, updated_at = NOW()
       WHERE application_id = ?`,
      [status, reviewer_notes || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Send notification to user
    await notifyApplicationStatusChange(
      application.user_id,
      id,
      application.application_number,
      status
    );

    res.json({ success: true, message: 'Application status updated successfully' });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ success: false, message: 'Failed to update application status' });
  }
});

export default router;