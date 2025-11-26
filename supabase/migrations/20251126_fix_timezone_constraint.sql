-- ============================================
-- FIX TIMEZONE CONSTRAINT
-- ============================================
-- The original constraint was too strict and didn't allow common
-- timezone formats like "UTC". This migration relaxes the constraint
-- to accept both IANA timezone formats (e.g., "America/New_York")
-- and simple formats (e.g., "UTC", "GMT")

-- Drop the old constraint
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS valid_timezone;

-- Add a more flexible constraint
-- Accepts:
-- - Simple timezones: UTC, GMT, EST, PST, etc. (3-5 letters)
-- - IANA format: America/New_York, Europe/London, etc.
-- - Etc/ format: Etc/UTC, Etc/GMT, etc.
ALTER TABLE public.businesses
  ADD CONSTRAINT valid_timezone CHECK (
    timezone ~ '^([A-Z]{3,5}|[A-Za-z]+/[A-Za-z_]+)$'
  );

-- Update the comment to reflect the new constraint
COMMENT ON CONSTRAINT valid_timezone ON public.businesses 
  IS 'Accepts IANA timezones (America/New_York) or simple codes (UTC, GMT, EST)';





