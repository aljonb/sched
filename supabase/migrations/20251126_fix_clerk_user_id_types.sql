-- ============================================
-- FIX CLERK USER ID TYPES
-- ============================================
-- This migration fixes the owner_id and customer_id columns to use TEXT
-- instead of UUID, since Clerk user IDs are strings like "user_XXX..."
-- not UUIDs

-- ============================================
-- 1. DROP ALL RLS POLICIES FIRST
-- ============================================
-- Must drop policies before altering column types they depend on

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
-- 2. DROP FOREIGN KEY CONSTRAINTS
-- ============================================

-- Drop foreign key constraints from businesses table
ALTER TABLE public.businesses 
  DROP CONSTRAINT IF EXISTS businesses_owner_id_fkey;

-- Drop foreign key constraints from appointments table
ALTER TABLE public.appointments 
  DROP CONSTRAINT IF EXISTS appointments_customer_id_fkey;

-- Drop foreign key constraints from blocked_slots table
ALTER TABLE public.blocked_slots 
  DROP CONSTRAINT IF EXISTS blocked_slots_created_by_fkey;

-- ============================================
-- 3. CHANGE COLUMN TYPES FROM UUID TO TEXT
-- ============================================

-- Change businesses.owner_id to TEXT
ALTER TABLE public.businesses 
  ALTER COLUMN owner_id TYPE TEXT USING owner_id::text;

-- Change appointments.customer_id to TEXT
ALTER TABLE public.appointments 
  ALTER COLUMN customer_id TYPE TEXT USING customer_id::text;

-- Change blocked_slots.created_by to TEXT
ALTER TABLE public.blocked_slots 
  ALTER COLUMN created_by TYPE TEXT USING created_by::text;

-- ============================================
-- 4. CREATE NEW RLS POLICIES (without UUID casting)
-- ============================================

-- ============================================
-- BUSINESSES POLICIES
-- ============================================

-- Business owners can view their own businesses
CREATE POLICY "Business owners can view own businesses"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (auth.jwt()->>'sub' = owner_id);

-- Business owners can insert their own businesses
CREATE POLICY "Business owners can create businesses"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt()->>'sub' = owner_id);

-- Business owners can update their own businesses
CREATE POLICY "Business owners can update own businesses"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'sub' = owner_id)
  WITH CHECK (auth.jwt()->>'sub' = owner_id);

-- Business owners can delete their own businesses
CREATE POLICY "Business owners can delete own businesses"
  ON public.businesses
  FOR DELETE
  TO authenticated
  USING (auth.jwt()->>'sub' = owner_id);

-- Public can view active businesses (for booking interface)
CREATE POLICY "Public can view active businesses"
  ON public.businesses
  FOR SELECT
  USING (is_active = true);

-- ============================================
-- APPOINTMENTS POLICIES
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
      AND businesses.owner_id = auth.jwt()->>'sub'
    )
  );

-- Customers can view their own appointments (registered users)
CREATE POLICY "Customers can view their own appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (auth.jwt()->>'sub' = customer_id);

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
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE businesses.id = appointments.business_id 
      AND businesses.owner_id = auth.jwt()->>'sub'
    )
  );

-- Customers can cancel their own appointments
CREATE POLICY "Customers can cancel their appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'sub' = customer_id)
  WITH CHECK (
    status = 'cancelled' AND 
    cancelled_at IS NOT NULL
  );

-- ============================================
-- BLOCKED SLOTS POLICIES
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
      AND businesses.owner_id = auth.jwt()->>'sub'
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
      AND businesses.owner_id = auth.jwt()->>'sub'
    ) AND
    auth.jwt()->>'sub' = created_by
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
      AND businesses.owner_id = auth.jwt()->>'sub'
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
      AND businesses.owner_id = auth.jwt()->>'sub'
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.businesses.owner_id 
  IS 'Clerk user ID (string format like user_XXX..., not UUID)';

COMMENT ON COLUMN public.appointments.customer_id 
  IS 'Clerk user ID for registered users, null for guest bookings';

COMMENT ON COLUMN public.blocked_slots.created_by 
  IS 'Clerk user ID of the user who created this blocked slot';

COMMENT ON POLICY "Business owners can view own businesses" ON public.businesses 
  IS 'Uses Clerk JWT sub claim (string format) to identify authenticated user';

COMMENT ON POLICY "Business owners can view their appointments" ON public.appointments 
  IS 'Uses Clerk JWT sub claim (string format) to identify business owner';

COMMENT ON POLICY "Customers can view their own appointments" ON public.appointments 
  IS 'Uses Clerk JWT sub claim (string format) to identify customer';

