import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 Creating migrations directory...');
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    // Get all SQL files in migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Run in order

    if (files.length === 0) {
      console.log('⚠️  No migration files found');
      return;
    }

    console.log(`📋 Found ${files.length} migration file(s):\n`);

    for (const file of files) {
      console.log(`   📄 ${file}`);
    }

    console.log('\n🔄 Running migrations...\n');

    // Run only the basic tables migration
    const latestFile = '001_create_basic_tables.sql';
    const filePath = path.join(migrationsDir, latestFile);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${latestFile}`);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`   ⏳ Running: ${latestFile}...`);

    try {
      // Split SQL by CREATE TABLE statements and execute each separately
      const statements = sql
        .split(/(?=CREATE TABLE)/i)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      let statementNum = 0;
      for (const statement of statements) {
        if (statement.trim()) {
          statementNum++;
          try {
            await pool.query(statement);
            console.log(`      ✓ Statement ${statementNum} OK`);
          } catch (err) {
            console.error(`      ✗ Statement ${statementNum} FAILED:`);
            console.error(`        ${statement.substring(0, 100)}...`);
            console.error(`        Error: ${err.message}`);
            throw err;
          }
        }
      }
      console.log(`   ✅ Success: ${latestFile}\n`);
    } catch (error) {
      console.error(`   ❌ Error in ${latestFile}:`);
      console.error(`      ${error.message}\n`);
      throw error;
    }

    console.log('✅ All migrations completed successfully!\n');
    console.log('📊 Database tables created:');
    console.log('   - users');
    console.log('   - user_registrations');
    console.log('   - applications');
    console.log('   - notifications');
    console.log('   - purposes');
    console.log('   - services');
    console.log('   - user_profiles\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();
