-- Test database optimization and constraints
-- This file tests the performance indexes and constraints created in task 10

-- Test 1: Verify constraint validation function works
SELECT 'Testing constraint validation function...' as test_name;
SELECT table_name, constraint_type, COUNT(*) as constraint_count
FROM verify_database_constraints()
GROUP BY table_name, constraint_type
ORDER BY table_name, constraint_type;

-- Test 2: Verify foreign key constraints are working
SELECT 'Testing foreign key constraints...' as test_name;
SELECT 
    tc.table_name,
    kcu.column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Test 3: Verify unique constraints are in place
SELECT 'Testing unique constraints...' as test_name;
SELECT 
    tc.table_name,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Test 4: Verify performance indexes exist
SELECT 'Testing performance indexes...' as test_name;
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Test 5: Test email validation function
SELECT 'Testing email validation...' as test_name;
SELECT 
    email,
    validate_email_format(email) as is_valid
FROM (VALUES 
    ('test@example.com'),
    ('invalid-email'),
    ('user.name+tag@domain.co.uk'),
    (''),
    ('test@'),
    ('@domain.com')
) AS test_emails(email);

-- Test 6: Test URL validation function
SELECT 'Testing URL validation...' as test_name;
SELECT 
    url,
    validate_url_format(url) as is_valid
FROM (VALUES 
    ('https://example.com'),
    ('http://test.org/path'),
    ('invalid-url'),
    ('ftp://example.com'),
    ('https://'),
    ('')
) AS test_urls(url);

-- Test 7: Test timezone validation function
SELECT 'Testing timezone validation...' as test_name;
SELECT 
    tz,
    validate_timezone(tz) as is_valid
FROM (VALUES 
    ('America/New_York'),
    ('Europe/London'),
    ('UTC'),
    ('Invalid/Timezone'),
    (''),
    (NULL)
) AS test_timezones(tz);

-- Test 8: Verify enum constraints
SELECT 'Testing enum constraints...' as test_name;
SELECT 
    typname as enum_name,
    ARRAY_AGG(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('feed_status', 'feed_priority')
GROUP BY typname
ORDER BY typname;

-- Test 9: Check index usage statistics (if any data exists)
SELECT 'Checking index statistics...' as test_name;
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname
LIMIT 10;

-- Test 10: Verify RLS policies are enabled
SELECT 'Testing RLS policies...' as test_name;
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN (
    'profiles', 'user_settings', 'user_interests', 'folders', 'feeds', 
    'articles', 'user_articles', 'clusters', 'ai_usage', 'digest_history', 
    'feed_sync_log', 'recommended_feeds'
)
ORDER BY tablename;

-- Test 11: Check table sizes and row counts (should be empty for new database)
SELECT 'Checking table statistics...' as test_name;
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename) as column_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Test 12: Verify views are accessible
SELECT 'Testing database views...' as test_name;
SELECT 
    table_name as view_name,
    is_updatable
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT 'Database optimization tests completed successfully!' as result;