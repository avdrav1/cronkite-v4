-- Add cleanup settings to user_settings table
-- Requirements: 5.1, 5.2, 5.4 (User-Configurable Cleanup Settings)

-- Add cleanup configuration columns to user_settings table
-- These settings allow users to customize article cleanup behavior

-- Add articles_per_feed column (default 100, range 50-500)
-- Controls maximum number of articles to keep per feed
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS articles_per_feed INTEGER DEFAULT 100;

-- Add unread_article_age_days column (default 30, range 7-90)
-- Controls how many days to keep unread articles before cleanup
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS unread_article_age_days INTEGER DEFAULT 30;

-- Add enable_auto_cleanup column (default true)
-- Allows users to disable automatic cleanup if desired
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS enable_auto_cleanup BOOLEAN DEFAULT true;

-- Add validation constraints to ensure values are within acceptable ranges
ALTER TABLE user_settings
ADD CONSTRAINT user_settings_articles_per_feed_range 
  CHECK (articles_per_feed >= 50 AND articles_per_feed <= 500);

ALTER TABLE user_settings
ADD CONSTRAINT user_settings_unread_age_range 
  CHECK (unread_article_age_days >= 7 AND unread_article_age_days <= 90);

-- Add comments for documentation
COMMENT ON COLUMN user_settings.articles_per_feed IS 'Maximum number of articles to keep per feed (range: 50-500, default: 100)';
COMMENT ON COLUMN user_settings.unread_article_age_days IS 'Maximum age in days for unread articles before cleanup (range: 7-90, default: 30)';
COMMENT ON COLUMN user_settings.enable_auto_cleanup IS 'Enable automatic article cleanup during feed sync and scheduled jobs (default: true)';

-- Rollback instructions:
-- To rollback this migration, run:
-- ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_articles_per_feed_range;
-- ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_unread_age_range;
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS articles_per_feed;
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS unread_article_age_days;
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS enable_auto_cleanup;
