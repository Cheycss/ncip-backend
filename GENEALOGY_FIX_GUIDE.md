# Genealogy.js PostgreSQL Conversion Guide

## Issues Found:
1. ✅ `db.query` → `pool.query` (FIXED)
2. ✅ `db.getConnection()` → `pool.connect()` (FIXED)
3. ⚠️ `connection.beginTransaction()` → `connection.query('BEGIN')`
4. ⚠️ `connection.commit()` → `connection.query('COMMIT')`
5. ⚠️ `connection.rollback()` → `connection.query('ROLLBACK')`
6. ⚠️ Array destructuring `const [result] =` → `const result =`
7. ⚠️ `result.insertId` → Add `RETURNING genealogy_id`
8. ⚠️ `?` placeholders → `$1, $2, $3...`
9. ⚠️ `VALUES ?` (bulk insert) → Individual INSERT statements or unnest()

## Manual Fixes Needed:

### Lines 86-96: Get person by ID
```javascript
// BEFORE:
const [person] = await pool.query(`
  SELECT * FROM v_genealogy_complete
  WHERE genealogy_id = ?
`, [id]);

if (person.length === 0) {

// AFTER:
const person = await pool.query(`
  SELECT * FROM v_genealogy_complete
  WHERE genealogy_id = $1
`, [id]);

if (person.rows.length === 0) {
```

### Lines 99-129: Get relationships
```javascript
// BEFORE:
const [relationships] = await pool.query(`
  ...
  WHERE gr.person_id = ?
`, [id]);

res.json({
  person: person[0],
  relationships: relationships
});

// AFTER:
const relationships = await pool.query(`
  ...
  WHERE gr.person_id = $1
`, [id]);

res.json({
  person: person.rows[0],
  relationships: relationships.rows
});
```

### Lines 146-258: Create genealogy (COMPLEX - Transactions)
```javascript
// BEFORE:
const connection = await pool.connect();
await connection.beginTransaction();
const [result] = await connection.query(`INSERT ... VALUES (?, ?, ...)`, [...]);
const genealogyId = result.insertId;
await connection.query(`INSERT ... VALUES ?`, [relationships]);
await connection.commit();

// AFTER:
const client = await pool.connect();
await client.query('BEGIN');
const result = await client.query(`INSERT ... VALUES ($1, $2, ...) RETURNING genealogy_id`, [...]);
const genealogyId = result.rows[0].genealogy_id;
// Bulk insert needs loop or unnest
for (const rel of relationships) {
  await client.query(`INSERT ... VALUES ($1, $2, $3, $4)`, rel);
}
await client.query('COMMIT');
```

### Lines 264-386: Add member (COMPLEX - Transactions)
Similar pattern as above

### Lines 393-416: Stats queries
```javascript
// BEFORE:
const [stats] = await pool.query(`...`);
const [ethnicityBreakdown] = await pool.query(`...`);

res.json({
  stats: stats[0],
  ethnicity_breakdown: ethnicityBreakdown
});

// AFTER:
const stats = await pool.query(`...`);
const ethnicityBreakdown = await pool.query(`...`);

res.json({
  stats: stats.rows[0],
  ethnicity_breakdown: ethnicityBreakdown.rows
});
```

## Recommendation:
This file is VERY complex with 50+ queries and bulk inserts.
Since genealogy is an OPTIONAL feature, consider:
1. Fix it later when needed
2. Test core features first (admin approval, user registration)
3. Come back to this when genealogy is actively used
