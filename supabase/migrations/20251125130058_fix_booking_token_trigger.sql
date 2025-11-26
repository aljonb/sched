-- ============================================
-- FIX BOOKING TOKEN TRIGGER
-- ============================================
-- Remove WHEN clause so trigger always fires on INSERT

-- Drop the existing trigger
DROP TRIGGER IF EXISTS generate_booking_token_on_insert ON public.appointments;

-- Recreate trigger without the WHEN clause
CREATE TRIGGER generate_booking_token_on_insert
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_booking_token();

COMMENT ON TRIGGER generate_booking_token_on_insert ON public.appointments 
  IS 'Automatically generates booking token for all new appointments';







