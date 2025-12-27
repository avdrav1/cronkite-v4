-- Add social feed preferences to user_settings table
-- Requirements: 5.4, 5.5 - Social feed preference controls and privacy controls for activity sharing

-- Add social feed preference columns
ALTER TABLE user_settings 
ADD COLUMN social_feed_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN show_friend_activity BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN social_feed_priority TEXT NOT NULL DEFAULT 'mixed',
ADD COLUMN share_reading_activity BOOLEAN NOT NULL DEFAULT true;

-- Add check constraint for social_feed_priority values
ALTER TABLE user_settings 
ADD CONSTRAINT check_social_feed_priority 
CHECK (social_feed_priority IN ('social_only', 'mixed', 'regular_only'));

-- Add comment for documentation
COMMENT ON COLUMN user_settings.social_feed_enabled IS 'Toggle for social feed features - Requirements 5.5';
COMMENT ON COLUMN user_settings.show_friend_activity IS 'Show friend activity in feeds - Requirements 5.2';
COMMENT ON COLUMN user_settings.social_feed_priority IS 'Feed display priority: social_only, mixed, or regular_only - Requirements 5.3';
COMMENT ON COLUMN user_settings.share_reading_activity IS 'Privacy control for sharing reading activity with friends - Requirements 5.4';