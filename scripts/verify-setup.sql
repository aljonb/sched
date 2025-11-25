-- ============================================
-- VERIFICATION SCRIPT FOR CLERK + SUPABASE SETUP
-- ============================================
-- Run this in Supabase SQL Editor to verify setup

-- 1. Check if RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('businesses', 'appointments', 'blocked_slots');

-- Expected: All should have rowsecurity = true

-- 2. Check RLS policies exist
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('businesses', 'appointments', 'blocked_slots')
ORDER BY tablename, policyname;

-- Expected: Should see multiple policies for each table using auth.jwt()->>'sub'

-- 3. Verify businesses table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
ORDER BY ordinal_position;

-- Expected: Should include owner_id, business_name, available_days (jsonb), etc.

-- 4. Test JWT access (run when authenticated)
-- This will show you the current JWT claims
SELECT auth.jwt();

-- Expected: Should show JWT with 'sub' claim containing Clerk user ID

-- 5. Check if any businesses exist
SELECT 
  id,
  owner_id,
  business_name,
  is_active,
  created_at
FROM businesses
ORDER BY created_at DESC
LIMIT 5;

-- 6. Verify indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'businesses';

-- Expected: Should see indexes on owner_id and is_active

-- ============================================
-- SECURITY TESTS
-- ============================================

-- Test 1: Try to view all businesses (should be filtered by RLS)
SELECT COUNT(*) as my_businesses FROM businesses;
-- Expected: Should only count businesses owned by current user

-- Test 2: Check active businesses (public view)
SELECT COUNT(*) as active_businesses FROM businesses WHERE is_active = true;
-- Expected: Should show count of all active businesses

-- Test 3: Verify helper function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'check_appointment_conflict';
-- Expected: Should return the function

-- ============================================
-- CLERK INTEGRATION VERIFICATION
-- ============================================

-- This query checks if the RLS policies use Clerk JWT claims
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%auth.jwt()%' THEN '✓ Uses Clerk JWT'
    WHEN qual LIKE '%auth.uid()%' THEN '✗ Uses old Supabase auth'
    ELSE '? Unknown auth method'
  END as auth_method
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'appointments', 'blocked_slots')
ORDER BY tablename, policyname;

-- Expected: All should show "✓ Uses Clerk JWT"

-- ============================================
-- SAMPLE DATA FOR TESTING (optional)
-- ============================================

-- Uncomment to insert test data (replace with your actual Clerk user ID)
/*
INSERT INTO businesses (
  owner_id,
  business_name,
  timezone,
  available_days,
  available_hours,
  slot_duration_minutes
) VALUES (
  'YOUR_CLERK_USER_ID_HERE',
  'Test Business',
  'America/New_York',
  '["monday", "tuesday", "wednesday", "thursday", "friday"]'::jsonb,
  '{"start": "09:00", "end": "17:00"}'::jsonb,
  60
);
*/

-- ============================================
-- CLEANUP (use with caution)
-- ============================================

-- Uncomment to delete all businesses (for testing only!)
-- DELETE FROM businesses WHERE is_active = false;

-- Uncomment to reset and start fresh (DANGER: deletes all data!)
-- TRUNCATE businesses, appointments, blocked_slots CASCADE;

