import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './database.js';

async function seedAll() {
  console.log('🌱 Seeding database...\n');
  
  try {
    // 1. Seed Users
    console.log('👤 Seeding users...');
    const users = [
      {
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@ncip.gov',
        password: 'admin123',
        role: 'admin'
      },
      {
        username: 'user',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        email: 'user@ncip.gov',
        password: 'user123',
        role: 'user'
      }
    ];

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [user.email]);

      if (existing.length > 0) {
        await pool.query(
          `UPDATE users SET username = ?, first_name = ?, last_name = ?, password_hash = ?, role = ?, is_active = 1, is_approved = 1 WHERE user_id = ?`,
          [user.username, user.firstName, user.lastName, passwordHash, user.role, existing[0].user_id]
        );
        console.log(`  ✓ Updated: ${user.email}`);
      } else {
        await pool.query(
          `INSERT INTO users (username, first_name, last_name, email, password_hash, role, is_active, is_approved) VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
          [user.username, user.firstName, user.lastName, user.email, passwordHash, user.role]
        );
        console.log(`  ✓ Created: ${user.email}`);
      }
    }

    // 2. Seed Purposes
    console.log('\n📋 Seeding purposes...');
    const purposes = [
      { name: 'Scholarship', description: 'For educational scholarship applications' },
      { name: 'Employment', description: 'For employment verification' },
      { name: 'Travel Abroad', description: 'For international travel documentation' },
      { name: 'Government Transaction', description: 'For government-related transactions' },
      { name: 'IP Identification', description: 'For indigenous peoples identification' },
      { name: 'Legal Matters', description: 'For legal proceedings and documentation' },
      { name: 'Business Registration', description: 'For business-related applications' },
      { name: 'Land Claim', description: 'For ancestral domain and land claims' },
      { name: 'Cultural Preservation', description: 'For cultural heritage documentation' },
      { name: 'Others', description: 'For other purposes not listed' }
    ];

    for (const purpose of purposes) {
      const [existing] = await pool.query('SELECT purpose_id FROM purposes WHERE purpose_name = ?', [purpose.name]);
      
      if (existing.length === 0) {
        await pool.query(
          `INSERT INTO purposes (purpose_name, description, is_active) VALUES (?, ?, 1)`,
          [purpose.name, purpose.description]
        );
        console.log(`  ✓ Created: ${purpose.name}`);
      } else {
        console.log(`  - Exists: ${purpose.name}`);
      }
    }

    console.log('\n✅ Database seeding completed!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Purposes: ${purposes.length}\n`);
    console.log('🔑 Login credentials:');
    console.log('   Admin: admin@ncip.gov / admin123');
    console.log('   User:  user@ncip.gov / user123\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedAll();
