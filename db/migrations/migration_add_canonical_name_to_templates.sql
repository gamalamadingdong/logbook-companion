-- Migration: Add canonical_name to workout_templates and create indexes
-- Purpose: Enable efficient template matching by canonical name
-- Date: 2026-02-04

-- Add canonical_name column to workout_templates
ALTER TABLE public.workout_templates
ADD COLUMN IF NOT EXISTS canonical_name text;

-- Create index on workout_templates.canonical_name for fast lookups
CREATE INDEX IF NOT EXISTS idx_workout_templates_canonical_name 
ON public.workout_templates(canonical_name) 
WHERE canonical_name IS NOT NULL;

-- Create index on workout_logs.template_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_workout_logs_template_id 
ON public.workout_logs(template_id) 
WHERE template_id IS NOT NULL;

-- Create index on workout_logs.canonical_name for matching
CREATE INDEX IF NOT EXISTS idx_workout_logs_canonical_name 
ON public.workout_logs(canonical_name) 
WHERE canonical_name IS NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.workout_templates.canonical_name IS 
'Canonical RWN representation for template matching. Generated from rwn or workout_structure.';

COMMENT ON COLUMN public.workout_logs.canonical_name IS 
'Canonical RWN representation of the completed workout. Used for template matching.';
