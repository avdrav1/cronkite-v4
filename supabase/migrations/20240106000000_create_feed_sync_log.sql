-- Create feed synchronization logging table
-- Requirements: 12.1, 12.2, 12.3, 12.4, 12.5

-- Create feed_sync_log table with comprehensive metrics
-- Requirements: 12.1, 12.2, 12.3

CREATE TABLE IF NOT EXISTS feed_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_completed_at TIMESTAMPTZ,
  sync_duration_ms INTEGER, -- Duration in milliseconds
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'success', 'error', 'in_progress'
  http_status_code INTEGER, -- HTTP response code from feed URL
  error_message TEXT, -- Error details if sync failed
  articles_found INTEGER DEFAULT 0, -- Total articles in feed
  articles_new INTEGER DEFAULT 0, -- New articles added this sync
  articles_updated INTEGER DEFAULT 0, -- Existing articles updated
  etag_received TEXT, -- ETag header from response
  last_modified_received TEXT, -- Last-Modified header from response
  feed_size_bytes INTEGER, -- Size of feed response in bytes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance and querying
-- Requirements: 12.1, 12.2, 12.3

CREATE INDEX IF NOT EXISTS idx_feed_sync_log_feed_id ON feed_sync_log(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_sync_started ON feed_sync_log(sync_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_status ON feed_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_feed_status ON feed_sync_log(feed_id, status);
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_feed_started ON feed_sync_log(feed_id, sync_started_at DESC);

-- Enable Row Level Security
ALTER TABLE feed_sync_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for feed_sync_log table
-- Users can only see sync logs for their own feeds
CREATE POLICY "Users can view sync logs for own feeds" ON feed_sync_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds 
      WHERE feeds.id = feed_sync_log.feed_id 
      AND feeds.user_id = auth.uid()
    )
  );

-- System can insert sync logs (no user restriction for background processes)
CREATE POLICY "System can insert sync logs" ON feed_sync_log
  FOR INSERT WITH CHECK (true);

-- System can update sync logs (no user restriction for background processes)
CREATE POLICY "System can update sync logs" ON feed_sync_log
  FOR UPDATE USING (true);

-- Create function to automatically calculate sync duration
CREATE OR REPLACE FUNCTION update_sync_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate duration when sync is completed
  IF NEW.sync_completed_at IS NOT NULL AND OLD.sync_completed_at IS NULL THEN
    NEW.sync_duration_ms = EXTRACT(EPOCH FROM (NEW.sync_completed_at - NEW.sync_started_at)) * 1000;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate sync duration
CREATE TRIGGER calculate_sync_duration
  BEFORE UPDATE ON feed_sync_log
  FOR EACH ROW EXECUTE FUNCTION update_sync_duration();

-- Create function for automatic cleanup to maintain last 100 logs per feed
-- Requirements: 12.4, 12.5

CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old sync logs, keeping only the last 100 per feed
  DELETE FROM feed_sync_log 
  WHERE feed_id = NEW.feed_id 
    AND id NOT IN (
      SELECT id 
      FROM feed_sync_log 
      WHERE feed_id = NEW.feed_id 
      ORDER BY sync_started_at DESC 
      LIMIT 100
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic cleanup after each insert
-- Requirements: 12.4, 12.5

CREATE TRIGGER cleanup_sync_logs_after_insert
  AFTER INSERT ON feed_sync_log
  FOR EACH ROW EXECUTE FUNCTION cleanup_old_sync_logs();

-- Create utility functions for feed sync logging

-- Function to start a sync log entry
CREATE OR REPLACE FUNCTION start_feed_sync(p_feed_id UUID)
RETURNS UUID AS $$
DECLARE
  sync_log_id UUID;
BEGIN
  INSERT INTO feed_sync_log (
    feed_id,
    sync_started_at,
    status
  ) VALUES (
    p_feed_id,
    NOW(),
    'in_progress'
  ) RETURNING id INTO sync_log_id;
  
  RETURN sync_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a sync log entry with success
CREATE OR REPLACE FUNCTION complete_feed_sync_success(
  p_sync_log_id UUID,
  p_http_status_code INTEGER DEFAULT NULL,
  p_articles_found INTEGER DEFAULT 0,
  p_articles_new INTEGER DEFAULT 0,
  p_articles_updated INTEGER DEFAULT 0,
  p_etag_received TEXT DEFAULT NULL,
  p_last_modified_received TEXT DEFAULT NULL,
  p_feed_size_bytes INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE feed_sync_log 
  SET 
    sync_completed_at = NOW(),
    status = 'success',
    http_status_code = p_http_status_code,
    articles_found = p_articles_found,
    articles_new = p_articles_new,
    articles_updated = p_articles_updated,
    etag_received = p_etag_received,
    last_modified_received = p_last_modified_received,
    feed_size_bytes = p_feed_size_bytes
  WHERE id = p_sync_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a sync log entry with error
CREATE OR REPLACE FUNCTION complete_feed_sync_error(
  p_sync_log_id UUID,
  p_error_message TEXT,
  p_http_status_code INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE feed_sync_log 
  SET 
    sync_completed_at = NOW(),
    status = 'error',
    error_message = p_error_message,
    http_status_code = p_http_status_code
  WHERE id = p_sync_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent sync logs for a feed
CREATE OR REPLACE FUNCTION get_recent_sync_logs(
  p_feed_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  sync_started_at TIMESTAMPTZ,
  sync_completed_at TIMESTAMPTZ,
  sync_duration_ms INTEGER,
  status TEXT,
  http_status_code INTEGER,
  error_message TEXT,
  articles_found INTEGER,
  articles_new INTEGER,
  articles_updated INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fsl.id,
    fsl.sync_started_at,
    fsl.sync_completed_at,
    fsl.sync_duration_ms,
    fsl.status,
    fsl.http_status_code,
    fsl.error_message,
    fsl.articles_found,
    fsl.articles_new,
    fsl.articles_updated
  FROM feed_sync_log fsl
  WHERE fsl.feed_id = p_feed_id
  ORDER BY fsl.sync_started_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sync statistics for a feed
CREATE OR REPLACE FUNCTION get_feed_sync_stats(p_feed_id UUID)
RETURNS TABLE(
  total_syncs INTEGER,
  successful_syncs INTEGER,
  failed_syncs INTEGER,
  success_rate NUMERIC,
  avg_duration_ms NUMERIC,
  last_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_syncs,
    COUNT(*) FILTER (WHERE status = 'success')::INTEGER as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'error')::INTEGER as failed_syncs,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    ROUND(AVG(sync_duration_ms) FILTER (WHERE sync_duration_ms IS NOT NULL), 2) as avg_duration_ms,
    MAX(sync_started_at) as last_sync_at,
    MAX(sync_started_at) FILTER (WHERE status = 'success') as last_successful_sync_at
  FROM feed_sync_log
  WHERE feed_id = p_feed_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;