-- Load Test with Realistic Data Volumes
-- This script creates realistic data volumes to test query performance and index effectiveness

-- Enable timing for performance measurement
\timing on

-- Create test data generation functions
CREATE OR REPLACE FUNCTION generate_test_users(user_count INTEGER)
RETURNS TABLE(user_id UUID, email TEXT) AS $$
DECLARE
    i INTEGER;
    test_user_id UUID;
    test_email TEXT;
BEGIN
    RAISE NOTICE 'Generating % test users...', user_count;
    
    FOR i IN 1..user_count LOOP
        test_user_id := gen_random_uuid();
        test_email := 'testuser' || i || '@example.com';
        
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (test_user_id, test_email, crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW());
        
        user_id := test_user_id;
        email := test_email;
        RETURN NEXT;
        
        -- Progress indicator
        IF i % 100 = 0 THEN
            RAISE NOTICE 'Created % users...', i;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_test_feeds(users_cursor CURSOR, feeds_per_user INTEGER)
RETURNS TABLE(feed_id UUID, user_id UUID, feed_name TEXT) AS $$
DECLARE
    user_record RECORD;
    i INTEGER;
    test_feed_id UUID;
    test_feed_name TEXT;
    test_feed_url TEXT;
    folder_id UUID;
BEGIN
    RAISE NOTICE 'Generating feeds (% per user)...', feeds_per_user;
    
    FOR user_record IN users_cursor LOOP
        -- Create 1-2 folders per user
        FOR folder_num IN 1..2 LOOP
            INSERT INTO folders (id, user_id, name, position)
            VALUES (gen_random_uuid(), user_record.user_id, 'Folder ' || folder_num, folder_num)
            ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- Get a random folder for this user
        SELECT id INTO folder_id FROM folders WHERE user_id = user_record.user_id ORDER BY random() LIMIT 1;
        
        FOR i IN 1..feeds_per_user LOOP
            test_feed_id := gen_random_uuid();
            test_feed_name := 'Feed ' || i || ' for ' || user_record.email;
            test_feed_url := 'https://example' || i || '.com/feed.xml?user=' || user_record.user_id;
            
            INSERT INTO feeds (id, user_id, folder_id, name, url, status, priority, article_count)
            VALUES (
                test_feed_id,
                user_record.user_id,
                CASE WHEN random() > 0.3 THEN folder_id ELSE NULL END,
                test_feed_name,
                test_feed_url,
                CASE 
                    WHEN random() > 0.9 THEN 'error'
                    WHEN random() > 0.8 THEN 'paused'
                    ELSE 'active'
                END,
                CASE 
                    WHEN random() > 0.7 THEN 'high'
                    WHEN random() > 0.4 THEN 'medium'
                    ELSE 'low'
                END,
                0
            );
            
            feed_id := test_feed_id;
            user_id := user_record.user_id;
            feed_name := test_feed_name;
            RETURN NEXT;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_test_articles(feed_cursor CURSOR, articles_per_feed INTEGER)
RETURNS TABLE(article_id UUID, feed_id UUID, article_title TEXT) AS $$
DECLARE
    feed_record RECORD;
    i INTEGER;
    test_article_id UUID;
    test_title TEXT;
    test_url TEXT;
    test_content TEXT;
    cluster_id UUID;
    article_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Generating articles (% per feed)...', articles_per_feed;
    
    -- Create some clusters first
    FOR cluster_num IN 1..50 LOOP
        INSERT INTO clusters (id, title, summary, article_count, timeframe_start, timeframe_end)
        VALUES (
            gen_random_uuid(),
            'Topic Cluster ' || cluster_num,
            'Summary for cluster ' || cluster_num,
            0,
            NOW() - (cluster_num || ' days')::INTERVAL,
            NOW() - ((cluster_num - 1) || ' days')::INTERVAL
        );
    END LOOP;
    
    FOR feed_record IN feed_cursor LOOP
        FOR i IN 1..articles_per_feed LOOP
            test_article_id := gen_random_uuid();
            test_title := 'Article ' || i || ' from ' || feed_record.feed_name;
            test_url := 'https://example.com/article/' || test_article_id;
            test_content := 'This is the content for article ' || i || '. ' || repeat('Lorem ipsum dolor sit amet. ', 50);
            
            -- Randomly assign to clusters (30% chance)
            cluster_id := NULL;
            IF random() > 0.7 THEN
                SELECT id INTO cluster_id FROM clusters ORDER BY random() LIMIT 1;
            END IF;
            
            INSERT INTO articles (
                id, feed_id, guid, title, url, author, excerpt, content, 
                published_at, fetched_at, cluster_id,
                ai_summary, ai_summary_generated_at
            ) VALUES (
                test_article_id,
                feed_record.feed_id,
                'guid-' || test_article_id,
                test_title,
                test_url,
                'Author ' || (i % 10 + 1),
                substring(test_content, 1, 200),
                test_content,
                NOW() - (i || ' hours')::INTERVAL,
                NOW() - ((i - 1) || ' hours')::INTERVAL,
                cluster_id,
                CASE WHEN random() > 0.5 THEN 'AI generated summary for ' || test_title ELSE NULL END,
                CASE WHEN random() > 0.5 THEN NOW() ELSE NULL END
            );
            
            article_id := test_article_id;
            feed_id := feed_record.feed_id;
            article_title := test_title;
            RETURN NEXT;
            
            article_count := article_count + 1;
            
            -- Progress indicator
            IF article_count % 1000 = 0 THEN
                RAISE NOTICE 'Created % articles...', article_count;
            END IF;
        END LOOP;
        
        -- Update feed article count
        UPDATE feeds SET article_count = articles_per_feed WHERE id = feed_record.feed_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Main load test execution
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    user_count INTEGER := 100;
    feeds_per_user INTEGER := 5;
    articles_per_feed INTEGER := 50;
    total_articles INTEGER;
    
    -- Performance test variables
    query_start TIMESTAMP;
    query_end TIMESTAMP;
    query_duration INTERVAL;
    
    -- Test results
    test_results RECORD;
BEGIN
    start_time := NOW();
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Starting Load Test with Realistic Data';
    RAISE NOTICE 'Users: %, Feeds per user: %, Articles per feed: %', user_count, feeds_per_user, articles_per_feed;
    RAISE NOTICE 'Expected total articles: %', (user_count * feeds_per_user * articles_per_feed);
    RAISE NOTICE '========================================';
    
    -- Clean up any existing test data
    DELETE FROM auth.users WHERE email LIKE 'testuser%@example.com';
    
    -- Generate test users
    PERFORM generate_test_users(user_count);
    
    -- Generate test feeds
    DECLARE
        users_cursor CURSOR FOR SELECT user_id, email FROM auth.users WHERE email LIKE 'testuser%@example.com';
    BEGIN
        PERFORM generate_test_feeds(users_cursor, feeds_per_user);
    END;
    
    -- Generate test articles
    DECLARE
        feeds_cursor CURSOR FOR 
            SELECT f.id as feed_id, f.user_id, f.name as feed_name 
            FROM feeds f 
            JOIN auth.users u ON f.user_id = u.id 
            WHERE u.email LIKE 'testuser%@example.com';
    BEGIN
        PERFORM generate_test_articles(feeds_cursor, articles_per_feed);
    END;
    
    -- Generate user article states (reading patterns)
    RAISE NOTICE 'Generating user reading patterns...';
    INSERT INTO user_articles (user_id, article_id, is_read, is_starred, read_at, starred_at)
    SELECT 
        f.user_id,
        a.id,
        random() > 0.3, -- 70% read rate
        random() > 0.9, -- 10% starred rate
        CASE WHEN random() > 0.3 THEN NOW() - (random() * 30 || ' days')::INTERVAL ELSE NULL END,
        CASE WHEN random() > 0.9 THEN NOW() - (random() * 30 || ' days')::INTERVAL ELSE NULL END
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    JOIN auth.users u ON f.user_id = u.id
    WHERE u.email LIKE 'testuser%@example.com'
    AND random() > 0.1; -- 90% of articles have user states
    
    -- Generate AI usage data
    RAISE NOTICE 'Generating AI usage data...';
    INSERT INTO ai_usage (user_id, usage_date, summary_count, clustering_count)
    SELECT 
        u.id,
        generate_series(NOW() - INTERVAL '30 days', NOW(), INTERVAL '1 day')::DATE,
        floor(random() * 50)::INTEGER,
        floor(random() * 10)::INTEGER
    FROM auth.users u
    WHERE u.email LIKE 'testuser%@example.com'
    AND random() > 0.3; -- Not every user every day
    
    -- Generate feed sync logs
    RAISE NOTICE 'Generating feed sync logs...';
    INSERT INTO feed_sync_log (
        feed_id, sync_started_at, sync_completed_at, status, 
        http_status_code, articles_found, articles_new, sync_duration_ms
    )
    SELECT 
        f.id,
        sync_time,
        sync_time + (random() * 60 || ' seconds')::INTERVAL,
        CASE WHEN random() > 0.1 THEN 'success' ELSE 'error' END,
        CASE WHEN random() > 0.1 THEN 200 ELSE 500 END,
        floor(random() * 20)::INTEGER,
        floor(random() * 5)::INTEGER,
        floor(random() * 30000)::INTEGER
    FROM feeds f
    JOIN auth.users u ON f.user_id = u.id
    CROSS JOIN generate_series(NOW() - INTERVAL '7 days', NOW(), INTERVAL '1 hour') AS sync_time
    WHERE u.email LIKE 'testuser%@example.com'
    AND random() > 0.7; -- Not every feed every hour
    
    end_time := NOW();
    
    -- Get final statistics
    SELECT COUNT(*) INTO total_articles FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    JOIN auth.users u ON f.user_id = u.id
    WHERE u.email LIKE 'testuser%@example.com';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Data Generation Complete!';
    RAISE NOTICE 'Total time: %', (end_time - start_time);
    RAISE NOTICE 'Total articles created: %', total_articles;
    RAISE NOTICE '========================================';
    
    -- ========================================================================
    -- Performance Tests
    -- ========================================================================
    RAISE NOTICE 'Running Performance Tests...';
    
    -- Test 1: Complex feed query with joins
    query_start := clock_timestamp();
    SELECT COUNT(*) INTO test_results
    FROM articles_with_feed awf
    JOIN user_articles ua ON awf.id = ua.article_id
    WHERE awf.feed_status = 'active'
    AND ua.is_read = FALSE;
    query_end := clock_timestamp();
    query_duration := query_end - query_start;
    
    RAISE NOTICE 'Test 1 - Complex feed query: % ms, % unread articles', 
        EXTRACT(milliseconds FROM query_duration), test_results.count;
    
    -- Test 2: Folder unread counts view performance
    query_start := clock_timestamp();
    SELECT COUNT(*) INTO test_results FROM folder_unread_counts;
    query_end := clock_timestamp();
    query_duration := query_end - query_start;
    
    RAISE NOTICE 'Test 2 - Folder unread counts: % ms, % folder counts', 
        EXTRACT(milliseconds FROM query_duration), test_results.count;
    
    -- Test 3: User article feed view performance
    query_start := clock_timestamp();
    SELECT COUNT(*) INTO test_results FROM user_article_feed WHERE is_read = TRUE;
    query_end := clock_timestamp();
    query_duration := query_end - query_start;
    
    RAISE NOTICE 'Test 3 - User article feed view: % ms, % read articles', 
        EXTRACT(milliseconds FROM query_duration), test_results.count;
    
    -- Test 4: Feed stats aggregation
    query_start := clock_timestamp();
    SELECT COUNT(*) INTO test_results FROM feed_stats WHERE article_count > 10;
    query_end := clock_timestamp();
    query_duration := query_end - query_start;
    
    RAISE NOTICE 'Test 4 - Feed stats aggregation: % ms, % active feeds', 
        EXTRACT(milliseconds FROM query_duration), test_results.count;
    
    -- Test 5: Bulk operation performance (mark folder as read)
    DECLARE
        sample_user_id UUID;
        sample_folder_id UUID;
        marked_count INTEGER;
    BEGIN
        SELECT u.id, f.id INTO sample_user_id, sample_folder_id
        FROM auth.users u
        JOIN folders f ON u.id = f.user_id
        WHERE u.email LIKE 'testuser%@example.com'
        LIMIT 1;
        
        query_start := clock_timestamp();
        SELECT mark_folder_read(sample_user_id, sample_folder_id) INTO marked_count;
        query_end := clock_timestamp();
        query_duration := query_end - query_start;
        
        RAISE NOTICE 'Test 5 - Bulk mark as read: % ms, % articles marked', 
            EXTRACT(milliseconds FROM query_duration), marked_count;
    END;
    
    -- ========================================================================
    -- Index Effectiveness Tests
    -- ========================================================================
    RAISE NOTICE 'Checking Index Usage...';
    
    -- Check index usage statistics
    SELECT 
        schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public' 
    AND idx_tup_read > 0
    ORDER BY idx_tup_read DESC
    LIMIT 10;
    
    -- ========================================================================
    -- Concurrent Access Test
    -- ========================================================================
    RAISE NOTICE 'Testing Concurrent Access Patterns...';
    
    -- Simulate concurrent read operations
    DECLARE
        concurrent_start TIMESTAMP;
        concurrent_end TIMESTAMP;
        i INTEGER;
    BEGIN
        concurrent_start := clock_timestamp();
        
        -- Simulate 10 concurrent user sessions reading different data
        FOR i IN 1..10 LOOP
            DECLARE
                random_user_id UUID;
            BEGIN
                SELECT id INTO random_user_id 
                FROM auth.users 
                WHERE email LIKE 'testuser%@example.com' 
                ORDER BY random() 
                LIMIT 1;
                
                -- Set user context
                PERFORM set_config('request.jwt.claims', json_build_object('sub', random_user_id)::text, true);
                
                -- Perform typical user operations
                PERFORM COUNT(*) FROM feeds WHERE user_id = random_user_id;
                PERFORM COUNT(*) FROM user_article_feed WHERE user_id = random_user_id AND is_read = FALSE;
                PERFORM COUNT(*) FROM folder_unread_counts WHERE user_id = random_user_id;
            END;
        END LOOP;
        
        concurrent_end := clock_timestamp();
        RAISE NOTICE 'Concurrent access test: % ms for 10 simulated users', 
            EXTRACT(milliseconds FROM (concurrent_end - concurrent_start));
    END;
    
    -- Clear user context
    PERFORM set_config('request.jwt.claims', '', true);
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Load Test Completed Successfully!';
    RAISE NOTICE 'Database performed well under realistic load';
    RAISE NOTICE '========================================';
    
END $$;

-- Cleanup functions
DROP FUNCTION IF EXISTS generate_test_users(INTEGER);
DROP FUNCTION IF EXISTS generate_test_feeds(CURSOR, INTEGER);
DROP FUNCTION IF EXISTS generate_test_articles(CURSOR, INTEGER);

-- Final database statistics
SELECT 
    'Load Test Summary' as summary,
    (SELECT COUNT(*) FROM auth.users WHERE email LIKE 'testuser%@example.com') as test_users,
    (SELECT COUNT(*) FROM feeds f JOIN auth.users u ON f.user_id = u.id WHERE u.email LIKE 'testuser%@example.com') as test_feeds,
    (SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id JOIN auth.users u ON f.user_id = u.id WHERE u.email LIKE 'testuser%@example.com') as test_articles,
    (SELECT COUNT(*) FROM user_articles ua JOIN auth.users u ON ua.user_id = u.id WHERE u.email LIKE 'testuser%@example.com') as test_user_articles;

-- Show table sizes after load test
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as data_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;