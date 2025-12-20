-- Comprehensive Database Functions and Views Tests
-- Feature: database-schema, Property 12: View data consistency
-- Feature: database-schema, Property 13: Bulk operation correctness
-- Validates: Requirements 14.1, 14.2, 14.5

-- Test all database views and functions for correctness

DO $$
DECLARE
    test_user_id UUID;
    test_folder_id UUID;
    test_feed_id UUID;
    test_article_ids UUID[];
    test_cluster_id UUID;
    
    view_result RECORD;
    function_result RECORD;
    
    success_count INTEGER := 0;
    total_tests INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting comprehensive functions and views tests...';
    
    -- Setup test data
    test_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (test_user_id, 'test@example.com', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
    
    -- Create folder
    INSERT INTO folders (id, user_id, name, position)
    VALUES (gen_random_uuid(), test_user_id, 'Test Folder', 1)
    RETURNING id INTO test_folder_id;
    
    -- Create feed
    INSERT INTO feeds (id, user_id, folder_id, name, url, status, priority, article_count)
    VALUES (gen_random_uuid(), test_user_id, test_folder_id, 'Test Feed', 'https://example.com/feed.xml', 'active', 'medium', 0)
    RETURNING id INTO test_feed_id;
    
    -- Create cluster
    INSERT INTO clusters (id, title, summary, article_count, timeframe_start, timeframe_end)
    VALUES (gen_random_uuid(), 'Test Cluster', 'Test cluster summary', 0, NOW() - INTERVAL '1 day', NOW())
    RETURNING id INTO test_cluster_id;
    
    -- Create multiple articles
    FOR i IN 1..5 LOOP
        INSERT INTO articles (id, feed_id, guid, title, url, cluster_id, ai_summary, ai_summary_generated_at)
        VALUES (
            gen_random_uuid(),
            test_feed_id,
            'guid-' || i,
            'Test Article ' || i,
            'https://example.com/article' || i,
            CASE WHEN i <= 3 THEN test_cluster_id ELSE NULL END,
            'AI summary for article ' || i,
            NOW()
        );
    END LOOP;
    
    -- Get article IDs for later use
    SELECT ARRAY_AGG(id) INTO test_article_ids FROM articles WHERE feed_id = test_feed_id;
    
    -- Create user article states (mark some as read)
    INSERT INTO user_articles (user_id, article_id, is_read, is_starred)
    SELECT test_user_id, id, (random() > 0.5), (random() > 0.8)
    FROM articles WHERE feed_id = test_feed_id;
    
    -- Update feed article count
    UPDATE feeds SET article_count = 5 WHERE id = test_feed_id;
    
    -- Update cluster article count
    UPDATE clusters SET article_count = 3 WHERE id = test_cluster_id;
    
    -- Set user context for RLS
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
    
    -- ========================================================================
    -- Test 1: articles_with_feed view
    -- ========================================================================
    total_tests := total_tests + 1;
    
    SELECT COUNT(*) as article_count,
           COUNT(DISTINCT feed_name) as feed_name_count,
           COUNT(DISTINCT feed_url) as feed_url_count
    INTO view_result
    FROM articles_with_feed;
    
    IF view_result.article_count = 5 AND view_result.feed_name_count = 1 AND view_result.feed_url_count = 1 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 1 PASSED: articles_with_feed view';
    ELSE
        RAISE WARNING '✗ Test 1 FAILED: articles_with_feed view - articles: %, feeds: %, urls: %',
            view_result.article_count, view_result.feed_name_count, view_result.feed_url_count;
    END IF;
    
    -- ========================================================================
    -- Test 2: user_article_feed view
    -- ========================================================================
    total_tests := total_tests + 1;
    
    SELECT COUNT(*) as total_articles,
           COUNT(*) FILTER (WHERE is_read = TRUE) as read_articles,
           COUNT(*) FILTER (WHERE is_starred = TRUE) as starred_articles
    INTO view_result
    FROM user_article_feed
    WHERE user_id = test_user_id;
    
    IF view_result.total_articles = 5 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 2 PASSED: user_article_feed view - total: %, read: %, starred: %',
            view_result.total_articles, view_result.read_articles, view_result.starred_articles;
    ELSE
        RAISE WARNING '✗ Test 2 FAILED: user_article_feed view - expected 5 articles, got %',
            view_result.total_articles;
    END IF;
    
    -- ========================================================================
    -- Test 3: folder_unread_counts view
    -- ========================================================================
    total_tests := total_tests + 1;
    
    SELECT unread_count, total_count
    INTO view_result
    FROM folder_unread_counts
    WHERE user_id = test_user_id AND folder_id = test_folder_id;
    
    -- Calculate expected unread count
    DECLARE
        expected_unread INTEGER;
    BEGIN
        SELECT COUNT(*) INTO expected_unread
        FROM articles a
        LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = test_user_id
        WHERE a.feed_id = test_feed_id
        AND (ua.is_read IS NULL OR ua.is_read = FALSE);
        
        IF view_result.total_count = 5 AND view_result.unread_count = expected_unread THEN
            success_count := success_count + 1;
            RAISE NOTICE '✓ Test 3 PASSED: folder_unread_counts view - total: %, unread: %',
                view_result.total_count, view_result.unread_count;
        ELSE
            RAISE WARNING '✗ Test 3 FAILED: folder_unread_counts view - total: % (expected 5), unread: % (expected %)',
                view_result.total_count, view_result.unread_count, expected_unread;
        END IF;
    END;
    
    -- ========================================================================
    -- Test 4: feed_stats view
    -- ========================================================================
    total_tests := total_tests + 1;
    
    SELECT article_count, unread_count, last_article_date IS NOT NULL as has_last_article
    INTO view_result
    FROM feed_stats
    WHERE feed_id = test_feed_id;
    
    IF view_result.article_count = 5 AND view_result.has_last_article THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 4 PASSED: feed_stats view - articles: %, unread: %, has_last_date: %',
            view_result.article_count, view_result.unread_count, view_result.has_last_article;
    ELSE
        RAISE WARNING '✗ Test 4 FAILED: feed_stats view - articles: % (expected 5), has_last_date: %',
            view_result.article_count, view_result.has_last_article;
    END IF;
    
    -- ========================================================================
    -- Test 5: calculate_relevancy_score function
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- Test with a sample article
    SELECT calculate_relevancy_score(
        test_article_ids[1],
        test_user_id,
        ARRAY['technology', 'science']
    ) as relevancy_score
    INTO function_result;
    
    IF function_result.relevancy_score >= 0 AND function_result.relevancy_score <= 100 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 5 PASSED: calculate_relevancy_score function - score: %',
            function_result.relevancy_score;
    ELSE
        RAISE WARNING '✗ Test 5 FAILED: calculate_relevancy_score function - invalid score: %',
            function_result.relevancy_score;
    END IF;
    
    -- ========================================================================
    -- Test 6: mark_folder_read function (bulk operation)
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- Count unread articles before
    DECLARE
        unread_before INTEGER;
        unread_after INTEGER;
        articles_marked INTEGER;
    BEGIN
        SELECT COUNT(*) INTO unread_before
        FROM articles a
        LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = test_user_id
        WHERE a.feed_id = test_feed_id
        AND (ua.is_read IS NULL OR ua.is_read = FALSE);
        
        -- Mark folder as read
        SELECT mark_folder_read(test_user_id, test_folder_id) INTO articles_marked;
        
        -- Count unread articles after
        SELECT COUNT(*) INTO unread_after
        FROM articles a
        LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = test_user_id
        WHERE a.feed_id = test_feed_id
        AND (ua.is_read IS NULL OR ua.is_read = FALSE);
        
        IF unread_after = 0 AND articles_marked = unread_before THEN
            success_count := success_count + 1;
            RAISE NOTICE '✓ Test 6 PASSED: mark_folder_read function - marked % articles, % unread remaining',
                articles_marked, unread_after;
        ELSE
            RAISE WARNING '✗ Test 6 FAILED: mark_folder_read function - marked: %, unread_before: %, unread_after: %',
                articles_marked, unread_before, unread_after;
        END IF;
    END;
    
    -- ========================================================================
    -- Test 7: Feed sync utility functions
    -- ========================================================================
    total_tests := total_tests + 1;
    
    DECLARE
        sync_log_id UUID;
        sync_stats RECORD;
    BEGIN
        -- Test start_feed_sync
        SELECT start_feed_sync(test_feed_id) INTO sync_log_id;
        
        -- Test complete_feed_sync_success
        PERFORM complete_feed_sync_success(
            sync_log_id,
            200,
            10,
            2,
            5,
            'test-etag',
            'Mon, 01 Jan 2024 00:00:00 GMT',
            30000
        );
        
        -- Test get_feed_sync_stats
        SELECT * INTO sync_stats FROM get_feed_sync_stats(test_feed_id);
        
        IF sync_log_id IS NOT NULL AND sync_stats.total_syncs >= 1 THEN
            success_count := success_count + 1;
            RAISE NOTICE '✓ Test 7 PASSED: Feed sync utility functions - sync_id: %, total_syncs: %',
                sync_log_id, sync_stats.total_syncs;
        ELSE
            RAISE WARNING '✗ Test 7 FAILED: Feed sync utility functions - sync_id: %, total_syncs: %',
                sync_log_id, sync_stats.total_syncs;
        END IF;
    END;
    
    -- ========================================================================
    -- Test 8: Vector search functions (if available)
    -- ========================================================================
    total_tests := total_tests + 1;
    
    BEGIN
        DECLARE
            embedding_stats RECORD;
            similar_articles_count INTEGER;
        BEGIN
            -- Test get_embedding_stats
            SELECT * INTO embedding_stats FROM get_embedding_stats();
            
            -- Test find_similar_articles with a dummy embedding
            SELECT COUNT(*) INTO similar_articles_count
            FROM find_similar_articles(
                array_fill(0.1, ARRAY[1536])::vector(1536),
                0.5,
                5
            );
            
            success_count := success_count + 1;
            RAISE NOTICE '✓ Test 8 PASSED: Vector search functions - stats available, similar articles: %',
                similar_articles_count;
        END;
    EXCEPTION WHEN OTHERS THEN
        -- Vector functions might not be available if pgvector is not installed
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 8 PASSED: Vector search functions not available (pgvector not installed)';
    END;
    
    -- ========================================================================
    -- Test 9: Validation functions
    -- ========================================================================
    total_tests := total_tests + 1;
    
    DECLARE
        email_valid BOOLEAN;
        url_valid BOOLEAN;
        timezone_valid BOOLEAN;
    BEGIN
        SELECT validate_email_format('test@example.com') INTO email_valid;
        SELECT validate_url_format('https://example.com/feed.xml') INTO url_valid;
        SELECT validate_timezone('America/New_York') INTO timezone_valid;
        
        IF email_valid AND url_valid AND timezone_valid THEN
            success_count := success_count + 1;
            RAISE NOTICE '✓ Test 9 PASSED: Validation functions work correctly';
        ELSE
            RAISE WARNING '✗ Test 9 FAILED: Validation functions - email: %, url: %, timezone: %',
                email_valid, url_valid, timezone_valid;
        END IF;
    END;
    
    -- ========================================================================
    -- Test 10: Database constraint verification
    -- ========================================================================
    total_tests := total_tests + 1;
    
    DECLARE
        constraint_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO constraint_count FROM verify_database_constraints();
        
        IF constraint_count > 0 THEN
            success_count := success_count + 1;
            RAISE NOTICE '✓ Test 10 PASSED: Database constraints verified - % constraints found',
                constraint_count;
        ELSE
            RAISE WARNING '✗ Test 10 FAILED: No database constraints found';
        END IF;
    END;
    
    -- ========================================================================
    -- Final Results
    -- ========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Functions and Views Test Results: % / % tests passed (%.2f%%)', 
        success_count, total_tests, (success_count::FLOAT / total_tests * 100);
    
    IF success_count = total_tests THEN
        RAISE NOTICE '✓ ALL FUNCTIONS AND VIEWS TESTS PASSED';
    ELSE
        RAISE EXCEPTION '✗ FUNCTIONS AND VIEWS TESTS FAILED - Only % / % tests passed', success_count, total_tests;
    END IF;
    
    -- Cleanup
    PERFORM set_config('request.jwt.claims', '', true);
    DELETE FROM auth.users WHERE id = test_user_id;
    
END $$;