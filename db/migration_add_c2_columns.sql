-- Run this in your Supabase SQL Editor to add the missing columns
-- This will NOT delete any existing data

ALTER TABLE public.workout_logs 
ADD COLUMN IF NOT EXISTS external_id text UNIQUE, 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'concept2',
ADD COLUMN IF NOT EXISTS raw_data jsonb,
ADD COLUMN IF NOT EXISTS watts integer;

-- Recommended: Add an index on external_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_workout_logs_external_id ON public.workout_logs(external_id);
