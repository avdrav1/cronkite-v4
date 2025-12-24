# Feed Sync and Priority Fix

## Issues Fixed

### 1. "Never synced" Display Issue
All feeds were showing "Never synced" in the settings page even though they had been synced. This was because the `complete_feed_sync_success` database function was only updating the `feed_sync_log` table but NOT updating the `feeds.last_fetched_at` field.

### 2. All Feeds Showing "Medium" Priority
All feeds were displaying "Medium" priority instead of appropriate priorities based on their source type:
- **High priority** (hourly sync): Breaking news sources like BBC, Reuters, AP, CNN, NYT
- **Medium priority** (daily sync): Regular content sources
- **Low priority** (weekly sync): Infrequent publishers like Nature, Stack Overflow Blog

## How to Apply the Fix

### Option 1: Run the Migration Script
```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npx tsx scripts/apply-feed-sync-fix.ts
```

### Option 2: Run SQL Directly in Supabase Dashboard

Go to your Supabase Dashboard → SQL Editor and run the contents of:
`supabase/migrations/20240119000000_fix_feed_sync_and_priority.sql`

## Quick SQL Fix (Copy & Paste)

```sql
-- 1. Fix the complete_feed_sync_success function to update feeds.last_fetched_at
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

-- 2. Set high priority for major news sources
UPDATE recommended_feeds 
SET default_priority = 'high'
WHERE url ILIKE '%bbc%' 
   OR url ILIKE '%reuters%' 
   OR url ILIKE '%apnews%'
   OR url ILIKE '%cnn%'
   OR url ILIKE '%nytimes%'
   OR url ILIKE '%washingtonpost%'
   OR url ILIKE '%theguardian%'
   OR url ILIKE '%wsj%'
   OR url ILIKE '%bloomberg%'
   OR url ILIKE '%espn%'
   OR article_frequency = 'hourly';

-- 3. Set low priority for weekly sources
UPDATE recommended_feeds 
SET default_priority = 'low'
WHERE article_frequency = 'weekly';

-- 4. Set medium priority for everything else
UPDATE recommended_feeds 
SET default_priority = 'medium'
WHERE default_priority IS NULL OR default_priority = '';

-- 5. Update existing user feeds with proper priorities
UPDATE feeds f
SET 
  priority = CASE 
    WHEN f.url ILIKE '%bbc%' OR f.url ILIKE '%reuters%' OR f.url ILIKE '%apnews%' 
         OR f.url ILIKE '%cnn%' OR f.url ILIKE '%nytimes%' OR f.url ILIKE '%wsj%'
         OR f.url ILIKE '%bloomberg%' OR f.url ILIKE '%espn%' THEN 'high'::feed_priority
    ELSE 'medium'::feed_priority
  END,
  sync_priority = CASE 
    WHEN f.url ILIKE '%bbc%' OR f.url ILIKE '%reuters%' OR f.url ILIKE '%apnews%' 
         OR f.url ILIKE '%cnn%' OR f.url ILIKE '%nytimes%' OR f.url ILIKE '%wsj%'
         OR f.url ILIKE '%bloomberg%' OR f.url ILIKE '%espn%' THEN 'high'
    ELSE 'medium'
  END,
  sync_interval_hours = CASE 
    WHEN f.url ILIKE '%bbc%' OR f.url ILIKE '%reuters%' OR f.url ILIKE '%apnews%' 
         OR f.url ILIKE '%cnn%' OR f.url ILIKE '%nytimes%' OR f.url ILIKE '%wsj%'
         OR f.url ILIKE '%bloomberg%' OR f.url ILIKE '%espn%' THEN 1
    ELSE 24
  END
WHERE priority = 'medium';

-- 6. Backfill last_fetched_at from feed_sync_log
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

-- 7. Verify the fix
SELECT 
  'Feeds by priority' as metric,
  priority,
  COUNT(*) as count
FROM feeds
GROUP BY priority
UNION ALL
SELECT 
  'Feeds with last_fetched_at' as metric,
  'synced' as priority,
  COUNT(*) as count
FROM feeds
WHERE last_fetched_at IS NOT NULL;
```

## Expected Results After Fix

- News feeds (BBC, Reuters, AP, etc.) should show **High** priority with "Syncs every: 1 hour"
- Regular content feeds should show **Medium** priority with "Syncs every: 24 hours"
- Infrequent feeds should show **Low** priority with "Syncs every: 7 days"
- Feeds that have been synced should show "Last sync: X minutes/hours ago" instead of "Never"
