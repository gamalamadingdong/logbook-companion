-- Add created_by column to workout_templates
ALTER TABLE public.workout_templates 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Backfill existing templates with a default user (admin)
-- Update this UUID to your user ID if needed
UPDATE public.workout_templates 
SET created_by = '93c46300-57eb-48c8-b35c-cc49c76cfa66'
WHERE created_by IS NULL;

-- Enable RLS on workout_templates (already enabled, but safe to re-run)
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

-- Drop old coach-based policies
DROP POLICY IF EXISTS "Anyone can view published workout templates" ON public.workout_templates;
DROP POLICY IF EXISTS "Coaches can view pending workout templates" ON public.workout_templates;
DROP POLICY IF EXISTS "Coaches can update workout templates" ON public.workout_templates;
DROP POLICY IF EXISTS "Coaches can delete workout templates" ON public.workout_templates;

-- Policy: Anyone can view published templates OR their own drafts
CREATE POLICY "Anyone can view published templates" 
ON public.workout_templates FOR SELECT
USING (status = 'published' OR created_by = auth.uid());

-- Policy: Authenticated users can create templates (sets created_by automatically)
CREATE POLICY "Authenticated users can create templates" 
ON public.workout_templates FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Policy: Users can update their own templates
CREATE POLICY "Users can update own templates" 
ON public.workout_templates FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own templates
CREATE POLICY "Users can delete own templates" 
ON public.workout_templates FOR DELETE
TO authenticated
USING (created_by = auth.uid());

