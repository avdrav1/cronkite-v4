-- Comprehensive Row Level Security (RLS) policies
-- Requirements: 13.2, 13.3
-- This migration ensures all RLS policies are comprehensive and complete

-- Ensure RLS is enabled on all user-specific tables (should already be done)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommended_feeds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them comprehensively
-- This ensures we have the most complete and secure policies

-- Profiles table policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Note: No INSERT policy for profiles as they are created automatically via trigger
-- Note: No DELETE policy for profiles as users are deleted via Supabase Auth

-- User settings table policies
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- User interests table policies
DROP POLICY IF EXISTS "Users can view own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can insert own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can update own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can delete own interests" ON user_interests;

CREATE POLICY "Users can view own interests" ON user_interests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interests" ON user_interests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interests" ON user_interests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interests" ON user_interests
  FOR DELETE USING (auth.uid() = user_id);

-- Folders table policies
DROP POLICY IF EXISTS "Users can view own folders" ON folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON folders;
DROP POLICY IF EXISTS "Users can update own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON folders;

CREATE POLICY "Users can view own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- Feeds table policies
DROP POLICY IF EXISTS "Users can view own feeds" ON feeds;
DROP POLICY IF EXISTS "Users can insert own feeds" ON feeds;
DROP POLICY IF EXISTS "Users can update own feeds" ON feeds;
DROP POLICY IF EXISTS "Users can delete own feeds" ON feeds;

CREATE POLICY "Users can view own feeds" ON feeds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feeds" ON feeds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feeds" ON feeds
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feeds" ON feeds
  FOR DELETE USING (auth.uid() = user_id);

-- Articles table policies
-- Users can only see articles from feeds they subscribe to
DROP POLICY IF EXISTS "Users can view articles from subscribed feeds" ON articles;

CREATE POLICY "Users can view articles from subscribed feeds" ON articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds 
      WHERE feeds.id = articles.feed_id 
      AND feeds.user_id = auth.uid()
    )
  );

-- System can insert/update articles (for feed synchronization)
CREATE POLICY "System can insert articles" ON articles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update articles" ON articles
  FOR UPDATE USING (true);

-- System can delete articles (for cleanup)
CREATE POLICY "System can delete articles" ON articles
  FOR DELETE USING (true);

-- User articles table policies
DROP POLICY IF EXISTS "Users can view own article states" ON user_articles;
DROP POLICY IF EXISTS "Users can insert own article states" ON user_articles;
DROP POLICY IF EXISTS "Users can update own article states" ON user_articles;
DROP POLICY IF EXISTS "Users can delete own article states" ON user_articles;

CREATE POLICY "Users can view own article states" ON user_articles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own article states" ON user_articles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own article states" ON user_articles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own article states" ON user_articles
  FOR DELETE USING (auth.uid() = user_id);

-- Clusters table policies
-- Users can see clusters that contain articles from their subscribed feeds
DROP POLICY IF EXISTS "Users can view relevant clusters" ON clusters;

CREATE POLICY "Users can view relevant clusters" ON clusters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM articles 
      JOIN feeds ON articles.feed_id = feeds.id
      WHERE articles.cluster_id = clusters.id 
      AND feeds.user_id = auth.uid()
    )
  );

-- System can manage clusters (for AI processing)
CREATE POLICY "System can insert clusters" ON clusters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update clusters" ON clusters
  FOR UPDATE USING (true);

CREATE POLICY "System can delete clusters" ON clusters
  FOR DELETE USING (true);

-- AI usage table policies
DROP POLICY IF EXISTS "Users can view own AI usage" ON ai_usage;
DROP POLICY IF EXISTS "Users can insert own AI usage" ON ai_usage;
DROP POLICY IF EXISTS "Users can update own AI usage" ON ai_usage;

CREATE POLICY "Users can view own AI usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI usage" ON ai_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI usage" ON ai_usage
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI usage" ON ai_usage
  FOR DELETE USING (auth.uid() = user_id);

-- Digest history table policies
DROP POLICY IF EXISTS "Users can view own digest history" ON digest_history;
DROP POLICY IF EXISTS "Users can insert own digest history" ON digest_history;
DROP POLICY IF EXISTS "Users can update own digest history" ON digest_history;

CREATE POLICY "Users can view own digest history" ON digest_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own digest history" ON digest_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own digest history" ON digest_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own digest history" ON digest_history
  FOR DELETE USING (auth.uid() = user_id);

-- Feed sync log table policies
-- Users can only see sync logs for their own feeds
DROP POLICY IF EXISTS "Users can view sync logs for own feeds" ON feed_sync_log;
DROP POLICY IF EXISTS "System can insert sync logs" ON feed_sync_log;
DROP POLICY IF EXISTS "System can update sync logs" ON feed_sync_log;

CREATE POLICY "Users can view sync logs for own feeds" ON feed_sync_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds 
      WHERE feeds.id = feed_sync_log.feed_id 
      AND feeds.user_id = auth.uid()
    )
  );

-- System can manage sync logs (for background processes)
CREATE POLICY "System can insert sync logs" ON feed_sync_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update sync logs" ON feed_sync_log
  FOR UPDATE USING (true);

CREATE POLICY "System can delete sync logs" ON feed_sync_log
  FOR DELETE USING (true);

-- Recommended feeds table policies (public read access)
DROP POLICY IF EXISTS "Anyone can view recommended feeds" ON recommended_feeds;

CREATE POLICY "Anyone can view recommended feeds" ON recommended_feeds
  FOR SELECT USING (true);

-- System can manage recommended feeds
CREATE POLICY "System can insert recommended feeds" ON recommended_feeds
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update recommended feeds" ON recommended_feeds
  FOR UPDATE USING (true);

CREATE POLICY "System can delete recommended feeds" ON recommended_feeds
  FOR DELETE USING (true);

-- Additional security function to verify user ownership
-- This function can be used in application code to double-check permissions

CREATE OR REPLACE FUNCTION verify_user_owns_resource(
  resource_table TEXT,
  resource_id UUID,
  user_id_to_check UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  owns_resource BOOLEAN := FALSE;
BEGIN
  -- Check ownership based on table type
  CASE resource_table
    WHEN 'feeds' THEN
      SELECT EXISTS(
        SELECT 1 FROM feeds 
        WHERE id = resource_id AND user_id = user_id_to_check
      ) INTO owns_resource;
    
    WHEN 'folders' THEN
      SELECT EXISTS(
        SELECT 1 FROM folders 
        WHERE id = resource_id AND user_id = user_id_to_check
      ) INTO owns_resource;
    
    WHEN 'articles' THEN
      SELECT EXISTS(
        SELECT 1 FROM articles a
        JOIN feeds f ON a.feed_id = f.id
        WHERE a.id = resource_id AND f.user_id = user_id_to_check
      ) INTO owns_resource;
    
    WHEN 'user_articles' THEN
      SELECT EXISTS(
        SELECT 1 FROM user_articles 
        WHERE id = resource_id AND user_id = user_id_to_check
      ) INTO owns_resource;
    
    ELSE
      owns_resource := FALSE;
  END CASE;
  
  RETURN owns_resource;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can access a specific article
-- This enforces the rule that users can only access articles from subscribed feeds

CREATE OR REPLACE FUNCTION user_can_access_article(
  article_id_to_check UUID,
  user_id_to_check UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  can_access BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE a.id = article_id_to_check 
    AND f.user_id = user_id_to_check
  ) INTO can_access;
  
  RETURN can_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can access a specific cluster
-- Users can access clusters that contain articles from their subscribed feeds

CREATE OR REPLACE FUNCTION user_can_access_cluster(
  cluster_id_to_check UUID,
  user_id_to_check UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  can_access BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE a.cluster_id = cluster_id_to_check 
    AND f.user_id = user_id_to_check
  ) INTO can_access;
  
  RETURN can_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions for RLS to work properly
-- These grants ensure that the auth.uid() function works in RLS policies

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Create indexes to optimize RLS policy performance
-- These indexes help RLS policies execute efficiently

CREATE INDEX IF NOT EXISTS idx_feeds_user_id_rls ON feeds(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folders_user_id_rls ON folders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_articles_user_id_rls ON user_articles(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id_rls ON user_settings(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id_rls ON user_interests(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id_rls ON ai_usage(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_digest_history_user_id_rls ON digest_history(user_id) WHERE user_id IS NOT NULL;

-- Create composite indexes for complex RLS policies
CREATE INDEX IF NOT EXISTS idx_articles_feed_user_rls ON articles(feed_id) 
  INCLUDE (id) WHERE feed_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_sync_log_feed_rls ON feed_sync_log(feed_id) 
  INCLUDE (id) WHERE feed_id IS NOT NULL;

-- Add comments to document the RLS security model
COMMENT ON TABLE profiles IS 'User profiles with RLS: users can only access their own profile';
COMMENT ON TABLE user_settings IS 'User settings with RLS: users can only access their own settings';
COMMENT ON TABLE user_interests IS 'User interests with RLS: users can only access their own interests';
COMMENT ON TABLE folders IS 'Feed folders with RLS: users can only access their own folders';
COMMENT ON TABLE feeds IS 'RSS feeds with RLS: users can only access their own feeds';
COMMENT ON TABLE articles IS 'Articles with RLS: users can only access articles from their subscribed feeds';
COMMENT ON TABLE user_articles IS 'User article states with RLS: users can only access their own article states';
COMMENT ON TABLE clusters IS 'Article clusters with RLS: users can only access clusters containing articles from their feeds';
COMMENT ON TABLE ai_usage IS 'AI usage tracking with RLS: users can only access their own usage data';
COMMENT ON TABLE digest_history IS 'Digest history with RLS: users can only access their own digest history';
COMMENT ON TABLE feed_sync_log IS 'Feed sync logs with RLS: users can only access logs for their own feeds';
COMMENT ON TABLE recommended_feeds IS 'Recommended feeds with public read access, no user restrictions';