# MySQL to PostgreSQL Migration - Remaining Files

## ✅ FIXED FILES:
- ✅ `registrationAuth.js` - Email verification for registration
- ✅ `pendingRegistrations.js` - User registration approval
- ✅ `auth.js` - Login with password_hash fix
- ✅ `profile.js` - User profile management

## ⚠️ FILES STILL USING MySQL SYNTAX:

### HIGH PRIORITY (Blocking user/admin functions):
1. **`emailAuth.js`** - Email-based login verification
   - Uses `pool.execute` throughout
   - Uses `?` placeholders
   - Uses `[result]` destructuring
   - Uses `result.insertId`

2. **`adminUserCreation.js`** - Admin creating new users
   - Uses `pool.execute`
   - Uses `?` placeholders
   - Critical for admin functionality

### MEDIUM PRIORITY:
3. **`adminProfile.js`** - Admin profile management
4. **`adminReview.js`** - Admin reviewing applications
5. **`applications.js`** - Application management
6. **`documents.js`** - Document handling
7. **`genealogy.js`** - Genealogy records
8. **`notifications.js`** - Notification system
9. **`registrations.js`** - Registration management
10. **`uploads.js`** - File uploads
11. **`users.js`** - User management

## CONVERSION CHECKLIST:

For each file, replace:
- [ ] `pool.execute` → `pool.query`
- [ ] `?` placeholders → `$1, $2, $3...`
- [ ] `const [result] = await` → `const result = await`
- [ ] `result.length` → `result.rows.length`
- [ ] `result[0]` → `result.rows[0]`
- [ ] `result.insertId` → Add `RETURNING id` clause, use `result.rows[0].id`
- [ ] `result.affectedRows` → `result.rowCount`
- [ ] `AUTO_INCREMENT` → `SERIAL`
- [ ] `LONGTEXT` → `TEXT`
- [ ] `TINYINT(1)` → `BOOLEAN`
- [ ] `ENUM('a','b')` → `VARCHAR with CHECK constraint`
- [ ] `ON UPDATE CURRENT_TIMESTAMP` → Use trigger function

## PRIORITY ORDER:
1. Fix `emailAuth.js` first (login issues)
2. Fix `adminUserCreation.js` (admin can't create users)
3. Fix remaining files as needed

## TESTING AFTER EACH FIX:
1. Commit and push to GitHub
2. Wait for Render to deploy (2-3 min)
3. Test the specific functionality
4. Check Render logs for errors
