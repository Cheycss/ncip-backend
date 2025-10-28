import express from 'express';
import pool from '../database.js';

const router = express.Router();

// GET /api/admin/applications - Get all applications for review
router.get('/applications', async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    console.log('📋 Admin fetching applications for review...');

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (status && status !== 'all') {
      whereClause += ' AND a.status = ?';
      queryParams.push(status);
    }

    if (search) {
      whereClause += ' AND (a.application_id LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get applications with user info and document counts
    const [applications] = await pool.query(
      `SELECT 
        a.application_id as id,
        a.user_id,
        a.purpose,
        a.status,
        a.form_data,
        a.created_at,
        a.updated_at,
        a.submitted_at,
        a.reviewed_at,
        a.reviewed_by,
        a.review_notes,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(ud.id) as total_documents,
        COUNT(CASE WHEN ud.review_status = 'approved' THEN 1 END) as approved_documents,
        COUNT(CASE WHEN ud.review_status = 'pending' THEN 1 END) as pending_documents,
        COUNT(CASE WHEN ud.review_status = 'rejected' THEN 1 END) as rejected_documents
       FROM applications a
       LEFT JOIN users u ON a.user_id = u.user_id
       LEFT JOIN uploaded_documents ud ON a.application_id = ud.application_id
       ${whereClause}
       GROUP BY a.application_id
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT a.application_id) as total
       FROM applications a
       LEFT JOIN users u ON a.user_id = u.user_id
       ${whereClause}`,
      queryParams
    );

    const totalApplications = countResult[0].total;
    const totalPages = Math.ceil(totalApplications / limit);

    // Parse form_data JSON for each application
    const processedApplications = applications.map(app => {
      let formData = {};
      try {
        formData = JSON.parse(app.form_data || '{}');
      } catch (e) {
        console.warn('Error parsing form_data for application:', app.id);
      }

      return {
        ...app,
        form_data: formData,
        applicant_name: formData.personalInfo?.fullName || formData.name || `${app.first_name} ${app.last_name}`,
        location: formData.personalInfo?.city || 'N/A',
        tribe: formData.personalInfo?.tribe || 'N/A',
        purpose_name: app.purpose || 'N/A'
      };
    });

    res.json({
      success: true,
      data: {
        applications: processedApplications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalApplications,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// GET /api/admin/application/:id - Get detailed application info
router.get('/application/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📄 Admin fetching application details: ${id}`);

    // Get application with user info (using correct schema)
    const [applications] = await pool.query(
      `SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        u.address
       FROM applications a
       LEFT JOIN users u ON a.user_id = u.user_id
       WHERE a.application_id = ?`,
      [parseInt(id)]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const application = applications[0];

    // Parse form_data
    let formData = {};
    try {
      formData = JSON.parse(application.form_data || '{}');
    } catch (e) {
      console.warn('Error parsing form_data:', e);
    }

    // Get uploaded documents (application_id is varchar in uploaded_documents)
    const [documents] = await pool.query(
      `SELECT 
        id,
        document_type,
        requirement_id,
        original_name,
        filename,
        file_size,
        mime_type,
        upload_status,
        uploaded_at,
        review_status,
        reviewed_by,
        reviewed_at,
        review_notes
       FROM uploaded_documents 
       WHERE application_id = ?
       ORDER BY uploaded_at DESC`,
      [id.toString()]
    );

    // Get review history (application_id is varchar in review_history)
    const [reviewHistory] = await pool.query(
      `SELECT 
        rh.*,
        u.first_name as reviewer_first_name,
        u.last_name as reviewer_last_name
       FROM review_history rh
       LEFT JOIN users u ON rh.reviewed_by = u.user_id
       WHERE rh.application_id = ?
       ORDER BY rh.reviewed_at DESC`,
      [id.toString()]
    );

    res.json({
      success: true,
      data: {
        application: {
          ...application,
          form_data: formData
        },
        documents,
        reviewHistory
      }
    });

  } catch (error) {
    console.error('❌ Error fetching application details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch application details',
      error: error.message
    });
  }
});

// POST /api/admin/review-document - Review a specific document
router.post('/review-document', async (req, res) => {
  try {
    const {
      documentId,
      reviewStatus, // 'approved' or 'rejected'
      reviewNotes,
      reviewedBy
    } = req.body;

    console.log(`📝 Admin reviewing document: ${documentId}`);

    if (!documentId || !reviewStatus || !reviewedBy) {
      return res.status(400).json({
        success: false,
        message: 'Document ID, review status, and reviewer ID are required'
      });
    }

    // Update document review status
    await pool.query(
      `UPDATE uploaded_documents 
       SET review_status = ?, 
           reviewed_by = ?, 
           reviewed_at = NOW(), 
           review_notes = ?
       WHERE id = ?`,
      [reviewStatus, reviewedBy, reviewNotes || null, documentId]
    );

    // Get document info for logging
    const [documents] = await pool.query(
      'SELECT application_id, document_type FROM uploaded_documents WHERE id = ?',
      [documentId]
    );

    if (documents.length > 0) {
      const { application_id, document_type } = documents[0];
      
      // Log review action in review_history table (if it exists)
      try {
        await pool.query(
          `INSERT INTO review_history 
           (application_id, document_id, action, status, notes, reviewed_by, reviewed_at)
           VALUES (?, ?, 'document_review', ?, ?, ?, NOW())`,
          [application_id, documentId, reviewStatus, reviewNotes, reviewedBy]
        );
      } catch (historyError) {
        console.warn('Could not log to review_history (table may not exist):', historyError.message);
      }

      // Check if all documents are reviewed and update application status
      await updateApplicationReviewStatus(application_id);
    }

    res.json({
      success: true,
      message: `Document ${reviewStatus} successfully`,
      data: {
        documentId,
        reviewStatus,
        reviewedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error reviewing document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review document',
      error: error.message
    });
  }
});

// POST /api/admin/review-application - Review entire application
router.post('/review-application', async (req, res) => {
  try {
    const {
      applicationId,
      action, // 'approve', 'reject', 'request_changes'
      notes,
      reviewedBy
    } = req.body;

    console.log(`📋 Admin reviewing application: ${applicationId}`);

    if (!applicationId || !action || !reviewedBy) {
      return res.status(400).json({
        success: false,
        message: 'Application ID, action, and reviewer ID are required'
      });
    }

    // Determine new status based on action
    let newStatus;
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'request_changes':
        newStatus = 'changes_requested';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Must be approve, reject, or request_changes'
        });
    }

    // Update application status
    await pool.query(
      `UPDATE applications 
       SET status = ?, 
           reviewed_by = ?, 
           reviewed_at = NOW(), 
           review_notes = ?,
           updated_at = NOW()
       WHERE application_id = ?`,
      [newStatus, reviewedBy, notes || null, parseInt(applicationId)]
    );

    // Log review action
    try {
      await pool.query(
        `INSERT INTO review_history 
         (application_id, action, status, notes, reviewed_by, reviewed_at)
         VALUES (?, 'application_review', ?, ?, ?, NOW())`,
        [applicationId, newStatus, notes, reviewedBy]
      );
    } catch (historyError) {
      console.warn('Could not log to review_history:', historyError.message);
    }

    res.json({
      success: true,
      message: `Application ${action}d successfully`,
      data: {
        applicationId,
        newStatus,
        action,
        reviewedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error reviewing application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review application',
      error: error.message
    });
  }
});

// GET /api/admin/stats - Get admin dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Admin fetching dashboard statistics...');

    // Get application counts by status
    const [statusCounts] = await pool.query(
      `SELECT 
        status,
        COUNT(application_id) as count
       FROM applications 
       GROUP BY status`
    );

    // Get document review counts
    const [documentCounts] = await pool.query(
      `SELECT 
        review_status,
        COUNT(*) as count
       FROM uploaded_documents 
       GROUP BY review_status`
    );

    // Get recent activity (last 7 days)
    const [recentActivity] = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(application_id) as applications
       FROM applications 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    // Get top purposes (simplified since purpose is stored as text)
    const [topPurposes] = await pool.query(
      `SELECT 
        purpose as purpose_name,
        COUNT(application_id) as count
       FROM applications
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY purpose
       ORDER BY count DESC
       LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        documentCounts: documentCounts.reduce((acc, item) => {
          acc[item.review_status] = item.count;
          return acc;
        }, {}),
        recentActivity,
        topPurposes
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// Helper function to update application review status based on document reviews
async function updateApplicationReviewStatus(applicationId) {
  try {
    // Get all documents for this application
    const [documents] = await pool.query(
      'SELECT review_status FROM uploaded_documents WHERE application_id = ?',
      [applicationId]
    );

    if (documents.length === 0) return;

    const totalDocs = documents.length;
    const approvedDocs = documents.filter(doc => doc.review_status === 'approved').length;
    const rejectedDocs = documents.filter(doc => doc.review_status === 'rejected').length;
    const pendingDocs = documents.filter(doc => doc.review_status === 'pending').length;

    let newStatus = 'under_review';

    if (rejectedDocs > 0) {
      newStatus = 'documents_rejected';
    } else if (approvedDocs === totalDocs) {
      newStatus = 'documents_approved';
    } else if (pendingDocs === 0) {
      newStatus = 'documents_reviewed';
    }

    // Update application status
    await pool.query(
      'UPDATE applications SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, applicationId]
    );

    console.log(`📊 Application ${applicationId} status updated to: ${newStatus}`);

  } catch (error) {
    console.error('Error updating application review status:', error);
  }
}

export default router;
