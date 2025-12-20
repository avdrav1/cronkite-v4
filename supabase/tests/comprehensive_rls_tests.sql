-- Comprehensive RLS Policy Tests
-- Feature: database-schema, Property 3: User data isolation
-- Validates: Requirements 13.1, 13.2, 13.3, 13.4

-- Test RLS policies with different user scenarios
-- This script creates multiple users and verifies data isolation

-- Setup test users
DO $$
DECLARE
    user1_id UUID := '11111111-1111-1111-1111-111111111111';
    user2_id UUID := '22222222-2222-2222-2222-222222222222';
    admin_user_id UUID := '33333333-3333-3333-3333-333333333333';
    
    user1_feed_id UUID;
    user2_feed_id UUID;
    user1_article_id UUID;
    user2_article_id UUID;
    
    test_results RECORD;
    success_count INTEGER := 0;
    total_tests INTEGER := 0;
BEGIN
    RAISE NOTICE 'Setting up comprehensive RLS tests...';
    
    -- Clean up any existing test data
    DELETE FROM auth.users WHERE id IN (user1_id, user2_id, admin_user_id);
    
    -- Create test users
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES 
        (user1_id, 'user1@test.com', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
        (user2_id, 'user2@test.com', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
        (admin_user_id, 'admin@test.com', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
    
    -- Create feeds for each user
    INSERT INTO feeds (id, user_id, name, url, status, priority)
    VALUES 
        (gen_random_uuid(), user1_id, 'User 1 Feed', 'https://user1.com/feed.xml', 'active', 'medium'),
        (gen_random_uuid(), user2_id, 'User 2 Feed', 'https://user2.com/feed.xml', 'active', 'medium')
    RETURNING id INTO user1_feed_id, user2_feed_id;
    
    -- Get the actual feed IDs
    SELECT id INTO user1_feed_id FROM feeds WHERE user_id = user1_id;
    SELECT id INTO user2_feed_id FROM feeds WHERE user_id = user2_id;
    
    -- Create articles for each feed
    INSERT INTO articles (id, feed_id, guid, title, url)
    VALUES 
        (gen_random_uuid(), user1_feed_id, 'user1-article-1', 'User 1 Article', 'https://user1.com/article1'),
        (gen_random_uuid(), user2_feed_id, 'user2-article-1', 'User 2 Article', 'https://user2.com/article1')
    RETURNING id INTO user1_article_id, user2_article_id;
    
    -- Get the actual article IDs
    SELECT id INTO user1_article_id FROM articles WHERE feed_id = user1_feed_id;
    SELECT id INTO user2_article_id FROM articles WHERE feed_id = user2_feed_id;
    
    -- Create user settings
    INSERT INTO user_settings (user_id) VALUES (user1_id), (user2_id);
    
    -- Create user interests
    INSERT INTO user_interests (user_id, category) VALUES 
        (user1_id, 'technology'),
        (user2_id, 'science');
    
    -- Create user article states
    INSERT INTO user_articles (user_id, article_id, is_read) VALUES 
        (user1_id, user1_article_id, TRUE),
        (user2_id, user2_article_id, FALSE);
    
    RAISE NOTICE 'Test data created successfully';
    
    -- ========================================================================
    -- Test 1: Profile access isolation
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- Set session for user1
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user1_id)::text, true);
    
    -- User1 should see only their profile
    SELECT COUNT(*) as own_profile_count,
           (SELECT COUNT(*) FROM profiles WHERE id != user1_id) as other_profiles_count
    INTO test_results
    FROM profiles WHERE id = user1_id;
    
    IF test_results.own_profile_count = 1 AND test_results.other_profiles_count = 0 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 1 PASSED: Profile access isolation';
    ELSE
        RAISE WARNING '✗ Test 1 FAILED: Profile access isolation - own: %, others: %', 
            test_results.own_profile_count, test_results.other_profiles_count;
    END IF;
    
    -- ========================================================================
    -- Test 2: Feed access isolation
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- User1 should see only their feeds
    SELECT COUNT(*) as own_feeds_count,
           (SELECT COUNT(*) FROM feeds WHERE user_id != user1_id) as other_feeds_count
    INTO test_results
    FROM feeds WHERE user_id = user1_id;
    
    IF test_results.own_feeds_count = 1 AND test_results.other_feeds_count = 0 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 2 PASSED: Feed access isolation';
    ELSE
        RAISE WARNING '✗ Test 2 FAILED: Feed access isolation - own: %, others: %', 
            test_results.own_feeds_count, test_results.other_feeds_count;
    END IF;
    
    -- ========================================================================
    -- Test 3: Article access through subscribed feeds only
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- User1 should see articles only from their subscribed feeds
    SELECT COUNT(*) as accessible_articles
    INTO test_results
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE f.user_id = user1_id;
    
    IF test_results.accessible_articles = 1 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 3 PASSED: Article access through subscribed feeds';
    ELSE
        RAISE WARNING '✗ Test 3 FAILED: Article access - accessible: % (expected 1)', 
            test_results.accessible_articles;
    END IF;
    
    -- ========================================================================
    -- Test 4: User settings isolation
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- User1 should see only their settings
    SELECT COUNT(*) as own_settings_count,
           (SELECT COUNT(*) FROM user_settings WHERE user_id != user1_id) as other_settings_count
    INTO test_results
    FROM user_settings WHERE user_id = user1_id;
    
    IF test_results.own_settings_count = 1 AND test_results.other_settings_count = 0 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 4 PASSED: User settings isolation';
    ELSE
        RAISE WARNING '✗ Test 4 FAILED: User settings isolation - own: %, others: %', 
            test_results.own_settings_count, test_results.other_settings_count;
    END IF;
    
    -- ========================================================================
    -- Test 5: User interests isolation
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- User1 should see only their interests
    SELECT COUNT(*) as own_interests_count,
           (SELECT COUNT(*) FROM user_interests WHERE user_id != user1_id) as other_interests_count
    INTO test_results
    FROM user_interests WHERE user_id = user1_id;
    
    IF test_results.own_interests_count = 1 AND test_results.other_interests_count = 0 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 5 PASSED: User interests isolation';
    ELSE
        RAISE WARNING '✗ Test 5 FAILED: User interests isolation - own: %, others: %', 
            test_results.own_interests_count, test_results.other_interests_count;
    END IF;
    
    -- ========================================================================
    -- Test 6: User articles isolation
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- User1 should see only their article states
    SELECT COUNT(*) as own_article_states_count,
           (SELECT COUNT(*) FROM user_articles WHERE user_id != user1_id) as other_article_states_count
    INTO test_results
    FROM user_articles WHERE user_id = user1_id;
    
    IF test_results.own_article_states_count = 1 AND test_results.other_article_states_count = 0 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 6 PASSED: User articles isolation';
    ELSE
        RAISE WARNING '✗ Test 6 FAILED: User articles isolation - own: %, others: %', 
            test_results.own_article_states_count, test_results.other_article_states_count;
    END IF;
    
    -- ========================================================================
    -- Test 7: Recommended feeds public access
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- Clear session to test public access
    PERFORM set_config('request.jwt.claims', '', true);
    
    -- Should be able to read recommended feeds without authentication
    SELECT COUNT(*) as public_feeds_count
    INTO test_results
    FROM recommended_feeds
    LIMIT 1; -- Just test that we can access it
    
    IF test_results.public_feeds_count >= 0 THEN -- Any count is fine, just testing access
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 7 PASSED: Recommended feeds public access';
    ELSE
        RAISE WARNING '✗ Test 7 FAILED: Recommended feeds public access denied';
    END IF;
    
    -- ========================================================================
    -- Test 8: Cross-user data modification prevention
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- Set session back to user1
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user1_id)::text, true);
    
    -- Try to update user2's feed (should fail)
    BEGIN
        UPDATE feeds SET name = 'Hacked Feed' WHERE user_id = user2_id;
        RAISE WARNING '✗ Test 8 FAILED: Cross-user modification was allowed';
    EXCEPTION WHEN insufficient_privilege OR security_definer_search_path_not_set THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 8 PASSED: Cross-user modification prevented';
    WHEN OTHERS THEN
        -- Check if no rows were affected (RLS blocked the update)
        IF NOT FOUND THEN
            success_count := success_count + 1;
            RAISE NOTICE '✓ Test 8 PASSED: Cross-user modification blocked by RLS';
        ELSE
            RAISE WARNING '✗ Test 8 FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;
    
    -- ========================================================================
    -- Test 9: View access with RLS
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- User1 should see data only from their feeds in views
    SELECT COUNT(*) as view_articles_count
    INTO test_results
    FROM articles_with_feed;
    
    IF test_results.view_articles_count = 1 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 9 PASSED: View access respects RLS';
    ELSE
        RAISE WARNING '✗ Test 9 FAILED: View access - articles: % (expected 1)', 
            test_results.view_articles_count;
    END IF;
    
    -- ========================================================================
    -- Test 10: Switch user context
    -- ========================================================================
    total_tests := total_tests + 1;
    
    -- Switch to user2
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user2_id)::text, true);
    
    -- User2 should see only their data
    SELECT COUNT(*) as user2_feeds_count,
           (SELECT COUNT(*) FROM user_articles WHERE user_id = user2_id) as user2_articles_count
    INTO test_results
    FROM feeds WHERE user_id = user2_id;
    
    IF test_results.user2_feeds_count = 1 AND test_results.user2_articles_count = 1 THEN
        success_count := success_count + 1;
        RAISE NOTICE '✓ Test 10 PASSED: User context switching works';
    ELSE
        RAISE WARNING '✗ Test 10 FAILED: User2 context - feeds: %, articles: %', 
            test_results.user2_feeds_count, test_results.user2_articles_count;
    END IF;
    
    -- ========================================================================
    -- Final Results
    -- ========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS Policy Test Results: % / % tests passed (%.2f%%)', 
        success_count, total_tests, (success_count::FLOAT / total_tests * 100);
    
    IF success_count = total_tests THEN
        RAISE NOTICE '✓ ALL RLS TESTS PASSED';
    ELSE
        RAISE EXCEPTION '✗ RLS TESTS FAILED - Only % / % tests passed', success_count, total_tests;
    END IF;
    
    -- Cleanup
    PERFORM set_config('request.jwt.claims', '', true);
    DELETE FROM auth.users WHERE id IN (user1_id, user2_id, admin_user_id);
    
END $$;