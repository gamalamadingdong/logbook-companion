-- Add Daily Recommendation and PR columns to user_profiles

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS daily_recommendation JSONB,
ADD COLUMN IF NOT EXISTS personal_records JSONB;

-- Comment for documentation
COMMENT ON COLUMN user_profiles.daily_recommendation IS 'Stores the recommended workout for the day to ensure persistence (JSON: {date, template_id, reason})';
COMMENT ON COLUMN user_profiles.personal_records IS 'Cache of user bests (JSON: {"2k": 420.5}) for quick access';
