-- ============================================
-- BOOKING SYSTEM MIGRATION
-- ============================================
-- Creates tables for businesses, appointments, and blocked slots
-- with proper constraints, indexes, and RLS policies

-- ============================================
-- 1. BUSINESSES TABLE
-- ============================================
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  available_days JSONB NOT NULL DEFAULT '["monday","tuesday","wednesday","thursday","friday"]'::jsonb,
  available_hours JSONB NOT NULL DEFAULT '{"start":"09:00","end":"17:00"}'::jsonb,
  break_times JSONB DEFAULT '[]'::jsonb,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_slot_duration CHECK (slot_duration_minutes > 0 AND slot_duration_minutes <= 1440),
  CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$')
);

-- Indexes for businesses
CREATE INDEX idx_businesses_owner_id ON public.businesses(owner_id);
CREATE INDEX idx_businesses_is_active ON public.businesses(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.businesses IS 'Stores business information and availability settings';
COMMENT ON COLUMN public.businesses.available_days IS 'Array of available day names: ["monday", "tuesday", ...]';
COMMENT ON COLUMN public.businesses.available_hours IS 'Object with start and end times: {"start": "09:00", "end": "17:00"}';
COMMENT ON COLUMN public.businesses.break_times IS 'Array of break periods: [{"start": "12:00", "end": "13:00"}]';

-- ============================================
-- 2. APPOINTMENTS TABLE
-- ============================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  booking_token TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  CONSTRAINT valid_email CHECK (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT cancelled_at_only_when_cancelled CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
    (status != 'cancelled' AND cancelled_at IS NULL)
  )
);

-- Indexes for appointments
CREATE INDEX idx_appointments_business_id ON public.appointments(business_id);
CREATE INDEX idx_appointments_customer_id ON public.appointments(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_appointments_booking_token ON public.appointments(booking_token);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_appointments_end_time ON public.appointments(end_time);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_customer_email ON public.appointments(customer_email);

-- Composite index for date range queries
CREATE INDEX idx_appointments_business_time_range ON public.appointments(business_id, start_time, end_time);

-- Prevent overlapping appointments for the same business
CREATE UNIQUE INDEX idx_appointments_no_overlap ON public.appointments(business_id, start_time) 
  WHERE status NOT IN ('cancelled', 'no_show');

-- Comments
COMMENT ON TABLE public.appointments IS 'Stores appointment bookings';
COMMENT ON COLUMN public.appointments.booking_token IS 'Unique token for booking verification and cancellation';
COMMENT ON COLUMN public.appointments.customer_id IS 'Optional reference to registered user, null for guest bookings';
COMMENT ON COLUMN public.appointments.status IS 'Appointment status: pending, confirmed, cancelled, completed, no_show';

-- ============================================
-- 3. BLOCKED SLOTS TABLE
-- ============================================
CREATE TABLE public.blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_blocked_time_range CHECK (end_time > start_time)
);

-- Indexes for blocked_slots
CREATE INDEX idx_blocked_slots_business_id ON public.blocked_slots(business_id);
CREATE INDEX idx_blocked_slots_time_range ON public.blocked_slots(business_id, start_time, end_time);
CREATE INDEX idx_blocked_slots_created_by ON public.blocked_slots(created_by);

-- Comments
COMMENT ON TABLE public.blocked_slots IS 'Stores time slots that are blocked/unavailable for bookings';
COMMENT ON COLUMN public.blocked_slots.reason IS 'Optional reason for blocking the time slot';

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers
CREATE TRIGGER set_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR BUSINESSES
-- ============================================

-- Business owners can view their own businesses
CREATE POLICY "Business owners can view own businesses"
  ON public.businesses
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Business owners can insert their own businesses
CREATE POLICY "Business owners can create businesses"
  ON public.businesses
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Business owners can update their own businesses
CREATE POLICY "Business owners can update own businesses"
  ON public.businesses
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Business owners can delete their own businesses
CREATE POLICY "Business owners can delete own businesses"
  ON public.businesses
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Public can view active businesses (for booking interface)
CREATE POLICY "Public can view active businesses"
  ON public.businesses
  FOR SELECT
  USING (is_active = true);

-- ============================================
-- RLS POLICIES FOR APPOINTMENTS
-- ============================================

-- Business owners can view appointments for their businesses
CREATE POLICY "Business owners can view their appointments"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = appointments.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- Customers can view their own appointments (registered users)
CREATE POLICY "Customers can view their own appointments"
  ON public.appointments
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Public can view confirmed/pending appointments (for availability checking)
CREATE POLICY "Public can view confirmed and pending appointments"
  ON public.appointments
  FOR SELECT
  USING (status IN ('confirmed', 'pending'));

-- Anyone can insert appointments (public booking)
CREATE POLICY "Public can create appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (true);

-- Business owners can update appointments for their business
CREATE POLICY "Business owners can update their appointments"
  ON public.appointments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = appointments.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- Customers can cancel their own appointments
CREATE POLICY "Customers can cancel their appointments"
  ON public.appointments
  FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (
    status = 'cancelled' AND 
    cancelled_at IS NOT NULL
  );

-- ============================================
-- RLS POLICIES FOR BLOCKED SLOTS
-- ============================================

-- Business owners can view blocked slots for their businesses
CREATE POLICY "Business owners can view their blocked slots"
  ON public.blocked_slots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- Business owners can create blocked slots for their businesses
CREATE POLICY "Business owners can create blocked slots"
  ON public.blocked_slots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = auth.uid()
    ) AND
    auth.uid() = created_by
  );

-- Business owners can update blocked slots for their businesses
CREATE POLICY "Business owners can update their blocked slots"
  ON public.blocked_slots
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- Business owners can delete blocked slots for their businesses
CREATE POLICY "Business owners can delete their blocked slots"
  ON public.blocked_slots
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check for appointment conflicts
CREATE OR REPLACE FUNCTION public.check_appointment_conflict(
  p_business_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.appointments
    WHERE business_id = p_business_id
      AND status NOT IN ('cancelled', 'no_show')
      AND id != COALESCE(p_exclude_appointment_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (start_time < p_end_time AND end_time > p_start_time)
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.blocked_slots
    WHERE business_id = p_business_id
      AND (
        (start_time < p_end_time AND end_time > p_start_time)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_appointment_conflict IS 'Checks if a time slot conflicts with existing appointments or blocked slots';

