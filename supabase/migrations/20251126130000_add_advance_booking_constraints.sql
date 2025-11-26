-- ============================================
-- ADD ADVANCE BOOKING CONSTRAINTS
-- ============================================
-- Adds min/max advance booking configuration to businesses table
-- These fields control how far in advance customers can book appointments

-- Add columns with sensible defaults
ALTER TABLE public.businesses
  ADD COLUMN min_advance_booking_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN max_advance_booking_days INTEGER NOT NULL DEFAULT 90;

-- Add validation constraints
ALTER TABLE public.businesses
  ADD CONSTRAINT valid_min_advance_booking 
    CHECK (min_advance_booking_minutes >= 0 AND min_advance_booking_minutes <= 43200),
  ADD CONSTRAINT valid_max_advance_booking 
    CHECK (max_advance_booking_days > 0 AND max_advance_booking_days <= 365);

-- Add helpful comments
COMMENT ON COLUMN public.businesses.min_advance_booking_minutes IS 
  'Minimum minutes in advance required to book (0 = immediate booking allowed, max 30 days)';
COMMENT ON COLUMN public.businesses.max_advance_booking_days IS 
  'Maximum days in advance allowed to book (1-365 days, default: 90)';

