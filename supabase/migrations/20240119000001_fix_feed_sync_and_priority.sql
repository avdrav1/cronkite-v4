-- Migration to fix feed sync last_fetched_at update and set proper default priorities
-- This addresses two issues:
-- 1. complete_feed_sync_success was not updating feeds.last_fetched_at
-- 2. recommended_feeds did not have default_priority set for news sources

-- Step 1: Add missing columns if they don't exist
DO $$
BEGIN
  -- Add default_priority to recommended_feeds
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recommended_feeds' AND column_name = 'default_priority'
  ) THEN
    ALTER TABLE recommended_feeds ADD COLUMN default_priority TEXT DEFAULT 'medium';
  END IF;
  
  -- Add sync_priority to feeds
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feeds' AND column_name = 'sync_priority'
  ) THEN
    ALTER TABLE feeds ADD COLUMN sync_priority TEXT DEFAULT 'medium';
  END IF;
  
  -- Add sync_interval_hours to feeds
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feeds' AND column_name = 'sync_interval_hours'
  ) THEN
    ALTER TABLE feeds ADD COLUMN sync_interval_hours INTEGER DEFAULT 24;
  END IF;
  
  -- Add next_sync_at to feeds
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feeds' AND column_name = 'next_sync_at'
  ) THEN
    ALTER TABLE feeds ADD COLUMN next_sync_at TIMESTAMPTZ;
  END IF;
END $$;

-- Fix the complete_feed_sync_success function to also update feeds.last_fetched_at
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
DECLARE
  v_feed_id UUID;
BEGIN
  -- Update the sync log entry and get the feed_id
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
  WHERE id = p_sync_log_id
  RETURNING feed_id INTO v_feed_id;
  
  -- Also update the feed's last_fetched_at timestamp and caching headers
  IF v_feed_id IS NOT NULL THEN
    UPDATE feeds 
    SET 
      last_fetched_at = NOW(),
      etag = COALESCE(p_etag_received, etag),
      last_modified = COALESCE(p_last_modified_received, last_modified),
      article_count = article_count + p_articles_new,
      updated_at = NOW()
    WHERE id = v_feed_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set default_priority for recommended_feeds based on article_frequency
-- High priority (hourly sync): Breaking news sources
-- Medium priority (daily sync): Regular news and content
-- Low priority (weekly sync): Infrequent publishers

-- High priority for major news sources (hourly updates)
UPDATE recommended_feeds 
SET default_priority = 'high'
WHERE url ILIKE '%bbc%' 
   OR url ILIKE '%reuters%' 
   OR url ILIKE '%apnews%'
   OR url ILIKE '%cnn%'
   OR url ILIKE '%nytimes%'
   OR url ILIKE '%washingtonpost%'
   OR url ILIKE '%theguardian%'
   OR article_frequency = 'hourly';

-- Low priority for weekly/infrequent sources
UPDATE recommended_feeds 
SET default_priority = 'low'
WHERE article_frequency = 'weekly';

-- Medium priority for everything else (daily)
UPDATE recommended_feeds 
SET default_priority = 'medium'
WHERE default_priority IS NULL OR default_priority = '';

-- Update existing user feeds to inherit priority from their source
-- This updates feeds that were subscribed before priority was properly set
UPDATE feeds f
SET 
  priority = COALESCE(
    (SELECT rf.default_priority FROM recommended_feeds rf WHERE rf.url = f.url),
    CASE 
      WHEN f.url ILIKE '%bbc%' OR f.url ILIKE '%reuters%' OR f.url ILIKE '%apnews%' 
           OR f.url ILIKE '%cnn%' OR f.url ILIKE '%nytimes%' THEN 'high'
      ELSE 'medium'
    END
  )::feed_priority,
  sync_priority = COALESCE(
    (SELECT rf.default_priority FROM recommended_feeds rf WHERE rf.url = f.url),
    CASE 
      WHEN f.url ILIKE '%bbc%' OR f.url ILIKE '%reuters%' OR f.url ILIKE '%apnews%' 
           OR f.url ILIKE '%cnn%' OR f.url ILIKE '%nytimes%' THEN 'high'
      ELSE 'medium'
    END
  ),
  sync_interval_hours = CASE 
    WHEN COALESCE(
      (SELECT rf.default_priority FROM recommended_feeds rf WHERE rf.url = f.url),
      CASE 
        WHEN f.url ILIKE '%bbc%' OR f.url ILIKE '%reuters%' OR f.url ILIKE '%apnews%' 
             OR f.url ILIKE '%cnn%' OR f.url ILIKE '%nytimes%' THEN 'high'
        ELSE 'medium'
      END
    ) = 'high' THEN 1
    WHEN COALESCE(
      (SELECT rf.default_priority FROM recommended_feeds rf WHERE rf.url = f.url),
      'medium'
    ) = 'low' THEN 168
    ELSE 24
  END
WHERE priority = 'medium';

-- Backfill last_fetched_at from feed_sync_log for feeds that have been synced
-- This fixes the "Never synced" display for feeds that have actually been synced
UPDATE feeds f
SET last_fetched_at = (
  SELECT MAX(fsl.sync_completed_at)
  FROM feed_sync_log fsl
  WHERE fsl.feed_id = f.id
    AND fsl.status = 'success'
)
WHERE f.last_fetched_at IS NULL
  AND EXISTS (
    SELECT 1 FROM feed_sync_log fsl 
    WHERE fsl.feed_id = f.id AND fsl.status = 'success'
  );

-- Log the changes
DO $$
DECLARE
  high_count INTEGER;
  medium_count INTEGER;
  low_count INTEGER;
  synced_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO high_count FROM recommended_feeds WHERE default_priority = 'high';
  SELECT COUNT(*) INTO medium_count FROM recommended_feeds WHERE default_priority = 'medium';
  SELECT COUNT(*) INTO low_count FROM recommended_feeds WHERE default_priority = 'low';
  SELECT COUNT(*) INTO synced_count FROM feeds WHERE last_fetched_at IS NOT NULL;
  
  RAISE NOTICE 'Priority distribution - High: %, Medium: %, Low: %', high_count, medium_count, low_count;
  RAISE NOTICE 'Feeds with last_fetched_at populated: %', synced_count;
END $$;
