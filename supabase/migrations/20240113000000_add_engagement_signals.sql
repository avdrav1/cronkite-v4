-- Add engagement signal columns to user_articles table
-- Requirements: 8.1, 8.2, 8.3, 8.4 (Feed Management Controls - Engagement Signals)

-- Add engagement_signal column with CHECK constraint for valid values
ALTER TABLE user_articles 
ADD COLUMN IF NOT EXISTS engagement_signal TEXT 
  CHECK (engagement_signal IS NULL OR engagement_signal IN ('positive', 'negative'));

-- Add engagement_signal_at timestamp column
ALTER TABLE user_articles 
ADD COLUMN IF NOT EXISTS engagement_signal_at TIMESTAMPTZ;

-- Create index for efficient engagement queries (filtering by user and signal type)
CREATE INDEX IF NOT EXISTS idx_user_articles_engagement 
ON user_articles(user_id, engagement_signal) 
WHERE engagement_signal IS NOT NULL;

-- Create index for engagement signal timestamp queries
CREATE INDEX IF NOT EXISTS idx_user_articles_engagement_at 
ON user_articles(engagement_signal_at DESC) 
WHERE engagement_signal_at IS NOT NULL;

-- Create function to automatically update engagement_signal_at timestamp
CREATE OR REPLACE FUNCTION update_engagement_signal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Set engagement_signal_at when engagement_signal is set
  IF NEW.engagement_signal IS NOT NULL AND (OLD.engagement_signal IS NULL OR OLD.engagement_signal IS DISTINCT FROM NEW.engagement_signal) THEN
    NEW.engagement_signal_at = NOW();
  ELSIF NEW.engagement_signal IS NULL THEN
    NEW.engagement_signal_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage engagement signal timestamps
DROP TRIGGER IF EXISTS update_engagement_signal_timestamp_trigger ON user_articles;
CREATE TRIGGER update_engagement_signal_timestamp_trigger
  BEFORE INSERT OR UPDATE ON user_articles
  FOR EACH ROW EXECUTE FUNCTION update_engagement_signal_timestamp();

-- Add comment for documentation
COMMENT ON COLUMN user_articles.engagement_signal IS 'User engagement signal: positive (thumbs up) or negative (thumbs down) for content recommendations';
COMMENT ON COLUMN user_articles.engagement_signal_at IS 'Timestamp when the engagement signal was last set or changed';
