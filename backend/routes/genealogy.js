import express from 'express';
import pool from '../database.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// =====================================================
// GENEALOGY API ROUTES
// =====================================================

// @route   GET /api/genealogy/search
// @desc    Search genealogy records by surname or name
// @access  Private
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { term } = req.query;

    if (!term || term.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters'
      });
    }

    const searchTerm = `%${term}%`;

    // Search in the complete genealogy view
    const [records] = await db.query(`
      SELECT 
        genealogy_id,
        full_name,
        first_name,
        last_name,
        ethnicity,
        birth_place,
        generation_level,
        gender,
        father_name,
        mother_name,
        paternal_grandfather_name,
        paternal_grandmother_name,
        maternal_grandfather_name,
        maternal_grandmother_name,
        barangay_name,
        city_name,
        province_name,
        is_verified
      FROM v_genealogy_complete
      WHERE 
        full_name LIKE ? OR
        last_name LIKE ? OR
        father_name LIKE ? OR
        mother_name LIKE ? OR
        paternal_grandfather_name LIKE ? OR
        paternal_grandmother_name LIKE ? OR
        maternal_grandfather_name LIKE ? OR
        maternal_grandmother_name LIKE ?
      ORDER BY generation_level DESC, last_name
      LIMIT 50
    `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

    res.json({
      success: true,
      count: records.length,
      records: records
    });

  } catch (error) {
    console.error('Error searching genealogy:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching genealogy records',
      error: error.message
    });
  }
});

// @route   GET /api/genealogy/:id
// @desc    Get complete family tree for a person
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the person's complete record
    const [person] = await db.query(`
      SELECT * FROM v_genealogy_complete
      WHERE genealogy_id = ?
    `, [id]);

    if (person.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Genealogy record not found'
      });
    }

    // Get all relationships
    const [relationships] = await db.query(`
      SELECT 
        gr.relationship_id,
        gr.relationship_type,
        related.genealogy_id,
        related.full_name,
        related.first_name,
        related.last_name,
        related.generation_level,
        related.gender,
        related.ethnicity,
        related.birth_place
      FROM genealogy_relationships gr
      JOIN genealogy_records related ON gr.related_person_id = related.genealogy_id
      WHERE gr.person_id = ?
      ORDER BY 
        CASE gr.relationship_type
          WHEN 'father' THEN 1
          WHEN 'mother' THEN 2
          WHEN 'paternal_grandfather' THEN 3
          WHEN 'paternal_grandmother' THEN 4
          WHEN 'maternal_grandfather' THEN 5
          WHEN 'maternal_grandmother' THEN 6
          ELSE 7
        END
    `, [id]);

    res.json({
      success: true,
      person: person[0],
      relationships: relationships
    });

  } catch (error) {
    console.error('Error fetching genealogy:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching genealogy record',
      error: error.message
    });
  }
});

// @route   POST /api/genealogy/create
// @desc    Create a new genealogy record
// @access  Private
router.post('/create', authMiddleware, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      full_name,
      first_name,
      middle_name,
      last_name,
      suffix,
      birth_date,
      birth_place,
      ethnicity,
      tribe_affiliation,
      barangay_id,
      city_id,
      province_id,
      current_address,
      generation_level,
      gender,
      is_living,
      notes,
      // Parent relationships
      father_id,
      mother_id,
      // Grandparent relationships
      paternal_grandfather_id,
      paternal_grandmother_id,
      maternal_grandfather_id,
      maternal_grandmother_id
    } = req.body;

    // Validate required fields
    if (!full_name || !generation_level) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Full name and generation level are required'
      });
    }

    // Insert the genealogy record
    const [result] = await connection.query(`
      INSERT INTO genealogy_records (
        full_name, first_name, middle_name, last_name, suffix,
        birth_date, birth_place, ethnicity, tribe_affiliation,
        barangay_id, city_id, province_id, current_address,
        generation_level, gender, is_living, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      full_name, first_name, middle_name, last_name, suffix,
      birth_date, birth_place, ethnicity, tribe_affiliation,
      barangay_id, city_id, province_id, current_address,
      generation_level, gender, is_living !== false, notes, req.user.userId
    ]);

    const genealogyId = result.insertId;

    // Insert relationships
    const relationships = [];
    
    if (father_id) {
      relationships.push([genealogyId, father_id, 'father', req.user.userId]);
    }
    if (mother_id) {
      relationships.push([genealogyId, mother_id, 'mother', req.user.userId]);
    }
    if (paternal_grandfather_id) {
      relationships.push([genealogyId, paternal_grandfather_id, 'paternal_grandfather', req.user.userId]);
    }
    if (paternal_grandmother_id) {
      relationships.push([genealogyId, paternal_grandmother_id, 'paternal_grandmother', req.user.userId]);
    }
    if (maternal_grandfather_id) {
      relationships.push([genealogyId, maternal_grandfather_id, 'maternal_grandfather', req.user.userId]);
    }
    if (maternal_grandmother_id) {
      relationships.push([genealogyId, maternal_grandmother_id, 'maternal_grandmother', req.user.userId]);
    }

    if (relationships.length > 0) {
      await connection.query(`
        INSERT INTO genealogy_relationships (person_id, related_person_id, relationship_type, created_by)
        VALUES ?
      `, [relationships]);
    }

    await connection.commit();

    // Fetch the complete record
    const [newRecord] = await connection.query(`
      SELECT * FROM v_genealogy_complete WHERE genealogy_id = ?
    `, [genealogyId]);

    res.status(201).json({
      success: true,
      message: 'Genealogy record created successfully',
      genealogy_id: genealogyId,
      record: newRecord[0]
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating genealogy:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating genealogy record',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// @route   POST /api/genealogy/:id/add-member
// @desc    Add yourself to an existing family tree
// @access  Private
router.post('/:id/add-member', authMiddleware, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params; // Parent/reference person ID
    const {
      full_name,
      first_name,
      middle_name,
      last_name,
      suffix,
      birth_date,
      birth_place,
      ethnicity,
      tribe_affiliation,
      barangay_id,
      city_id,
      province_id,
      current_address,
      gender,
      relationship_to_reference, // 'child', 'grandchild', etc.
      // If adding as child, optionally specify other parent
      other_parent_id,
      // If adding parents
      father_info,
      mother_info
    } = req.body;

    // Verify reference person exists
    const [refPerson] = await connection.query(`
      SELECT generation_level FROM genealogy_records WHERE genealogy_id = ?
    `, [id]);

    if (refPerson.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Reference person not found'
      });
    }

    // Calculate generation level based on relationship
    let generation_level = refPerson[0].generation_level;
    if (relationship_to_reference === 'child') {
      generation_level += 1;
    } else if (relationship_to_reference === 'parent') {
      generation_level -= 1;
    }

    // Create the new person
    const [result] = await connection.query(`
      INSERT INTO genealogy_records (
        full_name, first_name, middle_name, last_name, suffix,
        birth_date, birth_place, ethnicity, tribe_affiliation,
        barangay_id, city_id, province_id, current_address,
        generation_level, gender, is_living, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      full_name, first_name, middle_name, last_name, suffix,
      birth_date, birth_place, ethnicity, tribe_affiliation,
      barangay_id, city_id, province_id, current_address,
      generation_level, gender, true, req.user.userId
    ]);

    const newPersonId = result.insertId;

    // Create relationship based on type
    if (relationship_to_reference === 'child') {
      // Reference person is parent
      const parentGender = await connection.query(`
        SELECT gender FROM genealogy_records WHERE genealogy_id = ?
      `, [id]);
      
      const relationshipType = parentGender[0][0].gender === 'Male' ? 'father' : 'mother';
      
      await connection.query(`
        INSERT INTO genealogy_relationships (person_id, related_person_id, relationship_type, created_by)
        VALUES (?, ?, ?, ?)
      `, [newPersonId, id, relationshipType, req.user.userId]);

      // Add other parent if provided
      if (other_parent_id) {
        const otherParentGender = await connection.query(`
          SELECT gender FROM genealogy_records WHERE genealogy_id = ?
        `, [other_parent_id]);
        
        const otherRelType = otherParentGender[0][0].gender === 'Male' ? 'father' : 'mother';
        
        await connection.query(`
          INSERT INTO genealogy_relationships (person_id, related_person_id, relationship_type, created_by)
          VALUES (?, ?, ?, ?)
        `, [newPersonId, other_parent_id, otherRelType, req.user.userId]);
      }
    }

    await connection.commit();

    // Fetch the complete record
    const [newRecord] = await connection.query(`
      SELECT * FROM v_genealogy_complete WHERE genealogy_id = ?
    `, [newPersonId]);

    res.status(201).json({
      success: true,
      message: 'Successfully added to family tree',
      genealogy_id: newPersonId,
      record: newRecord[0]
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error adding family member:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding family member',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// @route   GET /api/genealogy/stats
// @desc    Get genealogy statistics
// @access  Private
router.get('/admin/stats', authMiddleware, async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT ethnicity) as total_ethnicities,
        COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified_records,
        COUNT(CASE WHEN generation_level = 3 THEN 1 END) as generation_3,
        COUNT(CASE WHEN generation_level = 4 THEN 1 END) as generation_4,
        COUNT(CASE WHEN generation_level = 5 THEN 1 END) as generation_5,
        COUNT(CASE WHEN generation_level >= 6 THEN 1 END) as generation_6_plus
      FROM genealogy_records
    `);

    const [ethnicityBreakdown] = await db.query(`
      SELECT ethnicity, COUNT(*) as count
      FROM genealogy_records
      WHERE ethnicity IS NOT NULL
      GROUP BY ethnicity
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      stats: stats[0],
      ethnicity_breakdown: ethnicityBreakdown
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching genealogy statistics',
      error: error.message
    });
  }
});

export default router;
