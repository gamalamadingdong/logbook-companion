-- Migration: Add last_used_at to workout_templates
-- Purpose: Track when a template was most recently linked to a workout for sorting by recency

-- Add last_used_at column
ALTER TABLE workout_templates 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient sorting by last_used_at
CREATE INDEX IF NOT EXISTS idx_workout_templates_last_used_at 
ON workout_templates(last_used_at DESC);

-- Update the trigger function to also update last_used_at
CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT: Increment usage_count and update last_used_at for new template link
    IF (TG_OP = 'INSERT' AND NEW.template_id IS NOT NULL) THEN
        UPDATE workout_templates
        SET 
            usage_count = usage_count + 1,
            last_used_at = GREATEST(COALESCE(last_used_at, NEW.created_at), NEW.created_at)
        WHERE id = NEW.template_id;
        RETURN NEW;
    END IF;

    -- Handle UPDATE: Adjust counts when template_id changes
    IF (TG_OP = 'UPDATE') THEN
        -- Removed link (template_id set to NULL)
        IF (OLD.template_id IS NOT NULL AND NEW.template_id IS NULL) THEN
            UPDATE workout_templates
            SET usage_count = GREATEST(usage_count - 1, 0)
            WHERE id = OLD.template_id;
            RETURN NEW;
        END IF;

        -- Added link (template_id was NULL, now set)
        IF (OLD.template_id IS NULL AND NEW.template_id IS NOT NULL) THEN
            UPDATE workout_templates
            SET 
                usage_count = usage_count + 1,
                last_used_at = GREATEST(COALESCE(last_used_at, NEW.created_at), NEW.created_at)
            WHERE id = NEW.template_id;
            RETURN NEW;
        END IF;

        -- Changed link (template_id changed from one template to another)
        IF (OLD.template_id IS NOT NULL AND NEW.template_id IS NOT NULL AND OLD.template_id <> NEW.template_id) THEN
            -- Decrement old template
            UPDATE workout_templates
            SET usage_count = GREATEST(usage_count - 1, 0)
            WHERE id = OLD.template_id;

            -- Increment new template and update last_used_at
            UPDATE workout_templates
            SET 
                usage_count = usage_count + 1,
                last_used_at = GREATEST(COALESCE(last_used_at, NEW.created_at), NEW.created_at)
            WHERE id = NEW.template_id;
            RETURN NEW;
        END IF;
    END IF;

    -- Handle DELETE: Decrement usage_count
    IF (TG_OP = 'DELETE' AND OLD.template_id IS NOT NULL) THEN
        UPDATE workout_templates
        SET usage_count = GREATEST(usage_count - 1, 0)
        WHERE id = OLD.template_id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Backfill last_used_at for existing template links
-- Find the most recent workout date for each template
UPDATE workout_templates t
SET last_used_at = (
    SELECT MAX(w.created_at)
    FROM workout_logs w
    WHERE w.template_id = t.id
)
WHERE usage_count > 0;

COMMENT ON COLUMN workout_templates.last_used_at IS 'Timestamp of most recent workout linked to this template';
