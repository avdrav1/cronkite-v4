-- Migration: Add scheduler_runs table and feed health tracking
-- This enables monitoring of automated feed sync jobs and feed health metrics

-- ============================================================================
-- Scheduler Runs Table
-- Tracks each run of the feed sync scheduler for monitoring and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduler_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL DEFAULT 'feed_sync', -- 'feed_sync', 'ai_jobs', etc.
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Feed sync specific metrics
  feeds_synced INTEGER DEFAULT 0,
  feeds_succeeded INTEGER DEFAULT 0,
  feeds_failed INTEGER DEFAULT 0,
  articles_new INTEGER DEFAULT 0,
  articles_updated INTEGER DEFAULT 0,
  
  -- Error tracking
  errors JSONB, -- Array of error messages
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_started_at ON scheduler_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_run_type ON scheduler_runs(run_type);

-- ============================================================================
-- Feed Health Metrics View
-- Aggregates sync history to provide health metrics per feed
-- ============================================================================

-- Add columns to feed_sync_log if they don't exist
DO $$ 
BEGIN
  -- Add retry_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feed_sync_log' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE feed_sync_log ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create a view for feed health metrics
CREATE OR REPLACE VIEW feed_health_metrics AS
SELECT 
  f.id AS feed_id,
  f.name AS feed_name,
  f.url AS feed_url,
  f.user_id,
  f.status,
  f.priority,
  f.sync_priority,
  f.last_fetched_at,
  f.next_sync_at,
  f.sync_interval_hours,
  
  -- Last 24 hours metrics
  COALESCE(recent.sync_count_24h, 0) AS sync_count_24h,
  COALESCE(recent.success_count_24h, 0) AS success_count_24h,
  COALESCE(recent.error_count_24h, 0) AS error_count_24h,
  COALESCE(recent.articles_new_24h, 0) AS articles_new_24h,
  
  -- Last 7 days metrics
  COALESCE(weekly.sync_count_7d, 0) AS sync_count_7d,
  COALESCE(weekly.success_count_7d, 0) AS success_count_7d,
  COALESCE(weekly.error_count_7d, 0) AS error_count_7d,
  COALESCE(weekly.articles_new_7d, 0) AS articles_new_7d,
  
  -- Success rate (7 days)
  CASE 
    WHEN COALESCE(weekly.sync_count_7d, 0) > 0 
    THEN ROUND((COALESCE(weekly.success_count_7d, 0)::NUMERIC / weekly.sync_count_7d) * 100, 1)
    ELSE NULL
  END AS success_rate_7d,
  
  -- Average sync duration (7 days)
  COALESCE(weekly.avg_duration_ms, 0) AS avg_sync_duration_ms,
  
  -- Last sync info
  last_sync.status AS last_sync_status,
  last_sync.error_message AS last_sync_error,
  last_sync.articles_new AS last_sync_articles_new,
  last_sync.sync_duration_ms AS last_sync_duration_ms,
  last_sync.sync_completed_at AS last_sync_completed_at,
  
  -- Consecutive failures
  COALESCE(failures.consecutive_failures, 0) AS consecutive_failures,
  
  -- Health status
  CASE
    WHEN f.status = 'paused' THEN 'paused'
    WHEN f.status = 'error' THEN 'error'
    WHEN COALESCE(failures.consecutive_failures, 0) >= 5 THEN 'critical'
    WHEN COALESCE(failures.consecutive_failures, 0) >= 3 THEN 'warning'
    WHEN COALESCE(weekly.success_count_7d, 0) = 0 AND COALESCE(weekly.sync_count_7d, 0) > 0 THEN 'failing'
    WHEN COALESCE(weekly.sync_count_7d, 0) = 0 THEN 'unknown'
    WHEN (COALESCE(weekly.success_count_7d, 0)::NUMERIC / NULLIF(weekly.sync_count_7d, 0)) < 0.5 THEN 'degraded'
    ELSE 'healthy'
  END AS health_status

FROM feeds f

-- Recent 24h metrics
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) AS sync_count_24h,
    COUNT(*) FILTER (WHERE status = 'success') AS success_count_24h,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count_24h,
    COALESCE(SUM(articles_new), 0) AS articles_new_24h
  FROM feed_sync_log
  WHERE feed_id = f.id 
    AND sync_started_at > NOW() - INTERVAL '24 hours'
) recent ON true

-- Weekly metrics
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) AS sync_count_7d,
    COUNT(*) FILTER (WHERE status = 'success') AS success_count_7d,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count_7d,
    COALESCE(SUM(articles_new), 0) AS articles_new_7d,
    AVG(sync_duration_ms) AS avg_duration_ms
  FROM feed_sync_log
  WHERE feed_id = f.id 
    AND sync_started_at > NOW() - INTERVAL '7 days'
) weekly ON true

-- Last sync info
LEFT JOIN LATERAL (
  SELECT 
    status,
    error_message,
    articles_new,
    sync_duration_ms,
    sync_completed_at
  FROM feed_sync_log
  WHERE feed_id = f.id
  ORDER BY sync_started_at DESC
  LIMIT 1
) last_sync ON true

-- Consecutive failures count
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS consecutive_failures
  FROM (
    SELECT status, 
           ROW_NUMBER() OVER (ORDER BY sync_started_at DESC) AS rn
    FROM feed_sync_log
    WHERE feed_id = f.id
    ORDER BY sync_started_at DESC
    LIMIT 10
  ) recent_syncs
  WHERE status = 'error'
    AND rn <= (
      SELECT COALESCE(MIN(rn) - 1, 10)
      FROM (
        SELECT status, ROW_NUMBER() OVER (ORDER BY sync_started_at DESC) AS rn
        FROM feed_sync_log
        WHERE feed_id = f.id
        ORDER BY sync_started_at DESC
        LIMIT 10
      ) s
      WHERE status = 'success'
    )
) failures ON true;

-- ============================================================================
-- Scheduler Health View
-- Provides overview of scheduler performance
-- ============================================================================

CREATE OR REPLACE VIEW scheduler_health AS
SELECT 
  run_type,
  
  -- Last run info
  MAX(started_at) AS last_run_at,
  MAX(completed_at) AS last_completed_at,
  
  -- Last 24 hours
  COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS runs_24h,
  AVG(duration_ms) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS avg_duration_24h,
  SUM(feeds_synced) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS feeds_synced_24h,
  SUM(feeds_succeeded) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS feeds_succeeded_24h,
  SUM(feeds_failed) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS feeds_failed_24h,
  SUM(articles_new) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS articles_new_24h,
  
  -- Success rate
  CASE 
    WHEN SUM(feeds_synced) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') > 0
    THEN ROUND(
      (SUM(feeds_succeeded) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours')::NUMERIC / 
       SUM(feeds_synced) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours')) * 100, 1
    )
    ELSE NULL
  END AS success_rate_24h

FROM scheduler_runs
GROUP BY run_type;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on scheduler_runs
ALTER TABLE scheduler_runs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to scheduler_runs
CREATE POLICY "Service role can manage scheduler_runs" ON scheduler_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Function to get feed health for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_feed_health(p_user_id UUID)
RETURNS TABLE (
  feed_id UUID,
  feed_name TEXT,
  feed_url TEXT,
  status TEXT,
  priority TEXT,
  health_status TEXT,
  success_rate_7d NUMERIC,
  sync_count_7d BIGINT,
  articles_new_7d BIGINT,
  last_sync_status TEXT,
  last_sync_error TEXT,
  last_sync_at TIMESTAMPTZ,
  consecutive_failures BIGINT,
  next_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fhm.feed_id,
    fhm.feed_name,
    fhm.feed_url,
    fhm.status::TEXT,
    COALESCE(fhm.sync_priority, fhm.priority::TEXT) AS priority,
    fhm.health_status,
    fhm.success_rate_7d,
    fhm.sync_count_7d,
    fhm.articles_new_7d,
    fhm.last_sync_status,
    fhm.last_sync_error,
    fhm.last_sync_completed_at AS last_sync_at,
    fhm.consecutive_failures,
    fhm.next_sync_at
  FROM feed_health_metrics fhm
  WHERE fhm.user_id = p_user_id
  ORDER BY 
    CASE fhm.health_status
      WHEN 'critical' THEN 1
      WHEN 'error' THEN 2
      WHEN 'failing' THEN 3
      WHEN 'warning' THEN 4
      WHEN 'degraded' THEN 5
      WHEN 'unknown' THEN 6
      WHEN 'paused' THEN 7
      ELSE 8
    END,
    fhm.feed_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to get scheduler status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_scheduler_status()
RETURNS TABLE (
  run_type TEXT,
  last_run_at TIMESTAMPTZ,
  runs_24h BIGINT,
  success_rate_24h NUMERIC,
  feeds_synced_24h BIGINT,
  articles_new_24h BIGINT,
  is_healthy BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sh.run_type,
    sh.last_run_at,
    sh.runs_24h,
    sh.success_rate_24h,
    sh.feeds_synced_24h,
    sh.articles_new_24h,
    -- Consider healthy if ran in last hour and success rate > 80%
    (sh.last_run_at > NOW() - INTERVAL '1 hour' AND COALESCE(sh.success_rate_24h, 0) >= 80) AS is_healthy
  FROM scheduler_health sh;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_feed_health(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_scheduler_status() TO authenticated;
