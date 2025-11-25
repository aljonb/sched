-- ============================================
-- ADD VALIDATION TRIGGERS
-- ============================================
-- Adds automatic triggers for booking token generation
-- and appointment conflict prevention

-- ============================================
-- 1. BOOKING TOKEN GENERATION
-- ============================================

-- Function to generate unique booking tokens
CREATE OR REPLACE FUNCTION public.generate_booking_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate a 32-character hex token from two UUIDs
  NEW.booking_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-generate booking token on insert
CREATE TRIGGER generate_booking_token_on_insert
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_booking_token();

COMMENT ON FUNCTION public.generate_booking_token IS 'Automatically generates a unique 32-character hex booking token';

-- ============================================
-- 2. APPOINTMENT CONFLICT PREVENTION
-- ============================================

-- Function to prevent overlapping appointments
CREATE OR REPLACE FUNCTION public.prevent_appointment_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  v_conflict_count INTEGER;
  v_conflict_type TEXT;
BEGIN
  -- Skip validation for cancelled or no-show appointments
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Check for conflicts with existing appointments
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments
  WHERE business_id = NEW.business_id
    AND status NOT IN ('cancelled', 'no_show')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      (start_time < NEW.end_time AND end_time > NEW.start_time)
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Appointment conflict: This time slot overlaps with an existing appointment'
      USING ERRCODE = 'P0001',
            HINT = 'Choose a different time slot';
  END IF;

  -- Check for conflicts with blocked slots
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.blocked_slots
  WHERE business_id = NEW.business_id
    AND (
      (start_time < NEW.end_time AND end_time > NEW.start_time)
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Appointment conflict: This time slot is blocked'
      USING ERRCODE = 'P0002',
            HINT = 'Choose a different time slot';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent conflicts on insert or update
CREATE TRIGGER prevent_appointment_conflicts_on_change
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_appointment_conflicts();

COMMENT ON FUNCTION public.prevent_appointment_conflicts IS 'Automatically prevents overlapping appointments and validates against blocked slots';

-- ============================================
-- 3. AUTOMATIC CANCELLATION TIMESTAMP
-- ============================================

-- Function to automatically set cancelled_at when status changes to cancelled
CREATE OR REPLACE FUNCTION public.set_cancelled_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is being changed to cancelled and cancelled_at is not set
  IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at := now();
  END IF;
  
  -- If status is being changed from cancelled to something else, clear cancelled_at
  IF NEW.status != 'cancelled' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-set cancelled_at
CREATE TRIGGER set_cancelled_at_on_status_change
  BEFORE INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cancelled_at();

COMMENT ON FUNCTION public.set_cancelled_at IS 'Automatically sets cancelled_at timestamp when appointment is cancelled';

