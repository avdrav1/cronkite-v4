-- Add feed priority and scheduling columns for AI features
-- Requirements: 3.1, 3.2, 3.3, 3.4, 3.7

-- Add scheduling columns to feeds table
-- Note: priority column already exists from feed_management_tables migration
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS sync_priority TEXT NOT NULL DEFAULT 'medium'
  CHECK (sync_priority IN ('high', 'medium', 'low'));
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS sync_interval_hours INTEGER NOT NULL DEFAULT 24;

-- Add default_priority to recommended_feeds table
ALTER TABLE recommended_feeds ADD COLUMN IF NOT EXISTS default_priority TEXT NOT NULL DEFAULT 'medium'
  CHECK (default_priority IN ('high', 'medium', 'low'));

-- Create indexes for priority-based scheduling queries
CREATE INDEX IF NOT EXISTS idx_feeds_next_sync ON feeds(next_sync_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_feeds_sync_priority ON feeds(sync_priority, next_sync_at);

-- Update high-priority sources (breaking news sources)
-- Requirements: 3.7 - NYT, BBC, CNN, Reuters, AP should be high-priority by default
UPDATE recommended_feeds SET default_priority = 'high'
WHERE url LIKE '%nytimes.com%'
   OR url LIKE '%bbc.com%'
   OR url LIKE '%bbc.co.uk%'
   OR url LIKE '%cnn.com%'
   OR url LIKE '%reuters.com%'
   OR url LIKE '%apnews.com%'
   OR url LIKE '%washingtonpost.com%'
   OR url LIKE '%theguardian.com%';

-- Create function to calculate next sync time based on priority
-- Requirements: 3.1, 3.2, 3.3
CREATE OR REPLACE FUNCTION calculate_next_sync_at(
  p_priority TEXT,
  p_last_sync_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  interval_hours INTEGER;
BEGIN
  -- Determine interval based on priority
  -- High: 1 hour, Medium: 24 hours, Low: 168 hours (7 days)
  CASE p_priority
    WHEN 'high' THEN interval_hours := 1;
    WHEN 'medium' THEN interval_hours := 24;
    WHEN 'low' THEN interval_hours := 168;
    ELSE interval_hours := 24; -- Default to medium
  END CASE;
  
  RETURN p_last_sync_at + (interval_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to automatically update next_sync_at when priority changes
CREATE OR REPLACE FUNCTION update_feed_sync_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- Update sync_interval_hours based on priority
  CASE NEW.sync_priority
    WHEN 'high' THEN NEW.sync_interval_hours := 1;
    WHEN 'medium' THEN NEW.sync_interval_hours := 24;
    WHEN 'low' THEN NEW.sync_interval_hours := 168;
    ELSE NEW.sync_interval_hours := 24;
  END CASE;
  
  -- Calculate next sync time
  NEW.next_sync_at := calculate_next_sync_at(
    NEW.sync_priority, 
    COALESCE(NEW.last_fetched_at, NOW())
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for feed priority changes
DROP TRIGGER IF EXISTS update_feed_sync_schedule_trigger ON feeds;
CREATE TRIGGER update_feed_sync_schedule_trigger
  BEFORE INSERT OR UPDATE OF sync_priority, last_fetched_at ON feeds
  FOR EACH ROW EXECUTE FUNCTION update_feed_sync_schedule();

-- Initialize existing feeds with proper sync schedules
UPDATE feeds 
SET 
  sync_priority = COALESCE(priority::TEXT, 'medium'),
  sync_interval_hours = CASE 
    WHEN priority = 'high' THEN 1
    WHEN priority = 'medium' THEN 24
    WHEN priority = 'low' THEN 168
    ELSE 24
  END,
  next_sync_at = calculate_next_sync_at(
    COALESCE(priority::TEXT, 'medium'),
    COALESCE(last_fetched_at, NOW())
  )
WHERE sync_priority IS NULL OR next_sync_at IS NULL;
