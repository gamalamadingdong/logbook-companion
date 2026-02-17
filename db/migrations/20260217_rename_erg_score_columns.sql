-- Rename erg score columns to match TypeScript CoachingErgScore type
-- Table was empty at time of migration so no data impact
ALTER TABLE coaching_erg_scores RENAME COLUMN "time" TO time_seconds;
ALTER TABLE coaching_erg_scores RENAME COLUMN split TO split_500m;
