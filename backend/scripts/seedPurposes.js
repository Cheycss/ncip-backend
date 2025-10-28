import pool from '../database.js';

const defaultPurposes = [
  {
    purpose_name: 'Educational Assistance',
    description: 'For students seeking educational support',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'school_id', name: 'School ID', required: true },
      { id: 'certificate_of_enrollment', name: 'Certificate of Enrollment', required: true },
      { id: 'grades', name: 'Latest Report Card/Grades', required: true },
      { id: 'certificate_of_indigency', name: 'Certificate of Indigency', required: false }
    ])
  },
  {
    purpose_name: 'Scholarship Application',
    description: 'For scholarship programs',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'certificate_of_indigency', name: 'Certificate of Indigency', required: true },
      { id: 'school_records', name: 'School Records/Transcript', required: true },
      { id: 'recommendation_letter', name: 'Recommendation Letter', required: true },
      { id: 'essay', name: 'Application Essay', required: false }
    ])
  },
  {
    purpose_name: 'Employment',
    description: 'For job applications and employment verification',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'valid_id', name: 'Valid Government ID', required: true },
      { id: 'resume', name: 'Resume/CV', required: true },
      { id: 'nbi_clearance', name: 'NBI Clearance', required: false },
      { id: 'police_clearance', name: 'Police Clearance', required: false }
    ])
  },
  {
    purpose_name: 'Business Permit',
    description: 'For business registration and permits',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'valid_id', name: 'Valid Government ID', required: true },
      { id: 'business_plan', name: 'Business Plan', required: true },
      { id: 'barangay_clearance', name: 'Barangay Clearance', required: true },
      { id: 'location_sketch', name: 'Location Sketch/Map', required: false }
    ])
  },
  {
    purpose_name: 'Land Claim/Ancestral Domain',
    description: 'For ancestral land claims and domain applications',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'tax_declaration', name: 'Tax Declaration', required: true },
      { id: 'land_survey', name: 'Land Survey/Sketch Plan', required: true },
      { id: 'affidavit_of_ownership', name: 'Affidavit of Ownership', required: true },
      { id: 'witness_affidavits', name: 'Witness Affidavits (2 persons)', required: true }
    ])
  },
  {
    purpose_name: 'Health/Medical Assistance',
    description: 'For medical and health-related assistance',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'medical_certificate', name: 'Medical Certificate', required: true },
      { id: 'hospital_bills', name: 'Hospital Bills/Medical Records', required: true },
      { id: 'certificate_of_indigency', name: 'Certificate of Indigency', required: true },
      { id: 'prescription', name: 'Doctor\'s Prescription', required: false }
    ])
  },
  {
    purpose_name: 'Housing Assistance',
    description: 'For housing programs and relocation',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'marriage_certificate', name: 'Marriage Certificate (if married)', required: false },
      { id: 'certificate_of_indigency', name: 'Certificate of Indigency', required: true },
      { id: 'proof_of_residency', name: 'Proof of Residency', required: true },
      { id: 'family_photo', name: 'Family Photo', required: false }
    ])
  },
  {
    purpose_name: 'Livelihood Program',
    description: 'For livelihood and skills training programs',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'valid_id', name: 'Valid Government ID', required: true },
      { id: 'certificate_of_indigency', name: 'Certificate of Indigency', required: false },
      { id: 'skills_certificate', name: 'Skills Training Certificate (if any)', required: false },
      { id: 'business_proposal', name: 'Business Proposal', required: true }
    ])
  },
  {
    purpose_name: 'Senior Citizen Benefits',
    description: 'For senior citizen ID and benefits',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'valid_id', name: 'Valid Government ID', required: true },
      { id: 'recent_photo', name: 'Recent 2x2 Photo', required: true },
      { id: 'proof_of_age', name: 'Proof of Age (60 years old and above)', required: true }
    ])
  },
  {
    purpose_name: 'PWD Benefits',
    description: 'For persons with disability benefits',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'medical_certificate', name: 'Medical Certificate (PWD)', required: true },
      { id: 'valid_id', name: 'Valid Government ID', required: true },
      { id: 'recent_photo', name: 'Recent 2x2 Photo', required: true },
      { id: 'disability_assessment', name: 'Disability Assessment Form', required: true }
    ])
  },
  {
    purpose_name: 'Other Purpose',
    description: 'For other purposes not listed',
    requirements: JSON.stringify([
      { id: 'birth_certificate', name: 'Birth Certificate (PSA Copy)', required: true },
      { id: 'valid_id', name: 'Valid Government ID', required: true },
      { id: 'supporting_documents', name: 'Supporting Documents', required: false }
    ])
  }
];

async function seedPurposes() {
  console.log('🌱 Seeding purposes...\n');

  try {
    // Check if purposes already exist
    const [existing] = await pool.query('SELECT COUNT(*) as count FROM purposes');
    
    if (existing[0].count > 0) {
      console.log(`⚠️  Found ${existing[0].count} existing purposes`);
      console.log('   Do you want to clear and reseed? (This will delete existing purposes)');
      console.log('   Run with --force flag to clear and reseed\n');
      
      if (!process.argv.includes('--force')) {
        console.log('✅ Skipping seed (use --force to override)');
        process.exit(0);
      }
      
      console.log('🗑️  Clearing existing purposes...');
      await pool.query('DELETE FROM purposes');
    }

    // Insert default purposes
    for (const purpose of defaultPurposes) {
      const code = purpose.purpose_name.split(' ').map(w => w[0]).join('').toUpperCase();
      await pool.query(
        'INSERT INTO purposes (purpose_name, code, description, requirements) VALUES (?, ?, ?, ?)',
        [purpose.purpose_name, code, purpose.description, purpose.requirements]
      );
    }

    console.log(`✅ Successfully seeded ${defaultPurposes.length} purposes!\n`);
    console.log('📋 Purposes added:');
    defaultPurposes.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.purpose_name}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error seeding purposes:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedPurposes();
