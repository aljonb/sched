-- ============================================
-- ADD PUBLIC APPOINTMENTS VIEW POLICY
-- ============================================
-- Allows anyone to view confirmed/pending appointments
-- This is essential for availability checking in the booking interface

-- Public can view confirmed/pending appointments (for availability checking)
CREATE POLICY "Public can view confirmed and pending appointments"
  ON public.appointments
  FOR SELECT
  USING (status IN ('confirmed', 'pending'));

COMMENT ON POLICY "Public can view confirmed and pending appointments" ON public.appointments 
  IS 'Allows anonymous users to see booked slots for availability checking';







