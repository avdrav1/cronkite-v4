-- Debug query to find why CNN and NPR don't have last_fetched_at

-- 1. Check feeds that have articles but no last_fetched_at
SELECT 
  f.id,
  f.name,
  f.url,
  f.article_count,
  f.last_fetched_at,
  f.status
FROM feeds f
WHERE f.article_count > 0 
  AND f.last_fetched_at IS NULL
ORDER BY f.name;

-- 2. Check feed_sync_log entries for these feeds
SELECT 
  f.name,
  fsl.status,
  fsl.sync_started_at,
  fsl.sync_completed_at,
  fsl.error_message,
  fsl.articles_found,
  fsl.articles_new
FROM feeds f
LEFT JOIN feed_sync_log fsl ON fsl.feed_id = f.id
WHERE f.name ILIKE '%cnn%' OR f.name ILIKE '%npr%'
ORDER BY f.name, fsl.sync_started_at DESC
LIMIT 20;

-- 3. Alternative: Backfill last_fetched_at from articles table
-- If sync_log doesn't have entries, we can use the latest article fetch time
UPDATE feeds f
SET last_fetched_at = (
  SELECT MAX(a.fetched_at)
  FROM articles a
  WHERE a.feed_id = f.id
)
WHERE f.last_fetched_at IS NULL
  AND f.article_count > 0
  AND EXISTS (
    SELECT 1 FROM articles a WHERE a.feed_id = f.id
  );

-- 4. Verify the fix
SELECT 
  name,
  article_count,
  last_fetched_at
FROM feeds
WHERE name ILIKE '%cnn%' OR name ILIKE '%npr%';
