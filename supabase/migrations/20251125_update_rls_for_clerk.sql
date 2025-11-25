-- ============================================
-- UPDATE RLS POLICIES FOR CLERK INTEGRATION
-- ============================================
-- This migration updates RLS policies to use Clerk JWT claims
-- instead of Supabase's auth.uid()
-- 
-- Clerk stores the user ID in the 'sub' claim of the JWT
-- Access it using: auth.jwt()->>'sub'

-- ============================================
-- DROP OLD RLS POLICIES
-- ============================================

-- Drop old businesses policies
DROP POLICY IF EXISTS "Business owners can view own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can delete own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Public can view active businesses" ON public.businesses;

-- Drop old appointments policies
DROP POLICY IF EXISTS "Business owners can view their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customers can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can view confirmed and pending appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business owners can update their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Customers can cancel their appointments" ON public.appointments;

-- Drop old blocked_slots policies
DROP POLICY IF EXISTS "Business owners can view their blocked slots" ON public.blocked_slots;
DROP POLICY IF EXISTS "Business owners can create blocked slots" ON public.blocked_slots;
DROP POLICY IF EXISTS "Business owners can update their blocked slots" ON public.blocked_slots;
DROP POLICY IF EXISTS "Business owners can delete their blocked slots" ON public.blocked_slots;

-- ============================================
-- CREATE NEW RLS POLICIES FOR BUSINESSES
-- ============================================

-- Business owners can view their own businesses
CREATE POLICY "Business owners can view own businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'sub')::uuid = owner_id);

-- Business owners can insert their own businesses
CREATE POLICY "Business owners can create businesses"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'sub')::uuid = owner_id);

-- Business owners can update their own businesses
CREATE POLICY "Business owners can update own businesses"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'sub')::uuid = owner_id)
  WITH CHECK ((auth.jwt()->>'sub')::uuid = owner_id);

-- Business owners can delete their own businesses
CREATE POLICY "Business owners can delete own businesses"
  ON public.businesses
  FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'sub')::uuid = owner_id);

-- Public can view active businesses (for booking interface)
CREATE POLICY "Public can view active businesses"
  ON public.businesses
  FOR SELECT
  USING (is_active = true);

-- ============================================
-- CREATE NEW RLS POLICIES FOR APPOINTMENTS
-- ============================================

-- Business owners can view appointments for their businesses
CREATE POLICY "Business owners can view their appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = appointments.business_id 
      AND businesses.owner_id = (auth.jwt()->>'sub')::uuid
    )
  );

-- Customers can view their own appointments (registered users)
CREATE POLICY "Customers can view their own appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'sub')::uuid = customer_id);

-- Public can view confirmed/pending appointments (for availability checking)
-- This allows unauthenticated users to see what time slots are taken
CREATE POLICY "Public can view confirmed and pending appointments"
  ON public.appointments
  FOR SELECT
  USING (status IN ('confirmed', 'pending'));

-- Anyone can insert appointments (public booking)
-- Note: This allows unauthenticated bookings
CREATE POLICY "Public can create appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (true);

-- Business owners can update appointments for their business
CREATE POLICY "Business owners can update their appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = appointments.business_id 
      AND businesses.owner_id = (auth.jwt()->>'sub')::uuid
    )
  );

-- Customers can cancel their own appointments
CREATE POLICY "Customers can cancel their appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'sub')::uuid = customer_id)
  WITH CHECK (
    status = 'cancelled' AND 
    cancelled_at IS NOT NULL
  );

-- ============================================
-- CREATE NEW RLS POLICIES FOR BLOCKED SLOTS
-- ============================================

-- Business owners can view blocked slots for their businesses
CREATE POLICY "Business owners can view their blocked slots"
  ON public.blocked_slots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = (auth.jwt()->>'sub')::uuid
    )
  );

-- Business owners can create blocked slots for their businesses
CREATE POLICY "Business owners can create blocked slots"
  ON public.blocked_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = (auth.jwt()->>'sub')::uuid
    ) AND
    (auth.jwt()->>'sub')::uuid = created_by
  );

-- Business owners can update blocked slots for their businesses
CREATE POLICY "Business owners can update their blocked slots"
  ON public.blocked_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = (auth.jwt()->>'sub')::uuid
    )
  );

-- Business owners can delete blocked slots for their businesses
CREATE POLICY "Business owners can delete their blocked slots"
  ON public.blocked_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = blocked_slots.business_id 
      AND businesses.owner_id = (auth.jwt()->>'sub')::uuid
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "Business owners can view own businesses" ON public.businesses 
  IS 'Uses Clerk JWT sub claim to identify authenticated user';

COMMENT ON POLICY "Business owners can view their appointments" ON public.appointments 
  IS 'Uses Clerk JWT sub claim to identify business owner';

COMMENT ON POLICY "Customers can view their own appointments" ON public.appointments 
  IS 'Uses Clerk JWT sub claim to identify customer';

