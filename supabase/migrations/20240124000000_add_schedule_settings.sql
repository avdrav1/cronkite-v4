-- Migration: Add schedule settings to user_settings table
-- This adds columns for configuring feed sync timing and AI clustering frequency

-- Add schedule-related columns to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS medium_priority_hour INTEGER NOT NULL DEFAULT 9,
ADD COLUMN IF NOT EXISTS low_priority_day INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS low_priority_hour INTEGER NOT NULL DEFAULT 9,
ADD COLUMN IF NOT EXISTS ai_clustering_frequency INTEGER NOT NULL DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.medium_priority_hour IS 'Hour (0-23) when medium priority feeds sync daily (ET timezone)';
COMMENT ON COLUMN user_settings.low_priority_day IS 'Day of week (0=Sunday, 6=Saturday) when low priority feeds sync';
COMMENT ON COLUMN user_settings.low_priority_hour IS 'Hour (0-23) when low priority feeds sync weekly (ET timezone)';
COMMENT ON COLUMN user_settings.ai_clustering_frequency IS 'Hours between AI clustering runs (1, 4, 8, 12, or 24)';

-- Add check constraints for valid values
ALTER TABLE user_settings
ADD CONSTRAINT check_medium_priority_hour CHECK (medium_priority_hour >= 0 AND medium_priority_hour <= 23),
ADD CONSTRAINT check_low_priority_day CHECK (low_priority_day >= 0 AND low_priority_day <= 6),
ADD CONSTRAINT check_low_priority_hour CHECK (low_priority_hour >= 0 AND low_priority_hour <= 23),
ADD CONSTRAINT check_ai_clustering_frequency CHECK (ai_clustering_frequency IN (1, 4, 8, 12, 24));
