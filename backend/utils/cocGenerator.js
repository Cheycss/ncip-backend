import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateCOC(applicationData, cocNumber, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'LEGAL', 
        margins: { top: 72, bottom: 72, left: 72, right: 72 } 
      });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Parse form data
      const formData = typeof applicationData.form_data === 'string' 
        ? JSON.parse(applicationData.form_data) 
        : applicationData.form_data;
      
      console.log('📄 Generating COC with form data:', JSON.stringify(formData, null, 2));
      
      const personalInfo = formData?.page1 || formData || {};
      const barangayInfo = formData?.page2 || {};
      const tribalInfo = formData?.page3 || {};
      const affidavitInfo = formData?.page4 || {};
      const genealogyInfo = formData?.page5 || {};
      
      // Extract all user details - try multiple field name variations
      const firstName = personalInfo.first_name || personalInfo.firstName || personalInfo.firstname || '';
      const middleName = personalInfo.middle_name || personalInfo.middleName || personalInfo.middlename || '';
      const lastName = personalInfo.last_name || personalInfo.lastName || personalInfo.lastname || '';
      const suffix = personalInfo.suffix || personalInfo.name_suffix || '';
      const fullName = `${firstName} ${middleName} ${lastName} ${suffix}`.trim().toUpperCase();
      
      const birthDate = personalInfo.birth_date || personalInfo.birthDate || personalInfo.date_of_birth || personalInfo.birthdate || '';
      const birthPlace = personalInfo.birth_place || personalInfo.birthPlace || personalInfo.place_of_birth || personalInfo.birthplace || '';
      const sex = personalInfo.sex || personalInfo.gender || '';
      const civilStatus = personalInfo.civil_status || personalInfo.civilStatus || personalInfo.marital_status || '';
      const bloodType = personalInfo.blood_type || personalInfo.bloodType || '';
      const occupation = personalInfo.occupation || '';
      const monthlyIncome = personalInfo.monthly_income || personalInfo.monthlyIncome || personalInfo.income || '';
      
      const fatherName = personalInfo.father_name || personalInfo.fatherName || personalInfo.fathers_name || affidavitInfo?.father_name || '';
      const motherName = personalInfo.mother_name || personalInfo.motherName || personalInfo.mothers_name || affidavitInfo?.mother_name || '';
      const contactNumber = personalInfo.contact_number || personalInfo.contactNumber || personalInfo.phone || personalInfo.mobile || '';
      const email = personalInfo.email || personalInfo.email_address || '';
      
      const tribe = personalInfo.ethnic_tribe || personalInfo.ethnicTribe || personalInfo.tribe || tribalInfo?.ethnic_tribe || 'Blaan';
      const barangay = personalInfo.barangay || personalInfo.brgy || 'N/A';
      const municipality = personalInfo.municipality || personalInfo.city || 'Alabel';
      const province = personalInfo.province || 'Sarangani';
      const presentAddress = personalInfo.present_address || personalInfo.presentAddress || `${barangay}, ${municipality}, ${province}`;
      
      const tribalChieftain = tribalInfo?.tribal_chieftain || barangayInfo?.barangay_captain || '';
      
      console.log('✅ All extracted data:', { fullName, tribe, barangay, municipality, fatherName, motherName, email, contactNumber });
      
      // Header
      doc.fontSize(9).font('Helvetica');
      doc.text('REPUBLIC OF THE PHILIPPINES', { align: 'center' });
      doc.text('OFFICE OF THE PRESIDENT', { align: 'center' });
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('NATIONAL COMMISSION ON INDIGENOUS PEOPLES', { align: 'center' });
      doc.moveDown(1);

      // Title
      doc.fontSize(22).font('Helvetica-Bold');
      doc.text('CERTIFICATE OF CONFIRMATION', { align: 'center' });
      doc.moveDown(0.3);
      
      // "be it known that:"
      doc.fontSize(10).font('Helvetica-Oblique');
      doc.text('be it known that:', { align: 'center' });
      doc.moveDown(0.5);

      // COC Number
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`COC NO. ${cocNumber}`, { align: 'right' });
      doc.moveDown(1);

      // Main Content - EXACT wording from official form
      doc.fontSize(10).font('Helvetica');
      
      const pronoun = sex === 'Male' ? 'his' : sex === 'Female' ? 'her' : 'their';
      
      // First paragraph
      doc.text(`whose photo appears below is a bonafide member of the Indigenous Peoples (IP) belonging to the ${fullName || '______________'} Indigenous Cultural Community (ICC) of Barangay ${barangay || '______________'}, Municipality of ${municipality || '______________'}, Province of Sarangani, Philippines, as Certified by Barangay Tribal Chieftain, ${tribalChieftain || '______________'}.`, { 
        align: 'justify'
      });
      doc.moveDown(1);
      
      // Second paragraph with CONFIRMS in bold
      doc.font('Helvetica');
      doc.text('This Office hereby presents and ', { continued: true });
      doc.font('Helvetica-Bold').text('CONFIRMS', { continued: true });
      doc.font('Helvetica').text(` the membership of ${fullName || '______________'} to the ${tribe || '______________'} ICC and thus, entitles ${pronoun} to all the rights, benefits and privileges accorded to the Indigenous Peoples (IP) under Republic Act No. 8371 and all other laws, decrees, rules and regulations and other issuance of the Government relative thereto.`);
      doc.moveDown(1);
      
      // Disclaimer - THIS OFFICE in bold
      doc.fontSize(9);
      doc.font('Helvetica-Bold').text('THIS OFFICE', { continued: true });
      doc.font('Helvetica').text(', however, reserves the authority to undertake whatever action is needed to protect the rights and interests of the Indigenous Cultural Communities/Indigenous Peoples (ICCs/IPs) concerned, including the cancellation/revocation of this certification should the holder violates any laws.');
      doc.moveDown(1.5);
      
      // Issue date and purpose
      const issueDate = new Date();
      doc.fontSize(10).font('Helvetica');
      doc.text(`Issued this ________ day of ______________  ${issueDate.getFullYear()} upon the request of ______________ for `, { continued: true });
      doc.font('Helvetica-Bold').text('IP MEMBERSHIP/IDENTIFICATION');
      doc.font('Helvetica');
      doc.moveDown(0.5);
      doc.text('Recommending Confirmation:');
      doc.moveDown(2);
      
      // Tribal Affairs signature
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('SWEET JERREL L. ECOY', 72, doc.y);
      doc.font('Helvetica');
      doc.text('Tribal Affairs Assistant II', 72, doc.y + 2);
      
      // Confirmed section (right side)
      doc.text('Confirmed:', 350, doc.y - 30);
      doc.moveDown(3);
      
      // Main signature
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('DR. NIEVES F. CABIJE, MPA', { align: 'right' });
      doc.fontSize(9).font('Helvetica');
      doc.text('Acting Provincial Officer', { align: 'right' });
      doc.moveDown(1);
      
      // Footer
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('SARANGANI PROVINCIAL OFFICE', { align: 'center' });
      doc.fontSize(7).font('Helvetica');
      doc.text('(Doors 1 & 2, 2nd Floor, Capitol Gym, Provincial Capitol Cmpd, Alabel, Sarangani Province', { align: 'center' });
      doc.text('(083) 508 0802 / 0827 928 3050 | r12saranganipo@ncip.gov.ph / r12saranganipo@icip.gov.ph', { align: 'center' });
      
      doc.end();

      stream.on('finish', () => {
        console.log('✅ COC PDF generated:', outputPath);
        resolve(outputPath);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

export function generateCOCNumber(applicationId) {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const sequence = String(applicationId).padStart(3, '0');
  return `RXII-SAR-${month}-${year}-${sequence}`;
}