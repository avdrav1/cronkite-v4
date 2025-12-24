-- Investigate why CNN and NPR don't have last_fetched_at

-- 1. Check feeds with articles but no last_fetched_at
SELECT 
  f.id,
  f.name,
  f.url,
  f.article_count,
  f.last_fetched_at,
  f.created_at
FROM feeds f
WHERE f.last_fetched_at IS NULL
  AND f.article_count > 0
ORDER BY f.article_count DESC;

-- 2. Check if there are sync logs for these feeds
SELECT 
  f.name,
  f.url,
  COUNT(fsl.id) as sync_log_count,
  MAX(fsl.sync_completed_at) as last_sync_completed,
  MAX(CASE WHEN fsl.status = 'success' THEN fsl.sync_completed_at END) as last_successful_sync
FROM feeds f
LEFT JOIN feed_sync_log fsl ON fsl.feed_id = f.id
WHERE f.last_fetched_at IS NULL
  AND f.article_count > 0
GROUP BY f.id, f.name, f.url;

-- 3. FIX: Update last_fetched_at for feeds that have articles but no sync timestamp
-- Use the latest article's fetched_at as a fallback
UPDATE feeds f
SET last_fetched_at = (
  SELECT MAX(a.fetched_at)
  FROM articles a
  WHERE a.feed_id = f.id
)
WHERE f.last_fetched_at IS NULL
  AND f.article_count > 0
  AND EXISTS (SELECT 1 FROM articles a WHERE a.feed_id = f.id);

-- 4. Verify the fix
SELECT 
  name,
  url,
  article_count,
  last_fetched_at
FROM feeds
WHERE url ILIKE '%cnn%' OR url ILIKE '%npr%';
