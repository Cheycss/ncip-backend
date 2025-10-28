import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pool from '../database.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET /api/pdf/coc-form - Download the COC form template
router.get('/coc-form', (req, res) => {
  try {
    const pdfPath = path.join(__dirname, '..', '..', '2025 coc-form- Alabel CSC.pdf');
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'COC form template not found' 
      });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="COC_Form_Alabel_CSC.pdf"');
    
    // Send the file
    res.sendFile(pdfPath);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to download PDF' 
    });
  }
});

// POST /api/pdf/generate-coc - Generate filled COC PDF from consolidated data
router.post('/generate-coc', async (req, res) => {
  try {
    console.log('📄 PDF Generation Request received');
    
    // Extract form data from request body
    const { formData, applicationId } = req.body;
    
    if (!formData) {
      return res.status(400).json({
        success: false,
        message: 'Form data is required for PDF generation'
      });
    }

    // Log the consolidated data structure for debugging
    console.log('📋 Form data structure:', {
      hasPersonalInfo: !!formData.personalInfo || !!formData.firstName,
      hasPage2: !!formData.page2,
      hasPage3: !!formData.page3,
      hasPage4: !!formData.page4,
      hasGenealogy: !!formData.genealogy || !!formData.fatherName,
      applicationId: applicationId
    });

    // Store application data in database if applicationId is provided
    if (applicationId) {
      try {
        await pool.query(
          `UPDATE applications 
           SET form_data = ?, 
               pdf_generated_at = NOW(),
               status = 'pdf_generated'
           WHERE id = ?`,
          [JSON.stringify(formData), applicationId]
        );
        console.log('✅ Application data updated in database');
      } catch (dbError) {
        console.warn('⚠️ Database update failed:', dbError.message);
        // Continue with PDF generation even if DB update fails
      }
    }

    // Return success response with instructions for frontend PDF generation
    res.json({
      success: true,
      message: 'PDF generation data prepared successfully',
      data: {
        consolidatedData: formData,
        applicationId: applicationId,
        generatedAt: new Date().toISOString(),
        instructions: {
          step1: 'Data has been consolidated into structured format',
          step2: 'Use frontend PDF generator with this consolidated data',
          step3: 'Field mappings will be applied automatically',
          step4: 'All 5 pages will be generated and merged'
        }
      }
    });

  } catch (error) {
    console.error('❌ PDF generation error:', error);
    res.status(500).json({
      success: false,
      message: 'PDF generation failed',
      error: error.message
    });
  }
});

// GET /api/pdf/application/:id - Get application data for PDF generation
router.get('/application/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📋 Fetching application data for ID: ${id}`);
    
    // Get application data from database
    const [rows] = await pool.query(
      `SELECT 
        id,
        user_id,
        purpose_id,
        form_data,
        status,
        created_at,
        updated_at,
        pdf_generated_at
       FROM applications 
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const application = rows[0];
    
    // Parse form_data JSON
    let formData = {};
    try {
      formData = JSON.parse(application.form_data || '{}');
    } catch (parseError) {
      console.warn('⚠️ Error parsing form_data JSON:', parseError.message);
    }

    // Get purpose information
    let purpose = null;
    if (application.purpose_id) {
      try {
        const [purposeRows] = await pool.query(
          'SELECT purpose_name, code, description FROM purposes WHERE purpose_id = ?',
          [application.purpose_id]
        );
        if (purposeRows.length > 0) {
          purpose = purposeRows[0];
        }
      } catch (purposeError) {
        console.warn('⚠️ Error fetching purpose:', purposeError.message);
      }
    }

    res.json({
      success: true,
      data: {
        application: {
          id: application.id,
          userId: application.user_id,
          purposeId: application.purpose_id,
          status: application.status,
          createdAt: application.created_at,
          updatedAt: application.updated_at,
          pdfGeneratedAt: application.pdf_generated_at
        },
        formData: formData,
        purpose: purpose
      }
    });

  } catch (error) {
    console.error('❌ Error fetching application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch application data',
      error: error.message
    });
  }
});

export default router;
