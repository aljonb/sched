-- ============================================
-- TRIGGER VALIDATION TESTS
-- ============================================
-- Run these queries to test the triggers work correctly

-- Test 1: Verify all triggers exist
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('businesses', 'appointments', 'blocked_slots')
ORDER BY event_object_table, trigger_name;

-- Expected results:
-- generate_booking_token_on_insert (BEFORE INSERT on appointments)
-- prevent_appointment_conflicts_on_change (BEFORE INSERT/UPDATE on appointments)
-- set_businesses_updated_at (BEFORE UPDATE on businesses)
-- set_appointments_updated_at (BEFORE UPDATE on appointments)
-- set_cancelled_at_on_status_change (BEFORE INSERT/UPDATE on appointments)

-- Test 2: Verify all functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'handle_updated_at',
    'generate_booking_token',
    'prevent_appointment_conflicts',
    'set_cancelled_at',
    'check_appointment_conflict'
  )
ORDER BY routine_name;

-- Expected results: All 5 functions should exist

-- ============================================
-- PRACTICAL TESTS (Uncomment to run)
-- ============================================

-- NOTE: You'll need to have a user and business created first
-- Replace YOUR_USER_ID and YOUR_BUSINESS_ID with actual UUIDs

/*
-- Test 3: Create a test business
INSERT INTO public.businesses (
  owner_id,
  business_name,
  timezone,
  slot_duration_minutes
) VALUES (
  'YOUR_USER_ID'::uuid,
  'Test Barbershop',
  'America/New_York',
  30
);

-- Test 4: Create appointment (should auto-generate booking_token)
INSERT INTO public.appointments (
  business_id,
  start_time,
  end_time,
  duration_minutes,
  customer_email,
  customer_name,
  status
) VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  '2025-12-01 10:00:00+00',
  '2025-12-01 10:30:00+00',
  30,
  'test@example.com',
  'Test Customer',
  'pending'
) RETURNING id, booking_token, created_at;

-- Verify booking_token was auto-generated (should be 32-character hex string)

-- Test 5: Try to create overlapping appointment (should FAIL with conflict error)
INSERT INTO public.appointments (
  business_id,
  start_time,
  end_time,
  duration_minutes,
  customer_email,
  customer_name,
  status
) VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  '2025-12-01 10:15:00+00',  -- Overlaps with previous appointment
  '2025-12-01 10:45:00+00',
  30,
  'test2@example.com',
  'Test Customer 2',
  'pending'
);
-- Expected: ERROR with message "Appointment conflict: This time slot overlaps with an existing appointment"

-- Test 6: Create blocked slot
INSERT INTO public.blocked_slots (
  business_id,
  start_time,
  end_time,
  reason,
  created_by
) VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  '2025-12-01 14:00:00+00',
  '2025-12-01 15:00:00+00',
  'Lunch break',
  'YOUR_USER_ID'::uuid
);

-- Test 7: Try to book during blocked time (should FAIL)
INSERT INTO public.appointments (
  business_id,
  start_time,
  end_time,
  duration_minutes,
  customer_email,
  customer_name,
  status
) VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  '2025-12-01 14:30:00+00',  -- During blocked slot
  '2025-12-01 15:00:00+00',
  30,
  'test3@example.com',
  'Test Customer 3',
  'pending'
);
-- Expected: ERROR with message "Appointment conflict: This time slot is blocked"

-- Test 8: Update appointment status to cancelled (should auto-set cancelled_at)
UPDATE public.appointments 
SET status = 'cancelled'
WHERE customer_email = 'test@example.com'
RETURNING id, status, cancelled_at, updated_at;

-- Verify cancelled_at was automatically set

-- Test 9: Verify updated_at changes on update
UPDATE public.businesses
SET business_name = 'Updated Test Barbershop'
WHERE business_name = 'Test Barbershop'
RETURNING business_name, updated_at;

-- Verify updated_at timestamp changed
*/


