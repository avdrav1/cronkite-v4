-- Verify RLS is enabled on all user-specific tables
-- Requirements: 13.1

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✓ ENABLED'
        ELSE '✗ DISABLED'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles',
    'user_settings', 
    'user_interests',
    'folders',
    'feeds',
    'articles',
    'user_articles',
    'clusters',
    'ai_usage',
    'digest_history',
    'feed_sync_log',
    'recommended_feeds'
)
ORDER BY tablename;

-- Also check if there are any policies defined
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
AND tablename IN (
    'profiles',
    'user_settings', 
    'user_interests',
    'folders',
    'feeds',
    'articles',
    'user_articles',
    'clusters',
    'ai_usage',
    'digest_history',
    'feed_sync_log',
    'recommended_feeds'
)
ORDER BY tablename, policyname;