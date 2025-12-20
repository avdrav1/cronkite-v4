-- Test RLS policies to ensure they work correctly
-- This script tests the comprehensive RLS policies

-- Test 1: Verify RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 'user_settings', 'user_interests', 'folders', 'feeds', 
    'articles', 'user_articles', 'clusters', 'ai_usage', 'digest_history', 
    'feed_sync_log', 'recommended_feeds'
  )
ORDER BY tablename;

-- Test 2: List all RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test 3: Verify helper functions exist
SELECT 
  proname,
  pronargs,
  prorettype::regtype
FROM pg_proc 
WHERE proname IN (
  'verify_user_owns_resource',
  'user_can_access_article', 
  'user_can_access_cluster'
)
ORDER BY proname;

-- Test 4: Check that recommended_feeds allows public access
-- This should work without authentication
SELECT COUNT(*) as recommended_feeds_count FROM recommended_feeds LIMIT 1;

-- Test 5: Verify indexes for RLS performance exist
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE '%_rls'
ORDER BY tablename, indexname;