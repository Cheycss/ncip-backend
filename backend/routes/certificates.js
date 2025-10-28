import express from 'express';
import pool from '../database.js';
import { jsPDF } from 'jspdf';

const router = express.Router();

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Certificate router is working!' });
});

// POST /api/applications/:id/generate-certificate - Generate official NCIP certificate
router.post('/:id/generate-certificate', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🏆 Generating certificate for application: ${id}`);

    // Fetch application data from database
    const [applications] = await pool.query(
      `SELECT 
        a.application_id,
        a.application_number,
        a.purpose,
        a.status,
        a.form_data,
        a.created_at,
        u.first_name,
        u.last_name,
        u.email
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

    // Check if application is approved and ready for certificate
    if (application.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Certificate can only be generated for approved applications',
        currentStatus: application.status
      });
    }

    // Parse form data to get applicant details
    let formData = {};
    try {
      formData = JSON.parse(application.form_data || '{}');
    } catch (e) {
      console.warn('Error parsing form_data:', e);
    }

    // Extract applicant information
    const applicantName = formData.personalInfo?.fullName || 
                         formData.name || 
                         `${application.first_name} ${application.last_name}`;
    
    const applicantAddress = formData.personalInfo?.address || 
                            formData.address || 
                            'Address not provided';
    
    const applicantTribe = formData.personalInfo?.tribe || 
                          formData.tribe || 
                          'Tribe not specified';

    const birthPlace = formData.personalInfo?.birthPlace || 
                      formData.birthPlace || 
                      'Birth place not provided';

    // Generate the official certificate PDF
    const certificatePDF = generateOfficialCertificate({
      applicantName,
      applicantAddress,
      applicantTribe,
      birthPlace,
      purpose: application.purpose,
      applicationNumber: application.application_number,
      issuanceDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    });

    // Update application status to indicate certificate was generated
    await pool.query(
      `UPDATE applications 
       SET status = 'certificate_issued', 
           updated_at = NOW()
       WHERE application_id = ?`,
      [parseInt(id)]
    );

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="NCIP_Certificate_${application.application_number}.pdf"`);
    
    // Send the PDF
    res.send(Buffer.from(certificatePDF.output('arraybuffer')));

    console.log(`✅ Certificate generated successfully for application: ${id}`);

  } catch (error) {
    console.error('❌ Error generating certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate certificate',
      error: error.message
    });
  }
});

// Function to generate the official NCIP certificate PDF
function generateOfficialCertificate(data) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const primaryBlue = '#1e40af';
  const goldColor = '#d97706';
  
  // Add decorative border
  doc.setDrawColor(30, 64, 175); // Blue border
  doc.setLineWidth(2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  
  // Inner decorative border
  doc.setDrawColor(217, 119, 6); // Gold border
  doc.setLineWidth(0.5);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // Header - Republic of the Philippines
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Republic of the Philippines', pageWidth / 2, 30, { align: 'center' });
  
  // NCIP Header
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text('NATIONAL COMMISSION ON INDIGENOUS PEOPLES', pageWidth / 2, 38, { align: 'center' });
  
  // Regional Office
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Regional Office XII - SOCCSKSARGEN', pageWidth / 2, 45, { align: 'center' });
  doc.text('Sarangani Provincial Office', pageWidth / 2, 51, { align: 'center' });

  // Certificate Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('CERTIFICATE OF CONFIRMATION', pageWidth / 2, 70, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(14);
  doc.setTextColor(217, 119, 6);
  doc.text('Indigenous Peoples Rights Act (IPRA) of 1997', pageWidth / 2, 78, { align: 'center' });

  // Decorative line
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(1);
  doc.line(50, 85, pageWidth - 50, 85);

  // Certificate Body
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const bodyStartY = 100;
  const lineHeight = 8;
  let currentY = bodyStartY;

  // Certificate text
  const certificationText = [
    'TO WHOM IT MAY CONCERN:',
    '',
    `This is to certify that ${data.applicantName.toUpperCase()}, a member of the`,
    `${data.applicantTribe} Indigenous Cultural Community, born in ${data.birthPlace},`,
    `and currently residing at ${data.applicantAddress}, has been duly`,
    'verified and confirmed as an Indigenous Person under the Indigenous',
    'Peoples Rights Act (IPRA) of 1997.',
    '',
    `This certificate is issued in connection with the applicant's request for`,
    `${data.purpose.toLowerCase()} and serves as official confirmation of their`,
    'indigenous status and cultural identity.',
    '',
    'This certification is valid and may be used for all legal purposes',
    'in accordance with the provisions of Republic Act No. 8371.'
  ];

  certificationText.forEach((line, index) => {
    if (line === 'TO WHOM IT MAY CONCERN:') {
      doc.setFont('helvetica', 'bold');
      doc.text(line, 25, currentY);
      doc.setFont('helvetica', 'normal');
    } else if (line === '') {
      // Empty line for spacing
    } else {
      // Justify text for better appearance
      const words = line.split(' ');
      if (words.length > 1) {
        doc.text(line, 25, currentY, { maxWidth: pageWidth - 50, align: 'justify' });
      } else {
        doc.text(line, 25, currentY);
      }
    }
    currentY += lineHeight;
  });

  // Issuance details
  currentY += 15;
  doc.setFont('helvetica', 'bold');
  doc.text(`Application No.: ${data.applicationNumber}`, 25, currentY);
  currentY += 8;
  doc.text(`Date Issued: ${data.issuanceDate}`, 25, currentY);
  currentY += 8;
  doc.text(`Place Issued: Alabel, Sarangani Province`, 25, currentY);

  // Signature section
  currentY += 25;
  
  // Official signature area
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  
  // Signature line
  const sigStartX = pageWidth - 80;
  const sigEndX = pageWidth - 25;
  doc.line(sigStartX, currentY, sigEndX, currentY);
  
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ATTY. [PROVINCIAL OFFICER NAME]', pageWidth - 52.5, currentY, { align: 'center' });
  
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Provincial Officer', pageWidth - 52.5, currentY, { align: 'center' });
  doc.text('NCIP Sarangani Province', pageWidth - 52.5, currentY + 4, { align: 'center' });

  // Official seal placeholder
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(1);
  doc.circle(45, currentY - 10, 15, 'S'); // 'S' for stroke only
  doc.setFontSize(8);
  doc.text('OFFICIAL', 45, currentY - 12, { align: 'center' });
  doc.text('SEAL', 45, currentY - 8, { align: 'center' });

  // Footer
  const footerY = pageHeight - 35;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('This certificate is computer-generated and requires no signature when issued electronically.', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Certificate ID: NCIP-${data.applicationNumber}-${new Date().getFullYear()}`, pageWidth / 2, footerY + 4, { align: 'center' });
  
  // QR Code placeholder (optional)
  doc.setDrawColor(150, 150, 150);
  doc.rect(pageWidth - 35, footerY - 15, 20, 20);
  doc.setFontSize(6);
  doc.text('QR CODE', pageWidth - 25, footerY - 5, { align: 'center' });

  return doc;
}

export default router;
