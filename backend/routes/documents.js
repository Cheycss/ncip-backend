import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../database.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-userid-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${req.user.user_id}-${uniqueSuffix}-${nameWithoutExt}${ext}`);
  }
});

// File filter - only allow specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// =============================================
// POST /api/documents/upload
// Upload a document for a requirement
// =============================================
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = req.user.user_id;
    const { application_id, requirement_id } = req.body;
    const file = req.file;

    // Validate required fields
    if (!application_id || !requirement_id) {
      if (file) fs.unlinkSync(file.path); // Delete uploaded file
      return res.status(400).json({
        success: false,
        message: 'Application ID and Requirement ID are required'
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify application belongs to user
    const applications = await pool.query(
      'SELECT application_id FROM applications WHERE application_id = $1 AND user_id = $2',
      [application_id, userId]
    );

    if (applications.rows.length === 0) {
      fs.unlinkSync(file.path); // Delete uploaded file
      return res.status(403).json({
        success: false,
        message: 'Application not found or access denied'
      });
    }

    // Check if document already exists for this requirement
    const existing = await pool.query(
      'SELECT id as document_id FROM uploaded_documents WHERE application_id = $1 AND requirement_id = $2',
      [application_id, requirement_id]
    );

    // If exists, delete old file and record
    if (existing.rows.length > 0) {
      const oldDoc = await pool.query(
        'SELECT file_path FROM uploaded_documents WHERE id = $1',
        [existing.rows[0].document_id]
      );
      
      if (oldDoc.rows.length > 0 && fs.existsSync(oldDoc.rows[0].file_path)) {
        fs.unlinkSync(oldDoc.rows[0].file_path);
      }
      
      await pool.query(
        'DELETE FROM uploaded_documents WHERE id = $1',
        [existing.rows[0].document_id]
      );
    }

    // Insert new document record
    const result = await pool.query(
      `INSERT INTO uploaded_documents 
       (application_id, requirement_id, original_name, filename, file_path, 
        file_size, mime_type, document_type, upload_status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded') RETURNING id`,
      [
        application_id,
        requirement_id,
        file.originalname,
        file.filename,
        file.path,
        file.size,
        file.mimetype,
        requirement_id
      ]
    );

    const documentId = result.rows[0].id;

    // Update compliance status
    await pool.query(
      `UPDATE requirement_compliance 
       SET is_submitted = TRUE, 
           is_missing = FALSE, 
           status = 'pending',
           submission_date = NOW()
       WHERE application_id = $1 AND requirement_id = $2`,
      [application_id, requirement_id]
    );

    // Update application timeline
    await pool.query(
      `UPDATE application_timeline 
       SET last_document_uploaded_at = NOW()
       WHERE application_id = $1`,
      [application_id]
    );

    // Check if all requirements are submitted
    const compliance = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_submitted = TRUE THEN 1 ELSE 0 END) as submitted
       FROM requirement_compliance
       WHERE application_id = $1`,
      [application_id]
    );

    const allSubmitted = compliance.rows[0].total === compliance.rows[0].submitted;

    if (allSubmitted) {
      await pool.query(
        `UPDATE application_timeline 
         SET all_documents_submitted_at = NOW()
         WHERE application_id = $1`,
        [application_id]
      );
      
      await pool.query(
        `UPDATE applications 
         SET status = 'under_review'
         WHERE application_id = $1`,
        [application_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        document_id: documentId,
        filename: file.originalname,
        size: file.size,
        status: 'pending'
      },
      all_submitted: allSubmitted
    });

  } catch (error) {
    await connection.rollback();
    
    // Delete uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// =============================================
// GET /api/documents/application/:id
// Get all documents for an application
// =============================================
router.get('/application/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const applicationId = req.params.id;

    // Verify application belongs to user or user is admin
    const applications = await pool.query(
      'SELECT application_id FROM applications WHERE application_id = $1 AND (user_id = $2 OR $3 = \'admin\')',
      [applicationId, userId, req.user.role]
    );

    if (applications.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Application not found or access denied'
      });
    }

    // Get all documents (using correct table name)
    const documents = await pool.query(
      `SELECT 
        ud.id as document_id,
        ud.requirement_id,
        ud.document_type as requirement_name,
        ud.document_type as description,
        1 as is_mandatory,
        ud.original_name as original_filename,
        ud.file_size as file_size_bytes,
        ud.mime_type as file_type,
        ud.uploaded_at,
        ud.upload_status as document_status,
        ud.reviewed_by,
        ud.reviewed_at,
        ud.review_notes,
        ud.review_notes as rejection_reason,
        u.first_name as reviewer_first_name,
        u.last_name as reviewer_last_name
       FROM uploaded_documents ud
       LEFT JOIN users u ON ud.reviewed_by = u.user_id
       WHERE ud.application_id = $1
       ORDER BY ud.uploaded_at`,
      [applicationId]
    );

    res.json({
      success: true,
      documents: documents.rows
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: error.message
    });
  }
});

// =============================================
// GET /api/documents/:id/download
// Download a specific document
// =============================================
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const documentId = req.params.id;

    // Get document details
    const documents = await pool.query(
      `SELECT ud.*, a.user_id 
       FROM uploaded_documents ud
       JOIN applications a ON ud.application_id = a.application_id
       WHERE ud.id = $1`,
      [documentId]
    );

    if (documents.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = documents.rows[0];

    // Check access permission
    if (document.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if file exists
    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Send file
    res.download(document.file_path, document.original_filename);

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
      error: error.message
    });
  }
});

// =============================================
// DELETE /api/documents/:id
// Delete a document
// =============================================
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    
    const userId = req.user.user_id;
    const documentId = req.params.id;

    // Get document details
    const documents = await pool.query(
      `SELECT ud.*, a.user_id 
       FROM uploaded_documents ud
       JOIN applications a ON ud.application_id = a.application_id
       WHERE ud.id = $1`,
      [documentId]
    );

    if (documents.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = documents.rows[0];

    // Check access permission
    if (document.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete file from filesystem
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    // Delete database record
    await pool.query(
      'DELETE FROM uploaded_documents WHERE id = $1',
      [documentId]
    );

    // Update compliance status back to missing
    await pool.query(
      `UPDATE requirement_compliance 
       SET is_submitted = FALSE, 
           is_missing = TRUE, 
           status = 'missing',
           submission_date = NULL
       WHERE application_id = $1 AND requirement_id = $2`,
      [document.application_id, document.requirement_id]
    );

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: error.message
    });
  }
});

// =============================================
// PUT /api/documents/:id/review
// Admin: Review and approve/reject document
// =============================================
router.put('/:id/review', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }
    
    const documentId = req.params.id;
    const { status, review_notes, rejection_reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    // Get document details
    const documents = await pool.query(
      'SELECT * FROM uploaded_documents WHERE id = $1',
      [documentId]
    );

    if (documents.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = documents.rows[0];

    // Update document status
    await pool.query(
      `UPDATE uploaded_documents 
       SET review_status = $1,
           reviewed_by = $2,
           reviewed_at = NOW(),
           review_notes = $3,
           rejection_reason = $4
       WHERE id = $5`,
      [status, req.user.user_id, review_notes, rejection_reason, documentId]
    );

    // Update compliance status
    await pool.query(
      `UPDATE requirement_compliance 
       SET is_approved = $1,
           status = $2,
           approval_date = $3
       WHERE application_id = $4 AND requirement_id = $5`,
      [
        status === 'approved',
        status,
        status === 'approved' ? new Date() : null,
        document.application_id,
        document.requirement_id
      ]
    );

    // Check if all documents are approved
    const compliance = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_approved = TRUE THEN 1 ELSE 0 END) as approved
       FROM requirement_compliance
       WHERE application_id = $1`,
      [document.application_id]
    );

    const allApproved = compliance.rows[0].total === compliance.rows[0].approved;

    if (allApproved) {
      await pool.query(
        `UPDATE applications 
         SET status = 'approved'
         WHERE application_id = $1`,
        [document.application_id]
      );
    }

    res.json({
      success: true,
      message: `Document ${status} successfully`,
      all_approved: allApproved
    });

  } catch (error) {
    console.error('Error reviewing document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review document',
      error: error.message
    });
  }
});

export default router;
