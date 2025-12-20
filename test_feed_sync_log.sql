-- Test feed_sync_log table and automatic cleanup
-- This script tests the feed sync logging functionality

-- Create a test user and profile
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  crypt('password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Create a test feed
INSERT INTO feeds (id, user_id, name, url, status)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Test Feed',
  'https://example.com/feed.xml',
  'active'
);

-- Test 1: Insert 105 sync logs to test automatic cleanup (should keep only last 100)
DO $$
DECLARE
  i INTEGER;
  feed_uuid UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  FOR i IN 1..105 LOOP
    INSERT INTO feed_sync_log (
      feed_id,
      sync_started_at,
      sync_completed_at,
      status,
      http_status_code,
      articles_found,
      articles_new,
      sync_duration_ms
    ) VALUES (
      feed_uuid,
      NOW() - (i || ' minutes')::INTERVAL,
      NOW() - (i || ' minutes')::INTERVAL + '30 seconds'::INTERVAL,
      CASE WHEN i % 10 = 0 THEN 'error' ELSE 'success' END,
      CASE WHEN i % 10 = 0 THEN 500 ELSE 200 END,
      100 + i,
      i,
      30000 + (i * 100)
    );
  END LOOP;
END $$;

-- Verify that only 100 logs remain
SELECT 
  COUNT(*) as total_logs,
  COUNT(*) = 100 as cleanup_working
FROM feed_sync_log
WHERE feed_id = '00000000-0000-0000-0000-000000000002';

-- Test 2: Verify utility functions work
-- Test start_feed_sync function
SELECT start_feed_sync('00000000-0000-0000-0000-000000000002') as new_sync_log_id;

-- Test get_feed_sync_stats function
SELECT * FROM get_feed_sync_stats('00000000-0000-0000-0000-000000000002');

-- Test get_recent_sync_logs function
SELECT 
  id,
  status,
  http_status_code,
  articles_found,
  articles_new,
  sync_duration_ms
FROM get_recent_sync_logs('00000000-0000-0000-0000-000000000002', 5);

-- Test 3: Verify sync duration is calculated automatically
DO $$
DECLARE
  sync_id UUID;
BEGIN
  -- Start a sync
  sync_id := start_feed_sync('00000000-0000-0000-0000-000000000002');
  
  -- Complete it with success
  PERFORM complete_feed_sync_success(
    sync_id,
    200,
    150,
    10,
    5,
    'etag-12345',
    'Mon, 01 Jan 2024 00:00:00 GMT',
    50000
  );
  
  -- Check that duration was calculated
  RAISE NOTICE 'Sync duration calculated: %', (
    SELECT sync_duration_ms IS NOT NULL 
    FROM feed_sync_log 
    WHERE id = sync_id
  );
END $$;

-- Test 4: Verify error logging works
DO $$
DECLARE
  sync_id UUID;
BEGIN
  -- Start a sync
  sync_id := start_feed_sync('00000000-0000-0000-0000-000000000002');
  
  -- Complete it with error
  PERFORM complete_feed_sync_error(
    sync_id,
    'Connection timeout',
    504
  );
  
  -- Check that error was logged
  RAISE NOTICE 'Error logged: %', (
    SELECT error_message 
    FROM feed_sync_log 
    WHERE id = sync_id
  );
END $$;

-- Final verification: Check that we still have exactly 100 logs after all operations
SELECT 
  COUNT(*) as final_log_count,
  COUNT(*) = 100 as cleanup_still_working,
  COUNT(*) FILTER (WHERE status = 'success') as successful_syncs,
  COUNT(*) FILTER (WHERE status = 'error') as failed_syncs,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_syncs
FROM feed_sync_log
WHERE feed_id = '00000000-0000-0000-0000-000000000002';

-- Show comprehensive stats
SELECT * FROM get_feed_sync_stats('00000000-0000-0000-0000-000000000002');

ROLLBACK;
