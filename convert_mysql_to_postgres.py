#!/usr/bin/env python3
"""
Automatically convert MySQL syntax to PostgreSQL in JavaScript route files
"""
import re
import os
import sys

def convert_mysql_to_postgres(content):
    """Convert MySQL syntax to PostgreSQL in JavaScript code"""
    
    # Track if any changes were made
    changes_made = False
    
    # 1. Replace pool.execute with pool.query
    if 'pool.execute' in content:
        content = content.replace('pool.execute', 'pool.query')
        changes_made = True
    
    # 2. Replace array destructuring: const [result] = await pool.query
    pattern1 = r'const\s+\[(\w+)\]\s*=\s*await\s+pool\.query'
    if re.search(pattern1, content):
        content = re.sub(pattern1, r'const \1 = await pool.query', content)
        changes_made = True
    
    # 3. Replace result.length with result.rows.length
    pattern2 = r'(\w+)\.length\s*([><=!]+)\s*0'
    matches = re.findall(pattern2, content)
    for match in matches:
        var_name = match[0]
        # Check if this looks like a query result (not a string or array)
        if var_name in ['users', 'result', 'results', 'rows', 'records', 'data', 'items', 
                        'existingUsers', 'pendingUsers', 'verificationRecords', 'existingProfile',
                        'pendingRegistrations', 'applications', 'documents']:
            old = f'{var_name}.length'
            new = f'{var_name}.rows.length'
            content = content.replace(old, new)
            changes_made = True
    
    # 4. Replace result[0] with result.rows[0]
    pattern3 = r'(\w+)\[0\]'
    matches = re.findall(pattern3, content)
    for var_name in matches:
        if var_name in ['users', 'result', 'results', 'rows', 'records', 'data', 'items',
                        'existingUsers', 'pendingUsers', 'verificationRecords', 'existingProfile',
                        'pendingRegistrations', 'applications', 'documents']:
            old = f'{var_name}[0]'
            new = f'{var_name}.rows[0]'
            content = content.replace(old, new)
            changes_made = True
    
    # 5. Replace result.insertId with RETURNING clause
    if 'result.insertId' in content or 'userResult.insertId' in content:
        print("  ⚠️  WARNING: Found .insertId - needs manual RETURNING clause fix")
        changes_made = True
    
    # 6. Replace ? placeholders with $1, $2, etc.
    # This is complex and needs manual review
    if re.search(r"'[^']*\?[^']*'", content):
        print("  ⚠️  WARNING: Found ? placeholders - needs manual $1, $2 conversion")
        changes_made = True
    
    return content, changes_made

def process_file(filepath):
    """Process a single JavaScript file"""
    print(f"\nProcessing: {filepath}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file needs conversion
        if 'pool.execute' not in content and '.insertId' not in content:
            print("  ✓ Already converted or no MySQL syntax found")
            return False
        
        # Convert
        new_content, changes_made = convert_mysql_to_postgres(content)
        
        if changes_made:
            # Backup original
            backup_path = filepath + '.backup'
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Write converted content
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print(f"  ✓ Converted (backup: {backup_path})")
            return True
        else:
            print("  - No changes needed")
            return False
            
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    """Main function"""
    routes_dir = os.path.join(os.path.dirname(__file__), 'backend', 'routes')
    
    if not os.path.exists(routes_dir):
        print(f"Error: Routes directory not found: {routes_dir}")
        return
    
    print("=" * 60)
    print("MySQL to PostgreSQL Converter")
    print("=" * 60)
    
    files_to_process = [
        'emailAuth.js',
        'adminUserCreation.js',
        'adminProfile.js',
        'adminReview.js',
        'applications.js',
        'documents.js',
        'genealogy.js',
        'notifications.js',
        'registrations.js',
        'uploads.js',
        'users.js'
    ]
    
    converted_count = 0
    for filename in files_to_process:
        filepath = os.path.join(routes_dir, filename)
        if os.path.exists(filepath):
            if process_file(filepath):
                converted_count += 1
        else:
            print(f"\n⚠️  File not found: {filename}")
    
    print("\n" + "=" * 60)
    print(f"Conversion complete! {converted_count} files modified")
    print("=" * 60)
    print("\n⚠️  IMPORTANT: Review all changes manually!")
    print("   - Check ? placeholder conversions")
    print("   - Add RETURNING clauses for INSERT statements")
    print("   - Test thoroughly before deploying")

if __name__ == '__main__':
    main()
