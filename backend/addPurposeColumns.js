import pool from './database.js';

async function addPurposeColumns() {
  try {
    console.log('📝 Adding missing columns to purposes table...\n');
    
    // Check existing columns
    const [existingColumns] = await pool.query('DESCRIBE purposes');
    const columnNames = existingColumns.map(col => col.Field);
    
    // Add code column if it doesn't exist
    if (!columnNames.includes('code')) {
      await pool.query('ALTER TABLE purposes ADD COLUMN code VARCHAR(20) NULL');
      console.log('✅ Added code column');
    } else {
      console.log('ℹ️  code column already exists');
    }
    
    // Add requirements column if it doesn't exist
    if (!columnNames.includes('requirements')) {
      await pool.query('ALTER TABLE purposes ADD COLUMN requirements JSON NULL');
      console.log('✅ Added requirements column');
    } else {
      console.log('ℹ️  requirements column already exists');
    }
    
    // Verify the changes
    const [columns] = await pool.query('DESCRIBE purposes');
    console.log('\n✅ Updated PURPOSES table structure:');
    console.table(columns);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

addPurposeColumns();
