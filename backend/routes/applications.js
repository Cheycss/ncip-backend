import express from 'express';
import pool from '../database.js';
import authMiddleware from '../authMiddleware.js';
import { notifyApplicationStatusChange } from '../utils/notificationHelper.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { generateCertificateNumber } from '../utils/idGenerator.js';
import { generateCOC, generateCOCNumber } from '../utils/cocGenerator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images and PDFs only!');
    }
  }
});

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.'
    });
  }
  next();
};

// POST /api/applications/upload-coc - Upload COC form pages and create application
router.post('/upload-coc', authMiddleware, upload.fields([
  { name: 'page1', maxCount: 1 },
  { name: 'page2', maxCount: 1 },
  { name: 'page3', maxCount: 1 },
  { name: 'page4', maxCount: 1 },
  { name: 'page5', maxCount: 1 },
  { name: 'page6', maxCount: 1 }
]), async (req, res) => {
  try {
    const { purpose, purpose_id } = req.body;
    const userId = req.user.id || req.user.user_id;
    
    console.log('Upload COC Request:', { purpose, purpose_id, userId, files: Object.keys(req.files || {}) });
    
    // Check if all files are uploaded
    if (!req.files || Object.keys(req.files).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'All 6 pages must be uploaded'
      });
    }
    
    // Generate unique application number
    const year = new Date().getFullYear();
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM applications WHERE EXTRACT(YEAR FROM created_at) = $1',
      [year]
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const applicationNumber = `APP-${year}-${String(count).padStart(3, '0')}`;
    
    console.log('Generated application number:', applicationNumber);
    
    // Calculate deadline (20 days from now)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 20);
    
    // Create form data object
    const formData = {
      purpose: purpose || 'Not specified',
      purpose_id: purpose_id,
      submission_type: 'COC Forms',
      pages_submitted: 6,
      submitted_date: new Date().toISOString(),
      deadline: deadline.toISOString(),
      days_to_complete: 20
    };
    
    // Create application record with form data and deadline
    const applicationResult = await pool.query(
      `INSERT INTO applications (
        user_id, 
        application_number,
        service_type, 
        purpose,
        status,
        form_data,
        submission_deadline,
        submitted_at, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW()) 
      RETURNING application_id, application_number`,
      [
        userId, 
        applicationNumber, 
        'Certificate of Confirmation', 
        purpose || 'Not specified', 
        'submitted',  // Initial status - admin must review first
        JSON.stringify(formData),
        deadline.toISOString()
      ]
    );
    
    const applicationId = applicationResult.rows[0].application_id;
    const appNumber = applicationResult.rows[0].application_number;
    
    console.log('Created application:', { applicationId, appNumber });
    
    // Store file paths in documents table
    const documentPromises = Object.entries(req.files).map(([pageKey, fileArray]) => {
      const file = fileArray[0];
      console.log(`Saving document: ${pageKey} - ${file.originalname}`);
      return pool.query(
        `INSERT INTO documents (
          application_id,
          document_type,
          file_path,
          file_name,
          uploaded_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [applicationId, pageKey, file.path, file.originalname]
      );
    });
    
    await Promise.all(documentPromises);
    console.log('All documents saved successfully');
    
    res.json({
      success: true,
      message: `Application ${appNumber} submitted successfully! You can track its status in the Application Status page.`,
      application_id: applicationId,
      application_number: appNumber
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application'
    });
  }
});

// GET /api/applications - Get all applications for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.user_id;
    
    console.log('Fetching applications for user:', userId);

    // Query applications for the user
    const applications = await pool.query(
      `SELECT 
        application_id,
        application_number,
        user_id,
        service_type,
        purpose,
        status,
        submitted_at,
        created_at,
        updated_at,
        submission_deadline,
        form_data
      FROM applications
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      applications: applications.rows
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

// GET /api/applications/debug-statuses - Check all application statuses
router.get('/debug-statuses', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        status,
        COUNT(*) as count,
        STRING_AGG(application_id::text, ', ') as ids
      FROM applications 
      GROUP BY status
      ORDER BY count DESC`
    );
    res.json({ 
      success: true, 
      statuses: result.rows 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/applications/test - Test database connection
router.get('/test', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'Database connected',
      time: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// GET /api/applications/admin/requirements - Get applications with submitted requirements for review
// NOTE: This must come BEFORE /:id routes to avoid route conflicts
router.get('/admin/requirements', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    console.log('📋 Fetching requirements for admin review...');
    
    // Get all requirement-related statuses
    const result = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM applications a
       LEFT JOIN users u ON a.user_id = u.user_id
       WHERE a.status IN ('requirements_submitted', 'ready_for_requirements', 'requirements_approved', 'requirements_rejected')
       ORDER BY a.created_at DESC`
    );
    
    console.log(`✅ Found ${result.rows.length} apps:`, result.rows.map(a => `${a.application_id}(${a.status})`).join(', '));

    // Get document count from documents table for each application
    const applications = await Promise.all(result.rows.map(async (app) => {
      try {
        const docResult = await pool.query(
          'SELECT COUNT(*) as count FROM documents WHERE application_id = $1 AND is_requirement = true',
          [app.application_id]
        );
        const docCount = parseInt(docResult.rows[0]?.count || 0);
        return { ...app, document_count: docCount };
      } catch (e) {
        console.log('Error counting docs for app', app.application_id, e.message);
        return { ...app, document_count: 0 };
      }
    }));
    
    res.json({ 
      success: true, 
      applications,
      message: `Found ${applications.length} applications with requirements` 
    });
  } catch (error) {
    console.error('Error fetching requirements for review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch requirements for review' 
    });
  }
});

// GET /api/applications/admin/all - Get all applications for admin dashboard
router.get('/admin/all', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const rows = await pool.query(
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
         u.email,
         u.phone_number,
         u.address
       FROM applications a
       LEFT JOIN users u ON a.user_id = u.user_id
       WHERE a.status NOT IN ('requirements_submitted', 'requirements_approved', 'requirements_rejected')
       ORDER BY a.created_at DESC`
    );
    
    // Get documents for all applications
    const docsResult = await pool.query(
      'SELECT application_id, document_type, file_name, file_path, uploaded_at FROM documents ORDER BY uploaded_at ASC'
    );

    // Group documents by application_id
    const documentsByApp = {};
    docsResult.rows.forEach(doc => {
      if (!documentsByApp[doc.application_id]) {
        documentsByApp[doc.application_id] = [];
      }
      documentsByApp[doc.application_id].push({
        type: doc.document_type,
        fileName: doc.file_name,
        filePath: doc.file_path,
        uploadedAt: doc.uploaded_at
      });
    });
    
    const applications = rows.rows.map(row => ({
      application_id: row.application_id,
      user_id: row.user_id,
      application_number: row.application_number,
      service_type: row.service_type,
      purpose: row.purpose,
      application_status: row.status,
      status: row.status,
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
      applicant_name: `${row.first_name || 'Unknown'} ${row.last_name || ''}`.trim(),
      ethnicity: row.tribe_affiliation || row.icc_group,
      email: row.email,
      documents: documentsByApp[row.application_id] || [],
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

// GET /api/certificates - Get all issued certificates for COC report
router.get('/certificates', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    console.log('📜 Fetching all issued certificates...');
    
    // Query applications directly where status is certificate_issued
    const result = await pool.query(
      `SELECT 
         a.application_id,
         a.application_number,
         a.purpose,
         a.form_data,
         a.updated_at as issued_date,
         u.first_name,
         u.last_name,
         u.address
       FROM applications a
       INNER JOIN users u ON a.user_id = u.user_id
       WHERE a.status = 'certificate_issued'
       ORDER BY a.updated_at DESC`
    );
    
    console.log(`🔍 Found ${result.rows.length} applications with status certificate_issued`);
    
    const certificates = result.rows.map(row => {
      // Parse form data to extract ALL details
      const formData = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data;
      const personalInfo = formData?.page1 || {};
      
      // Generate COC number from application ID
      const cocNumber = generateCOCNumber(row.application_id);
      
      // Extract Place of Origin from form data
      const barangay = personalInfo.barangay || personalInfo.brgy || personalInfo.barangay_name || '';
      const municipality = personalInfo.municipality || personalInfo.city_municipality || personalInfo.city || '';
      const province = personalInfo.province || 'Sarangani';
      
      // Build place of origin string
      let placeOfOrigin = '';
      if (barangay && municipality) {
        placeOfOrigin = `${barangay}, ${municipality}`;
      } else if (municipality) {
        placeOfOrigin = municipality;
      } else if (row.address) {
        placeOfOrigin = row.address;
      } else {
        placeOfOrigin = 'Not Specified';
      }
      
      const cert = {
        certificate_id: row.application_id,
        certificate_number: cocNumber,
        applicant_name: `${row.last_name || ''}, ${row.first_name || ''} ${personalInfo.middle_name || ''}`.trim().toUpperCase(),
        place_of_origin: placeOfOrigin,
        purpose: row.purpose || 'IP Identification',
        issued_date: row.issued_date
      };
      
      console.log(`  - ${cert.applicant_name} (${cert.certificate_number}) from ${cert.place_of_origin}`);
      return cert;
    });
    
    console.log(`✅ Returning ${certificates.length} issued certificates`);
    res.json({ success: true, certificates });
  } catch (error) {
    console.error('❌ Error fetching certificates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch certificates', error: error.message });
  }
});

// GET /api/applications/documents/view/:applicationId/:fileName - View document by file name
// Note: Accepts token via query parameter since iframes can't send headers
router.get('/documents/view/:applicationId/:fileName', async (req, res) => {
  try {
    const { applicationId, fileName } = req.params;
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    // Verify token
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log('Token verified for user:', req.user.user_id);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid token: ' + err.message });
    }
    
    console.log('Viewing document:', { applicationId, fileName, userId: req.user.user_id });
    
    // Get document info
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE application_id = $1 AND file_name = $2',
      [applicationId, fileName]
    );
    
    if (docResult.rows.length === 0) {
      console.error('Document not found:', { applicationId, fileName });
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    
    const document = docResult.rows[0];
    const filePath = path.resolve(document.file_path);
    
    console.log('Sending file:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found on disk:', filePath);
      return res.status(404).json({ success: false, message: 'File not found on disk' });
    }
    
    // Send file for viewing (not as attachment)
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('Document view error:', error);
    res.status(500).json({ success: false, message: 'Failed to view document' });
  }
});

// GET /api/applications/:id - Get specific application
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const applicationId = req.params.id;

    // Query specific application
    const applications = await pool.query(
      `SELECT 
        a.*,
        c.*
      FROM applications a
      LEFT JOIN coc_forms c ON a.application_id = c.application_id
      WHERE a.application_id = $1 AND a.user_id = $2`,
      [applicationId, userId]
    );

    if (applications.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      application: applications.rows[0]
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
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.user_id;
    const { application_number, service_type, purpose, status, form_data } = req.body;

    // Generate application number if not provided
    const app_number = application_number || `NCIP-${Date.now()}`;

    // Insert application
    const appResult = await client.query(
      `INSERT INTO applications (user_id, application_number, service_type, purpose, status, form_data, submitted_at, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
       RETURNING application_id, application_number`,
      [userId, app_number, service_type, purpose, status || 'submitted', JSON.stringify(form_data || {})]
    );

    const applicationId = appResult.rows[0].application_id;
    const returnedAppNumber = appResult.rows[0].application_number;

    // If it's a COC application, also insert into coc_forms table if it exists
    if (service_type === 'Certificate of Confirmation' && form_data) {
      // Check if coc_forms table exists
      const tableCheck = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'coc_forms')`
      );
      
      if (tableCheck.rows[0].exists) {
        await client.query(
          `INSERT INTO coc_forms 
           (application_id, form_data, page_number, is_completed, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [applicationId, JSON.stringify(form_data), 1, true]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application: {
        application_id: applicationId,
        application_number: returnedAppNumber
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating application',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// PUT /api/applications/:id/documents-status - Update application status after document submission (user)
router.put('/:id/documents-status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const { status, documentsUploaded, uploadedDocuments, documentsSubmittedAt } = req.body;

    // Verify the application belongs to the user
    const appCheck = await pool.query(
      'SELECT application_id FROM applications WHERE application_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to update this application' 
      });
    }

    // Update application status to documents_submitted
    const result = await pool.query(
      `UPDATE applications 
       SET status = $1, 
           updated_at = NOW()
       WHERE application_id = $2 AND user_id = $3`,
      ['documents_submitted', id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({ 
      success: true, 
      message: 'Documents submitted successfully',
      status: 'documents_submitted'
    });
  } catch (error) {
    console.error('Error updating document submission status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update document submission status' 
    });
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
    const applications = await pool.query(
      'SELECT user_id, application_number FROM applications WHERE application_id = $1',
      [id]
    );

    if (applications.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const application = applications.rows[0];

    const result = await pool.query(
      `UPDATE applications SET status = $1, reviewer_notes = $2, updated_at = NOW()
       WHERE application_id = $3`,
      [status, reviewer_notes || null, id]
    );

    if (result.rowCount === 0) {
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

// POST /api/applications/:id/page-approval - Approve or reject individual pages
router.post('/:id/page-approval', authMiddleware, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const { id } = req.params;
    const { pageNumber, status, reviewerNotes } = req.body;
    const reviewerId = req.user.user_id;
    
    // Get current application
    const appResult = await pool.query(
      'SELECT * FROM applications WHERE application_id = $1',
      [id]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    
    const application = appResult.rows[0];
    const pageStatuses = application.form_data?.pageStatuses || {};
    pageStatuses[`page${pageNumber}`] = status;
    
    // Update form_data with page status
    const updatedFormData = {
      ...application.form_data,
      pageStatuses,
      [`page${pageNumber}_review`]: {
        status,
        reviewedBy: reviewerId,
        reviewedAt: new Date().toISOString(),
        notes: reviewerNotes
      }
    };
    
    // Check if all pages are approved
    const allApproved = [1,2,3,4,5,6].every(num => 
      pageStatuses[`page${num}`] === 'approved'
    );
    
    const newStatus = allApproved ? 'ready_for_requirements' : application.status;
    
    // Update application
    await pool.query(
      `UPDATE applications 
       SET form_data = $1, status = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE application_id = $4`,
      [JSON.stringify(updatedFormData), newStatus, reviewerId, id]
    );
    
    // Send notification if all pages approved
    if (allApproved) {
      // TODO: Send email notification to user
      console.log('All pages approved, notifying user to submit requirements');
    }
    
    res.json({
      success: true,
      message: `Page ${pageNumber} ${status}`,
      allPagesApproved: allApproved
    });
    
  } catch (error) {
    console.error('Page approval error:', error);
    res.status(500).json({ success: false, message: 'Failed to update page status' });
  }
});

// POST /api/applications/:id/regenerate-certificate - Manually regenerate COC for approved application
router.post('/:id/regenerate-certificate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔄 Manual certificate regeneration for application:', id);
    
    // Check application status
    const appCheck = await pool.query(
      'SELECT * FROM applications WHERE application_id = $1',
      [id]
    );
    
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    
    const application = appCheck.rows[0];
    
    if (application.status !== 'certificate_issued') {
      return res.status(400).json({ 
        success: false, 
        message: 'Application must have certificate_issued status' 
      });
    }
    
    // Generate COC number
    const cocNumber = generateCOCNumber(id);
    
    // Get application data with user info for COC
    const appData = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM applications a
       LEFT JOIN users u ON a.user_id = u.user_id
       WHERE a.application_id = $1`,
      [id]
    );
    
    if (appData.rows.length > 0) {
      // Create certificates directory if it doesn't exist
      const certsDir = path.join(process.cwd(), 'uploads', 'certificates');
      if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
      }
      
      // Generate PDF file path
      const fileName = `COC-${cocNumber}-${Date.now()}.pdf`;
      const filePath = path.join(certsDir, fileName);
      
      // Generate COC PDF
      console.log('🔄 Generating COC PDF...');
      await generateCOC(appData.rows[0], cocNumber, filePath);
      console.log('✅ PDF file created:', filePath);
      
      // Store file path mapping for download (using certificate number)
      global.certificateFiles = global.certificateFiles || {};
      global.certificateFiles[cocNumber] = filePath;
      global.certificateFiles[`app_${id}`] = { cocNumber, filePath };
      
      // Try to store certificate record in database (non-blocking)
      try {
        // First, check if certificates table exists
        const tableCheck = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'certificates'
          )`
        );
        
        if (tableCheck.rows[0].exists) {
          // Table exists, try to insert
          try {
            await pool.query(
              `INSERT INTO certificates (application_id, certificate_number, issued_date, status)
               VALUES ($1, $2, NOW(), 'active')
               ON CONFLICT (application_id) DO UPDATE SET 
               certificate_number = $2, issued_date = NOW(), status = 'active'`,
              [id, cocNumber]
            );
            console.log('✅ Certificate record saved to database');
          } catch (insertError) {
            console.log('⚠️ DB insert failed (trying delete+insert):', insertError.message);
            try {
              await pool.query('DELETE FROM certificates WHERE application_id = $1', [id]);
              await pool.query(
                'INSERT INTO certificates (application_id, certificate_number, issued_date, status) VALUES ($1, $2, NOW(), \'active\')',
                [id, cocNumber]
              );
              console.log('✅ Certificate record saved (second attempt)');
            } catch (e2) {
              console.log('⚠️ DB save failed, but PDF exists in memory');
            }
          }
        } else {
          console.log('⚠️ Certificates table does not exist, skipping DB save');
        }
      } catch (dbError) {
        console.log('⚠️ Database error (non-critical):', dbError.message);
      }
      
      console.log('✅ Certificate regenerated successfully:', cocNumber, filePath);
      
      return res.json({
        success: true,
        message: 'Certificate generated successfully',
        certificateNumber: cocNumber
      });
    }
    
    return res.status(500).json({ success: false, message: 'Failed to generate certificate' });
    
  } catch (error) {
    console.error('❌ Error regenerating certificate:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to regenerate certificate',
      error: error.message 
    });
  }
});

// GET /api/applications/:id/certificate - Download COC certificate
router.get('/:id/certificate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    console.log('📥 Certificate download request for application:', id);
    console.log('   User ID:', userId, '| Role:', req.user.role);
    
    // First, check if we have the file in memory
    const memoryEntry = global.certificateFiles?.[`app_${id}`];
    
    if (memoryEntry && memoryEntry.filePath && fs.existsSync(memoryEntry.filePath)) {
      console.log('   ✅ Found certificate in memory:', memoryEntry.filePath);
      
      // Check permission
      const appCheck = await pool.query(
        'SELECT user_id FROM applications WHERE application_id = $1',
        [id]
      );
      
      if (appCheck.rows.length > 0) {
        const appUserId = appCheck.rows[0].user_id;
        if (appUserId === userId || req.user.role === 'admin') {
          const fileName = `COC-${memoryEntry.cocNumber}.pdf`;
          return res.download(memoryEntry.filePath, fileName);
        } else {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }
    
    // If not in memory, try database
    console.log('   Checking database for certificate...');
    const result = await pool.query(
      `SELECT c.*, a.user_id, a.application_number, a.status
       FROM certificates c
       JOIN applications a ON c.application_id = a.application_id
       WHERE c.application_id = $1`,
      [id]
    );
    
    console.log('   Certificate query result:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      // Check if application exists
      const appCheck = await pool.query(
        'SELECT application_id, status FROM applications WHERE application_id = $1',
        [id]
      );
      
      console.log('   ❌ No certificate found. Application exists:', appCheck.rows.length > 0);
      if (appCheck.rows.length > 0) {
        console.log('   Application status:', appCheck.rows[0].status);
      }
      
      return res.status(404).json({ 
        success: false, 
        message: 'Certificate not found. Click download to generate it automatically.' 
      });
    }
    
    const certificate = result.rows[0];
    
    // Check permission (user owns application or is admin)
    if (certificate.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }
    
    // Check if file exists
    if (!certificate.file_path || !fs.existsSync(certificate.file_path)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Certificate file not found' 
      });
    }
    
    // Send file
    const fileName = `COC-${certificate.certificate_number}.pdf`;
    res.download(certificate.file_path, fileName);
    
  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to download certificate' 
    });
  }
});

// PUT /api/applications/:id/requirements-status - Admin approves/rejects requirements
router.put('/:id/requirements-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, rejection_reason } = req.body;
    
    // Validate status
    const validStatuses = ['requirements_approved', 'requirements_rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }
    
    // Update application status
    const updateQuery = status === 'requirements_approved' 
      ? `UPDATE applications 
         SET status = $1, 
             updated_at = NOW() 
         WHERE application_id = $2 
         RETURNING *`
      : `UPDATE applications 
         SET status = $1, 
             rejection_reason = $2,
             updated_at = NOW() 
         WHERE application_id = $3 
         RETURNING *`;
    
    const params = status === 'requirements_approved' 
      ? ['certificate_issued', id]
      : ['requirements_rejected', rejection_reason, id];
    
    const result = await pool.query(updateQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Application not found' 
      });
    }
    
    // If approved, generate certificate and COC PDF
    if (status === 'requirements_approved') {
      try {
        // Generate COC number
        const cocNumber = generateCOCNumber(id);
        
        // Get application data with user info for COC
        const appData = await pool.query(
          `SELECT a.*, u.first_name, u.last_name, u.email
           FROM applications a
           LEFT JOIN users u ON a.user_id = u.user_id
           WHERE a.application_id = $1`,
          [id]
        );
        
        if (appData.rows.length > 0) {
          // Create certificates directory if it doesn't exist
          const certsDir = path.join(process.cwd(), 'uploads', 'certificates');
          if (!fs.existsSync(certsDir)) {
            fs.mkdirSync(certsDir, { recursive: true });
          }
          
          // Generate PDF file path
          const fileName = `COC-${cocNumber}-${Date.now()}.pdf`;
          const filePath = path.join(certsDir, fileName);
          
          // Generate COC PDF
          await generateCOC(appData.rows[0], cocNumber, filePath);
          
          // Store certificate record in database (without file_path)
          try {
            await pool.query(
              `INSERT INTO certificates (
                application_id,
                certificate_number,
                issued_date,
                status
              ) VALUES ($1, $2, NOW(), 'active')
              ON CONFLICT (application_id) 
              DO UPDATE SET 
                certificate_number = $2,
                issued_date = NOW(),
                status = 'active'`,
              [id, cocNumber]
            );
          } catch (dbError) {
            console.log('⚠️ DB Insert error, trying simpler insert');
            // Try without ON CONFLICT
            await pool.query(
              `DELETE FROM certificates WHERE application_id = $1`,
              [id]
            );
            await pool.query(
              `INSERT INTO certificates (application_id, certificate_number, issued_date, status)
               VALUES ($1, $2, NOW(), 'active')`,
              [id, cocNumber]
            );
          }
          
          // Store file path mapping for download
          global.certificateFiles = global.certificateFiles || {};
          global.certificateFiles[cocNumber] = filePath;
        }
      } catch (certError) {
        console.error('❌ Error generating COC:', certError);
        // Don't fail the approval if COC generation fails
      }
    }
    
    // Send notification to user
    const application = result.rows[0];
    await notifyApplicationStatusChange(application.user_id, application.application_id, status);
    
    res.json({
      success: true,
      message: status === 'requirements_approved' 
        ? 'Requirements approved successfully' 
        : 'Requirements rejected',
      application: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating requirements status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update requirements status' 
    });
  }
});

// POST /api/applications/:id/upload-requirement - Upload individual requirement file
router.post('/:id/upload-requirement', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { requirementId } = req.body;
    const userId = req.user.user_id || req.user.id;
    
    console.log('📄 Upload requirement request:');
    console.log('  Application ID:', id);
    console.log('  Requirement ID:', requirementId);
    console.log('  User ID:', userId);
    console.log('  File:', req.file ? req.file.originalname : 'NO FILE');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    // Verify application belongs to user
    const appResult = await pool.query(
      'SELECT * FROM applications WHERE application_id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (appResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Application not found or access denied' 
      });
    }
    
    // Store the uploaded file info in database
    const docResult = await pool.query(
      `INSERT INTO documents (
        application_id,
        document_type,
        file_path,
        file_name,
        is_requirement,
        uploaded_at
      ) VALUES ($1, $2, $3, $4, true, NOW())
      RETURNING *`,
      [id, requirementId, req.file.path, req.file.originalname]
    );
    
    console.log('✅ Document saved to database:');
    console.log('  Document ID:', docResult.rows[0].document_id);
    console.log('  Application ID:', docResult.rows[0].application_id);
    console.log('  Document Type:', docResult.rows[0].document_type);
    console.log('  File Path:', docResult.rows[0].file_path);
    console.log('  Is Requirement:', docResult.rows[0].is_requirement);
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      document: docResult.rows[0],
      fileUrl: `/uploads/${req.file.filename}`
    });
    
  } catch (error) {
    console.error('Error uploading requirement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload file' 
    });
  }
});

// POST /api/applications/:id/submit-requirements - User submits requirements after forms approved
router.post('/:id/submit-requirements', authMiddleware, upload.fields([
  { name: 'birth_certificate', maxCount: 1 },
  { name: 'valid_id', maxCount: 1 },
  { name: 'proof_of_income', maxCount: 1 },
  { name: 'other_documents', maxCount: 5 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id || req.user.id;
    
    // Verify application belongs to user and is ready for requirements
    const appResult = await pool.query(
      'SELECT * FROM applications WHERE application_id = $1 AND user_id = $2 AND status = $3',
      [id, userId, 'ready_for_requirements']
    );
    
    if (appResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Application not found or not ready for requirements' 
      });
    }
    
    // Store requirement documents
    const requirementPromises = Object.entries(req.files).map(([reqType, fileArray]) => {
      const file = fileArray[0];
      return pool.query(
        `INSERT INTO documents (
          application_id,
          document_type,
          file_path,
          file_name,
          is_requirement,
          uploaded_at
        ) VALUES ($1, $2, $3, $4, true, NOW())`,
        [id, reqType, file.path, file.originalname]
      );
    });
    
    await Promise.all(requirementPromises);
    
    // Update application status
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = NOW() WHERE application_id = $2',
      ['requirements_submitted', id]
    );
    
    res.json({
      success: true,
      message: 'Requirements submitted successfully. Admin will review them soon.'
    });
    
  } catch (error) {
    console.error('Requirements submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit requirements' });
  }
});

// GET /api/applications/check-deadlines - Auto-cancel expired applications
router.get('/check-deadlines', async (_req, res) => {
  try {
    // Find and cancel applications past their deadline
    const result = await pool.query(
      `UPDATE applications 
       SET status = 'cancelled',
           cancellation_reason = 'Deadline expired - Requirements not submitted within 20 days',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE status = 'certificate_issued' 
         AND submission_deadline < NOW()
         AND submission_deadline IS NOT NULL
       RETURNING application_id, application_number, user_id`
    );
    
    const cancelledCount = result.rowCount;
    
    if (cancelledCount > 0) {
      console.log(`Auto-cancelled ${cancelledCount} expired applications:`, result.rows);
      
      // TODO: Send notification emails to affected users
    }
    
    res.json({
      success: true,
      message: `Checked deadlines. ${cancelledCount} applications auto-cancelled.`,
      cancelled: result.rows
    });
    
  } catch (error) {
    console.error('Error checking deadlines:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check application deadlines'
    });
  }
});

export default router;