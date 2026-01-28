-- Create cleanup_log table for article cleanup monitoring
-- Requirements: 8.2 (Cleanup Monitoring and Reporting)

-- Create cleanup_log table to track all cleanup operations
-- This table stores metrics for monitoring cleanup effectiveness and debugging issues
CREATE TABLE IF NOT EXISTS cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  articles_deleted INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Validation constraints
  CONSTRAINT cleanup_log_trigger_type_valid CHECK (trigger_type IN ('sync', 'scheduled', 'manual')),
  CONSTRAINT cleanup_log_articles_deleted_non_negative CHECK (articles_deleted >= 0),
  CONSTRAINT cleanup_log_duration_positive CHECK (duration_ms > 0)
);

-- Create performance indexes for cleanup log queries
-- Index on user_id for per-user cleanup history queries
CREATE INDEX IF NOT EXISTS idx_cleanup_log_user_id ON cleanup_log(user_id);

-- Index on created_at for time-based queries and statistics
CREATE INDEX IF NOT EXISTS idx_cleanup_log_created_at ON cleanup_log(created_at DESC);

-- Composite index for user-specific time-based queries
CREATE INDEX IF NOT EXISTS idx_cleanup_log_user_created ON cleanup_log(user_id, created_at DESC);

-- Index on trigger_type for filtering by cleanup source
CREATE INDEX IF NOT EXISTS idx_cleanup_log_trigger_type ON cleanup_log(trigger_type);

-- Index on feed_id for per-feed cleanup history
CREATE INDEX IF NOT EXISTS idx_cleanup_log_feed_id ON cleanup_log(feed_id) WHERE feed_id IS NOT NULL;

-- Partial index for error tracking and monitoring
CREATE INDEX IF NOT EXISTS idx_cleanup_log_errors ON cleanup_log(created_at DESC) WHERE error_message IS NOT NULL;

-- Enable Row Level Security on cleanup_log table
ALTER TABLE cleanup_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cleanup_log table
-- Users can view their own cleanup logs
CREATE POLICY "Users can view own cleanup logs" ON cleanup_log
  FOR SELECT USING (auth.uid() = user_id);

-- System can insert cleanup logs for any user
CREATE POLICY "System can create cleanup logs" ON cleanup_log
  FOR INSERT WITH CHECK (true);

-- Admins can view all cleanup logs
CREATE POLICY "Admins can view all cleanup logs" ON cleanup_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create function to automatically clean up old cleanup logs (retention policy)
-- Keep logs for 90 days to maintain reasonable table size
CREATE OR REPLACE FUNCTION cleanup_old_cleanup_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM cleanup_log 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Add comment to table for documentation
COMMENT ON TABLE cleanup_log IS 'Tracks article cleanup operations for monitoring and debugging. Logs include user, feed, trigger type, articles deleted, duration, and errors.';
COMMENT ON COLUMN cleanup_log.trigger_type IS 'Source of cleanup: sync (feed sync), scheduled (background job), or manual (admin trigger)';
COMMENT ON COLUMN cleanup_log.articles_deleted IS 'Number of articles deleted in this cleanup operation';
COMMENT ON COLUMN cleanup_log.duration_ms IS 'Duration of cleanup operation in milliseconds';
COMMENT ON COLUMN cleanup_log.error_message IS 'Error message if cleanup failed, NULL if successful';

-- Rollback instructions:
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS cleanup_log CASCADE;
-- DROP FUNCTION IF EXISTS cleanup_old_cleanup_logs();
