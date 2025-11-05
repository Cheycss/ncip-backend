-- Run this in Neon SQL Editor to see ALL table structures
-- This will help us know exactly what columns exist

-- 1. Show all tables in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Show structure of users table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 3. Show structure of pending_registrations table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'pending_registrations'
ORDER BY ordinal_position;

-- 4. Show structure of verification_codes table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'verification_codes'
ORDER BY ordinal_position;

-- 5. Show all constraints and indexes
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
