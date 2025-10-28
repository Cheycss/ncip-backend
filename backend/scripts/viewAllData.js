import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Simple database viewer
async function viewAllData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ncip_system'
  });

  try {
    console.log('\n✅ Connected to database!\n');
    console.log('='.repeat(80));
    console.log('DATABASE: ' + process.env.DB_NAME);
    console.log('='.repeat(80));

    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);

    console.log(`\n📋 Found ${tableNames.length} tables: ${tableNames.join(', ')}\n`);

    // Display data from each table
    for (const tableName of tableNames) {
      console.log('\n' + '─'.repeat(80));
      console.log(`📊 TABLE: ${tableName.toUpperCase()}`);
      console.log('─'.repeat(80));

      // Get row count
      const [count] = await connection.query(`SELECT COUNT(*) as total FROM ${tableName}`);
      console.log(`Total rows: ${count[0].total}`);

      // Get all data
      const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
      
      if (rows.length > 0) {
        console.log('\nData:');
        console.table(rows);
      } else {
        console.log('❌ No data in this table\n');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All data displayed successfully!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

viewAllData();
