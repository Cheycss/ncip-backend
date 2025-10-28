import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ncip_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Format output
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logTable(title, color = 'cyan') {
  log(`\n📊 ${title}`, color);
  console.log('-'.repeat(60));
}

// Get all data from database
async function getAllData() {
  let connection;
  const allData = {};

  try {
    connection = await pool.getConnection();
    log('✅ Connected to database successfully!', 'green');

    // Get database name
    const [dbInfo] = await connection.query('SELECT DATABASE() as db_name');
    const dbName = dbInfo[0].db_name;
    logSection(`DATABASE: ${dbName}`);

    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    log(`\n📋 Total Tables Found: ${tableNames.length}`, 'yellow');
    log(`Tables: ${tableNames.join(', ')}`, 'cyan');

    // Fetch data from each table
    for (const tableName of tableNames) {
      logTable(tableName.toUpperCase(), 'magenta');

      try {
        // Get table structure
        const [columns] = await connection.query(`DESCRIBE ${tableName}`);
        log(`Columns: ${columns.map(col => col.Field).join(', ')}`, 'blue');

        // Get row count
        const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const rowCount = countResult[0].count;
        log(`Total Rows: ${rowCount}`, 'yellow');

        // Get all data
        const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
        allData[tableName] = {
          columns: columns.map(col => ({
            field: col.Field,
            type: col.Type,
            null: col.Null,
            key: col.Key,
            default: col.Default,
            extra: col.Extra
          })),
          rowCount: rowCount,
          data: rows
        };

        // Display sample data (first 3 rows)
        if (rows.length > 0) {
          log('\nSample Data (First 3 rows):', 'green');
          console.table(rows.slice(0, 3));
        } else {
          log('No data in this table', 'red');
        }

      } catch (error) {
        log(`❌ Error fetching data from ${tableName}: ${error.message}`, 'red');
      }
    }

    // Summary Statistics
    logSection('DATABASE SUMMARY');
    
    const summary = {
      database: dbName,
      totalTables: tableNames.length,
      tables: {}
    };

    for (const [tableName, tableData] of Object.entries(allData)) {
      summary.tables[tableName] = {
        columns: tableData.columns.length,
        rows: tableData.rowCount
      };
      log(`${tableName}: ${tableData.rowCount} rows, ${tableData.columns.length} columns`, 'cyan');
    }

    // Export to JSON file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(__dirname, '../exports');
    
    // Create exports directory if it doesn't exist
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const exportFile = path.join(exportDir, `database_export_${timestamp}.json`);
    fs.writeFileSync(exportFile, JSON.stringify(allData, null, 2));
    
    logSection('EXPORT COMPLETE');
    log(`✅ Data exported to: ${exportFile}`, 'green');
    log(`📦 File size: ${(fs.statSync(exportFile).size / 1024).toFixed(2)} KB`, 'yellow');

    // Export summary
    const summaryFile = path.join(exportDir, `database_summary_${timestamp}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    log(`✅ Summary exported to: ${summaryFile}`, 'green');

    return allData;

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
      log('\n✅ Database connection closed', 'green');
    }
  }
}

// Get specific table data
async function getTableData(tableName) {
  let connection;
  try {
    connection = await pool.getConnection();
    logSection(`TABLE: ${tableName.toUpperCase()}`);

    // Get table structure
    const [columns] = await connection.query(`DESCRIBE ${tableName}`);
    log('Columns:', 'cyan');
    console.table(columns);

    // Get all data
    const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
    log(`\nTotal Rows: ${rows.length}`, 'yellow');
    
    if (rows.length > 0) {
      log('\nData:', 'green');
      console.table(rows);
    } else {
      log('No data in this table', 'red');
    }

    return rows;

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Get database statistics
async function getDatabaseStats() {
  let connection;
  try {
    connection = await pool.getConnection();
    logSection('DATABASE STATISTICS');

    // Database info
    const [dbInfo] = await connection.query('SELECT DATABASE() as db_name, VERSION() as version');
    log(`Database: ${dbInfo[0].db_name}`, 'cyan');
    log(`MySQL Version: ${dbInfo[0].version}`, 'cyan');

    // Table sizes
    const [tableSizes] = await connection.query(`
      SELECT 
        table_name,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
        table_rows
      FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
      ORDER BY (data_length + index_length) DESC
    `);

    log('\nTable Sizes:', 'yellow');
    console.table(tableSizes);

    // Total database size
    const [dbSize] = await connection.query(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS total_size_mb
      FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
    `);

    log(`\nTotal Database Size: ${dbSize[0].total_size_mb} MB`, 'green');

    return { dbInfo: dbInfo[0], tableSizes, totalSize: dbSize[0].total_size_mb };

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];

  try {
    logSection('NCIP DATABASE ACCESS SCRIPT');
    log('Starting database access...', 'cyan');

    switch (command) {
      case 'table':
        if (!param) {
          log('❌ Please specify a table name', 'red');
          log('Usage: node getAllData.js table <table_name>', 'yellow');
          break;
        }
        await getTableData(param);
        break;

      case 'stats':
        await getDatabaseStats();
        break;

      case 'all':
      default:
        await getAllData();
        break;
    }

    log('\n✅ Script completed successfully!', 'green');
    process.exit(0);

  } catch (error) {
    log('\n❌ Script failed!', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { getAllData, getTableData, getDatabaseStats };
