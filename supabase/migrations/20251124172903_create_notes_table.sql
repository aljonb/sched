-- Create a simple notes table for testing
CREATE TABLE public.notes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create a simple policy (allow all for testing)
CREATE POLICY "Enable read access for all users" 
  ON public.notes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Enable insert for all users" 
  ON public.notes 
  FOR INSERT 
  WITH CHECK (true);

-- Add a comment
COMMENT ON TABLE public.notes IS 'Simple test table for Supabase CLI workflow';

