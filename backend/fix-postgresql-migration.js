#!/usr/bin/env node

/**
 * PostgreSQL Migration Fix Script
 * This script helps fix common issues when migrating from MySQL to PostgreSQL
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔧 PostgreSQL Migration Fix Script');
console.log('==================================');

// 1. Install PostgreSQL dependency
console.log('\n1. Installing PostgreSQL dependency...');
try {
  execSync('npm install pg@^8.11.3', { stdio: 'inherit' });
  console.log('✅ PostgreSQL driver installed successfully');
} catch (error) {
  console.error('❌ Failed to install PostgreSQL driver:', error.message);
}

// 2. Remove MySQL dependency (optional)
console.log('\n2. Removing MySQL dependency...');
try {
  execSync('npm uninstall mysql2', { stdio: 'inherit' });
  console.log('✅ MySQL driver removed successfully');
} catch (error) {
  console.log('⚠️  MySQL driver not found or already removed');
}

// 3. Check database connection
console.log('\n3. Testing database connection...');
try {
  const { default: pool } = await import('./database.js');
  const result = await pool.query('SELECT NOW() as current_time');
  console.log('✅ Database connection successful');
  console.log('📅 Current database time:', result.rows[0].current_time);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  console.log('💡 Make sure your DATABASE_URL is correct in .env file');
}

// 4. Check if tables exist
console.log('\n4. Checking database tables...');
try {
  const { default: pool } = await import('./database.js');
  
  const tables = ['users', 'purposes', 'applications', 'genealogy_records'];
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`✅ Table '${table}': ${result.rows[0].count} records`);
    } catch (error) {
      console.log(`❌ Table '${table}': Not found or error`);
    }
  }
} catch (error) {
  console.error('❌ Failed to check tables:', error.message);
}

// 5. Seed data if needed
console.log('\n5. Checking if data seeding is needed...');
try {
  const { default: pool } = await import('./database.js');
  
  // Check if purposes table has data
  const purposesResult = await pool.query('SELECT COUNT(*) FROM purposes');
  const purposesCount = parseInt(purposesResult.rows[0].count);
  
  if (purposesCount === 0) {
    console.log('📝 Purposes table is empty, seeding data...');
    // You can add seeding logic here or run separate seed scripts
    console.log('💡 Run: node scripts/seedPurposes.js to seed purposes data');
  } else {
    console.log(`✅ Purposes table has ${purposesCount} records`);
  }
  
  // Check if users table has data
  const usersResult = await pool.query('SELECT COUNT(*) FROM users');
  const usersCount = parseInt(usersResult.rows[0].count);
  
  if (usersCount === 0) {
    console.log('📝 Users table is empty, seeding data...');
    console.log('💡 Run: node scripts/seedUsers.js to seed users data');
  } else {
    console.log(`✅ Users table has ${usersCount} records`);
  }
  
} catch (error) {
  console.error('❌ Failed to check data:', error.message);
}

console.log('\n🎉 Migration check complete!');
console.log('\n📋 Next steps:');
console.log('1. Make sure all route files use PostgreSQL syntax ($1, $2, etc.)');
console.log('2. Test API endpoints to ensure they work correctly');
console.log('3. Deploy to Render with the updated dependencies');
console.log('4. Run database seeding if tables are empty');
