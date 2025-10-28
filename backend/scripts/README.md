# Database Access Scripts

Scripts to access and view all data in the NCIP database.

## 📋 Available Scripts

### 1. **viewAllData.js** - Simple Viewer
Quick and simple script to view all database tables and their data.

**Usage:**
```bash
cd backend/scripts
node viewAllData.js
```

**Output:**
- Shows all tables
- Displays all data in console tables
- Easy to read format

---

### 2. **getAllData.js** - Advanced Exporter
Comprehensive script with export functionality and detailed analysis.

**Usage:**

**View all data:**
```bash
node getAllData.js
# or
node getAllData.js all
```

**View specific table:**
```bash
node getAllData.js table users
node getAllData.js table applications
node getAllData.js table notifications
```

**View database statistics:**
```bash
node getAllData.js stats
```

**Features:**
- ✅ Exports data to JSON files
- ✅ Shows table structures
- ✅ Displays column information
- ✅ Provides database statistics
- ✅ Color-coded console output
- ✅ Creates timestamped exports

**Export Location:**
```
backend/exports/
├── database_export_YYYY-MM-DD.json
└── database_summary_YYYY-MM-DD.json
```

---

## 🗄️ Database Tables

The scripts will access these tables:

1. **users** - User accounts (admin, user)
2. **user_registrations** - Pending user registrations
3. **applications** - Certificate applications
4. **notifications** - User notifications
5. **services** - Available services
6. **purposes** - Application purposes
7. **user_profiles** - User profile information

---

## 📊 Output Examples

### Simple Viewer Output:
```
✅ Connected to database!
================================================================================
DATABASE: ncip_system
================================================================================

📋 Found 7 tables: users, applications, notifications...

────────────────────────────────────────────────────────────────────────────────
📊 TABLE: USERS
────────────────────────────────────────────────────────────────────────────────
Total rows: 5

Data:
┌─────────┬─────────┬────────────┬──────────────┬───────────────────────┬──────┐
│ (index) │ user_id │  username  │  first_name  │        email          │ role │
├─────────┼─────────┼────────────┼──────────────┼───────────────────────┼──────┤
│    0    │    1    │  'admin'   │   'System'   │ 'admin@ncip.gov.ph'   │'admin'│
│    1    │    2    │  'john'    │   'John'     │ 'john@example.com'    │'user' │
└─────────┴─────────┴────────────┴──────────────┴───────────────────────┴──────┘
```

### Advanced Exporter Output:
```
============================================================
DATABASE: ncip_system
============================================================

📋 Total Tables Found: 7
Tables: users, applications, notifications, services...

📊 USERS
------------------------------------------------------------
Columns: user_id, username, first_name, last_name, email, role...
Total Rows: 5

Sample Data (First 3 rows):
┌─────────┬─────────┬────────────┬──────────────┬───────────────────────┐
│ (index) │ user_id │  username  │  first_name  │        email          │
├─────────┼─────────┼────────────┼──────────────┼───────────────────────┤
│    0    │    1    │  'admin'   │   'System'   │ 'admin@ncip.gov.ph'   │
└─────────┴─────────┴────────────┴──────────────┴───────────────────────┘

============================================================
DATABASE SUMMARY
============================================================
users: 5 rows, 12 columns
applications: 10 rows, 15 columns
notifications: 3 rows, 8 columns

============================================================
EXPORT COMPLETE
============================================================
✅ Data exported to: backend/exports/database_export_2025-10-15.json
📦 File size: 45.32 KB
✅ Summary exported to: backend/exports/database_summary_2025-10-15.json
```

---

## 🔧 Configuration

Scripts use `.env` file for database connection:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ncip_system
```

---

## 📝 Notes

- Scripts are read-only (no data modification)
- Safe to run anytime
- Exports are timestamped
- Color-coded for easy reading
- Works with existing database structure

---

## 🚀 Quick Start

**Option 1: Simple View**
```bash
cd backend/scripts
node viewAllData.js
```

**Option 2: Full Export**
```bash
cd backend/scripts
node getAllData.js
```

**Option 3: Specific Table**
```bash
cd backend/scripts
node getAllData.js table users
```

---

## 💡 Use Cases

1. **Database Inspection** - View all data quickly
2. **Data Export** - Backup data to JSON
3. **Debugging** - Check table contents
4. **Documentation** - Generate data snapshots
5. **Analysis** - Review database statistics

---

## ⚠️ Important

- Ensure database is running
- Check `.env` configuration
- Scripts are read-only
- Large databases may take time
- Exports saved to `backend/exports/`

---

## 📦 Dependencies

- `mysql2` - MySQL driver
- `dotenv` - Environment variables
- `fs` - File system (built-in)
- `path` - Path utilities (built-in)

Already installed in your project! ✅
