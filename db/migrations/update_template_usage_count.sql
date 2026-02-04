-- Migration: Update template usage_count when workouts are linked/unlinked
-- This adds a trigger to automatically maintain the usage_count field

-- Function to update usage_count for a template
CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  -- If template_id changed (linked, unlinked, or changed)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.template_id IS DISTINCT FROM OLD.template_id THEN
    -- Decrement old template if it existed
    IF OLD.template_id IS NOT NULL THEN
      UPDATE workout_templates
      SET usage_count = (
        SELECT COUNT(*) FROM workout_logs WHERE template_id = OLD.template_id
      )
      WHERE id = OLD.template_id;
    END IF;
    
    -- Increment new template if it exists
    IF NEW.template_id IS NOT NULL THEN
      UPDATE workout_templates
      SET usage_count = (
        SELECT COUNT(*) FROM workout_logs WHERE template_id = NEW.template_id
      )
      WHERE id = NEW.template_id;
    END IF;
  END IF;
  
  -- Handle DELETE
  IF TG_OP = 'DELETE' AND OLD.template_id IS NOT NULL THEN
    UPDATE workout_templates
    SET usage_count = (
      SELECT COUNT(*) FROM workout_logs WHERE template_id = OLD.template_id
    )
    WHERE id = OLD.template_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_template_usage_count ON workout_logs;

-- Create trigger
CREATE TRIGGER trigger_update_template_usage_count
AFTER INSERT OR UPDATE OF template_id OR DELETE ON workout_logs
FOR EACH ROW
EXECUTE FUNCTION update_template_usage_count();

-- Backfill existing usage_counts
UPDATE workout_templates
SET usage_count = (
  SELECT COUNT(*) 
  FROM workout_logs 
  WHERE workout_logs.template_id = workout_templates.id
);

-- Add comment
COMMENT ON FUNCTION update_template_usage_count() IS 'Automatically maintains usage_count in workout_templates when workouts are linked/unlinked';
