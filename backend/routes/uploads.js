import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../database.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { applicationId, documentType } = req.body;
    const uploadPath = path.join(uploadsDir, applicationId || 'temp');
    
    // Create application-specific directory
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const { documentType } = req.body;
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${documentType || 'document'}_${timestamp}_${originalName}`;
    cb(null, filename);
  }
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload
  },
  fileFilter: fileFilter
});

// POST /api/uploads/document - Upload a single document
router.post('/document', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Document upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const {
      applicationId,
      documentType,
      requirementId,
      userId
    } = req.body;

    // Validate required fields
    if (!applicationId || !documentType) {
      return res.status(400).json({
        success: false,
        message: 'Application ID and document type are required'
      });
    }

    // File information
    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date()
    };

    console.log('📁 File uploaded:', fileInfo);

    // Store file information in database
    const result = await pool.query(
      `INSERT INTO uploaded_documents 
       (application_id, user_id, document_type, requirement_id, original_name, 
        filename, file_path, file_size, mime_type, upload_status, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploaded', NOW()) RETURNING id`,
      [
        applicationId,
        userId || null,
        documentType,
        requirementId || null,
        fileInfo.originalName,
        fileInfo.filename,
        fileInfo.path,
        fileInfo.size,
        fileInfo.mimetype
      ]
    );

    const documentId = result.rows[0].id;

    // Update application status if all required documents are uploaded
    await updateApplicationStatus(applicationId);

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentId,
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        size: fileInfo.size,
        uploadedAt: fileInfo.uploadedAt,
        documentType,
        requirementId
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Clean up uploaded file if database insertion fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
});

// GET /api/uploads/application/:id - Get all documents for an application
router.get('/application/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Fetching documents for application: ${id}`);

    const documents = await pool.query(
      `SELECT 
        id, document_type, requirement_id, original_name, filename,
        file_size, mime_type, upload_status, uploaded_at, reviewed_at,
        review_status, review_notes
       FROM uploaded_documents 
       WHERE application_id = $1
       ORDER BY uploaded_at DESC`,
      [id]
    );

    // Get application info
    const appInfo = await pool.query(
      'SELECT application_id as id, status, purpose FROM applications WHERE application_id = $1',
      [id]
    );

    if (appInfo.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      data: {
        application: appInfo.rows[0],
        documents: documents.rows,
        totalDocuments: documents.rows.length,
        uploadedCount: documents.rows.filter(doc => doc.upload_status === 'uploaded').length,
        reviewedCount: documents.rows.filter(doc => doc.review_status === 'approved').length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: error.message
    });
  }
});

// GET /api/uploads/document/:id - Download a specific document
router.get('/document/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📥 Download request for document: ${id}`);

    const documents = await pool.query(
      'SELECT * FROM uploaded_documents WHERE id = $1',
      [id]
    );

    if (documents.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = documents.rows[0];
    const filePath = document.file_path;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${document.original_name}"`);
    
    // Send file
    res.sendFile(path.resolve(filePath));

  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: error.message
    });
  }
});

// DELETE /api/uploads/document/:id - Delete a document
router.delete('/document/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Delete request for document: ${id}`);

    // Get document info first
    const documents = await pool.query(
      'SELECT * FROM uploaded_documents WHERE id = $1',
      [id]
    );

    if (documents.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = documents.rows[0];

    // Delete file from filesystem
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    // Delete from database
    await pool.query('DELETE FROM uploaded_documents WHERE id = $1', [id]);

    // Update application status
    await updateApplicationStatus(document.application_id);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Delete failed',
      error: error.message
    });
  }
});

// Helper function to update application status based on uploaded documents
async function updateApplicationStatus(applicationId) {
  try {
    // Get application info
    const appInfo = await pool.query(
      'SELECT purpose_id FROM applications WHERE id = $1',
      [applicationId]
    );

    if (appInfo.rows.length === 0) return;

    // Get required documents count for this purpose
    const purposeInfo = await pool.query(
      'SELECT requirements FROM purposes WHERE purpose_id = $1',
      [appInfo.rows[0].purpose_id]
    );

    if (purposeInfo.rows.length === 0) return;

    let requiredCount = 0;
    try {
      const requirements = JSON.parse(purposeInfo.rows[0].requirements || '[]');
      requiredCount = requirements.length;
    } catch (error) {
      console.error('Error parsing requirements:', error);
      return;
    }

    // Get uploaded documents count
    const uploadedCount = await pool.query(
      'SELECT COUNT(*) as count FROM uploaded_documents WHERE application_id = $1 AND upload_status = \'uploaded\'',
      [applicationId]
    );

    const currentCount = parseInt(uploadedCount.rows[0].count);

    // Update application status
    let newStatus = 'draft';
    if (currentCount >= requiredCount) {
      newStatus = 'documents_complete';
    } else if (currentCount > 0) {
      newStatus = 'documents_partial';
    }

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, applicationId]
    );

    console.log(`📊 Application ${applicationId} status updated to: ${newStatus} (${currentCount}/${requiredCount} documents)`);

  } catch (error) {
    console.error('Error updating application status:', error);
  }
}

export default router;
