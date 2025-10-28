/**
 * Database Migration Runner
 * Run this to create the uploaded_documents table
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running database migration for uploaded_documents table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'create_uploaded_documents_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim().startsWith('--') || statement.trim().length === 0) {
        continue; // Skip comments and empty lines
      }
      
      try {
        await pool.query(statement);
        console.log('✅ Executed statement successfully');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️ Table already exists, skipping...');
        } else {
          console.error('❌ Error executing statement:', error.message);
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Test the table
    const [result] = await pool.query('DESCRIBE uploaded_documents');
    console.log('\n📋 Table structure:');
    console.table(result);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration();
