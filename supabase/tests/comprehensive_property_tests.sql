-- Comprehensive Property-Based Tests for Database Schema
-- Feature: database-schema
-- This file implements property-based tests for all correctness properties defined in the design document
-- Each test runs with multiple iterations to verify properties hold across various inputs

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Test Setup: Create helper functions for test data generation
CREATE OR REPLACE FUNCTION generate_random_email() RETURNS TEXT AS $$
BEGIN
    RETURN 'test_' || gen_random_uuid()::TEXT || '@example.com';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_random_url() RETURNS TEXT AS $$
BEGIN
    RETURN 'https://example-' || substr(gen_random_uuid()::TEXT, 1, 8) || '.com/feed.xml';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Property 1: Automatic profile creation
-- Feature: database-schema, Property 1: Automatic profile creation
-- Validates: Requirements 1.1, 1.2, 1.3
-- ============================================================================

DO $$
DECLARE
    test_iteration INTEGER;
    test_user_id UUID;
    test_email TEXT;
    profile_exists BOOLEAN;
    profile_has_display_name BOOLEAN;
    profile_has_defaults BOOLEAN;
    success_count INTEGER := 0;
    total_iterations INTEGER := 100;
BEGIN
    RAISE NOTICE 'Starting Property 1: Automatic profile creation (% iterations)', total_iterations;
    
    FOR test_iteration IN 1..total_iterations LOOP
        -- Generate test data
        test_user_id := gen_random_uuid();
        test_email := generate_random_email();
        
        -- Insert user into auth.users
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
        VALUES (
            test_user_id,
            test_email,
            crypt('password123', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            jsonb_build_object('display_name', 'Test User ' || test_iteration)
        );
        
        -- Check if profile was automatically created
        SELECT EXISTS(SELECT 1 FROM profiles WHERE id = test_user_id) INTO profile_exists;
        
        -- Check if display name was populated
        SELECT display_name IS NOT NULL AND display_name != '' 
        FROM profiles WHERE id = test_user_id 
        INTO profile_has_display_name;
        
        -- Check if default values were set
        SELECT timezone IS NOT NULL AND onboarding_completed = FALSE
        FROM profiles WHERE id = test_user_id
        INTO profile_has_defaults;
        
        -- Verify property holds
        IF profile_exists AND profile_has_display_name AND profile_has_defaults THEN
            success_count := success_count + 1;
        ELSE
            RAISE WARNING 'Property 1 failed for iteration %: profile_exists=%, has_display_name=%, has_defaults=%',
                test_iteration, profile_exists, profile_has_display_name, profile_has_defaults;
        END IF;
        
        -- Cleanup
        DELETE FROM auth.users WHERE id = test_user_id;
    END LOOP;
    
    RAISE NOTICE 'Property 1 Results: % / % tests passed (%.2f%%)', 
        success_count, total_iterations, (success_count::FLOAT / total_iterations * 100);
    
    IF success_count = total_iterations THEN
        RAISE NOTICE '✓ Property 1: PASSED';
    ELSE
        RAISE EXCEPTION '✗ Property 1: FAILED - Only % / % tests passed', success_count, total_iterations;
    END IF;
END $$;

-- ============================================================================
-- Property 2: Cascade deletion integrity
-- Feature: database-schema, Property 2: Cascade deletion integrity
-- Validates: Requirements 1.4, 13.5
-- ============================================================================

DO $$
DECLARE
    test_iteration INTEGER;
    test_user_id UUID;
    test_email TEXT;
    test_feed_id UUID;
    test_article_id UUID;
    remaining_data_count INTEGER;
    success_count INTEGER := 0;
    total_iterations INTEGER := 100;
BEGIN
    RAISE NOTICE 'Starting Property 2: Cascade deletion integrity (% iterations)', total_iterations;
    
    FOR test_iteration IN 1..total_iterations LOOP
        -- Generate test data
        test_user_id := gen_random_uuid();
        test_email := generate_random_email();
        
        -- Create user with related data
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (test_user_id, test_email, crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
        
        -- Create feed
        INSERT INTO feeds (id, user_id, name, url, status, priority)
        VALUES (gen_random_uuid(), test_user_id, 'Test Feed', generate_random_url(), 'active', 'medium')
        RETURNING id INTO test_feed_id;
        
        -- Create article
        INSERT INTO articles (id, feed_id, guid, title, url)
        VALUES (gen_random_uuid(), test_feed_id, 'guid-' || test_iteration, 'Test Article', 'https://example.com/article')
        RETURNING id INTO test_article_id;
        
        -- Create user settings
        INSERT INTO user_settings (user_id) VALUES (test_user_id);
        
        -- Create user interests
        INSERT INTO user_interests (user_id, category) VALUES (test_user_id, 'technology');
        
        -- Create user article state
        INSERT INTO user_articles (user_id, article_id, is_read) VALUES (test_user_id, test_article_id, TRUE);
        
        -- Delete the user
        DELETE FROM auth.users WHERE id = test_user_id;
        
        -- Check that all related data was deleted
        SELECT 
            (SELECT COUNT(*) FROM profiles WHERE id = test_user_id) +
            (SELECT COUNT(*) FROM feeds WHERE user_id = test_user_id) +
            (SELECT COUNT(*) FROM user_settings WHERE user_id = test_user_id) +
            (SELECT COUNT(*) FROM user_interests WHERE user_id = test_user_id) +
            (SELECT COUNT(*) FROM user_articles WHERE user_id = test_user_id)
        INTO remaining_data_count;
        
        IF remaining_data_count = 0 THEN
            success_count := success_count + 1;
        ELSE
            RAISE WARNING 'Property 2 failed for iteration %: % records remain after cascade delete',
                test_iteration, remaining_data_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Property 2 Results: % / % tests passed (%.2f%%)', 
        success_count, total_iterations, (success_count::FLOAT / total_iterations * 100);
    
    IF success_count = total_iterations THEN
        RAISE NOTICE '✓ Property 2: PASSED';
    ELSE
        RAISE EXCEPTION '✗ Property 2: FAILED - Only % / % tests passed', success_count, total_iterations;
    END IF;
END $$;

-- ============================================================================
-- Property 4: Unique constraint enforcement
-- Feature: database-schema, Property 4: Unique constraint enforcement
-- Validates: Requirements 2.1, 3.1, 4.1, 4.6, 5.5, 7.3, 10.3
-- ============================================================================

DO $$
DECLARE
    test_iteration INTEGER;
    user1_id UUID;
    user2_id UUID;
    feed1_id UUID;
    feed2_id UUID;
    test_url TEXT;
    duplicate_rejected BOOLEAN;
    cross_user_allowed BOOLEAN;
    success_count INTEGER := 0;
    total_iterations INTEGER := 100;
BEGIN
    RAISE NOTICE 'Starting Property 4: Unique constraint enforcement (% iterations)', total_iterations;
    
    FOR test_iteration IN 1..total_iterations LOOP
        -- Create two test users
        user1_id := gen_random_uuid();
        user2_id := gen_random_uuid();
        test_url := generate_random_url();
        
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES 
            (user1_id, generate_random_email(), crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
            (user2_id, generate_random_email(), crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
        
        -- Insert first feed for user1
        INSERT INTO feeds (id, user_id, name, url, status, priority)
        VALUES (gen_random_uuid(), user1_id, 'Feed 1', test_url, 'active', 'medium')
        RETURNING id INTO feed1_id;
        
        -- Try to insert duplicate feed for same user (should fail)
        BEGIN
            INSERT INTO feeds (id, user_id, name, url, status, priority)
            VALUES (gen_random_uuid(), user1_id, 'Feed 1 Duplicate', test_url, 'active', 'medium');
            duplicate_rejected := FALSE;
        EXCEPTION WHEN unique_violation THEN
            duplicate_rejected := TRUE;
        END;
        
        -- Try to insert same URL for different user (should succeed)
        BEGIN
            INSERT INTO feeds (id, user_id, name, url, status, priority)
            VALUES (gen_random_uuid(), user2_id, 'Feed 2', test_url, 'active', 'medium')
            RETURNING id INTO feed2_id;
            cross_user_allowed := TRUE;
        EXCEPTION WHEN OTHERS THEN
            cross_user_allowed := FALSE;
        END;
        
        IF duplicate_rejected AND cross_user_allowed THEN
            success_count := success_count + 1;
        ELSE
            RAISE WARNING 'Property 4 failed for iteration %: duplicate_rejected=%, cross_user_allowed=%',
                test_iteration, duplicate_rejected, cross_user_allowed;
        END IF;
        
        -- Cleanup
        DELETE FROM auth.users WHERE id IN (user1_id, user2_id);
    END LOOP;
    
    RAISE NOTICE 'Property 4 Results: % / % tests passed (%.2f%%)', 
        success_count, total_iterations, (success_count::FLOAT / total_iterations * 100);
    
    IF success_count = total_iterations THEN
        RAISE NOTICE '✓ Property 4: PASSED';
    ELSE
        RAISE EXCEPTION '✗ Property 4: FAILED - Only % / % tests passed', success_count, total_iterations;
    END IF;
END $$;

-- ============================================================================
-- Property 7: Timestamp tracking accuracy
-- Feature: database-schema, Property 7: Timestamp tracking accuracy
-- Validates: Requirements 5.2, 5.3, 7.4
-- ============================================================================

DO $$
DECLARE
    test_iteration INTEGER;
    test_user_id UUID;
    test_feed_id UUID;
    test_article_id UUID;
    user_article_id UUID;
    read_timestamp TIMESTAMPTZ;
    starred_timestamp TIMESTAMPTZ;
    timestamps_correct BOOLEAN;
    success_count INTEGER := 0;
    total_iterations INTEGER := 100;
BEGIN
    RAISE NOTICE 'Starting Property 7: Timestamp tracking accuracy (% iterations)', total_iterations;
    
    FOR test_iteration IN 1..total_iterations LOOP
        -- Create test user and article
        test_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (test_user_id, generate_random_email(), crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
        
        INSERT INTO feeds (id, user_id, name, url, status, priority)
        VALUES (gen_random_uuid(), test_user_id, 'Test Feed', generate_random_url(), 'active', 'medium')
        RETURNING id INTO test_feed_id;
        
        INSERT INTO articles (id, feed_id, guid, title, url)
        VALUES (gen_random_uuid(), test_feed_id, 'guid-' || test_iteration, 'Test Article', 'https://example.com/article')
        RETURNING id INTO test_article_id;
        
        -- Mark article as read
        INSERT INTO user_articles (user_id, article_id, is_read)
        VALUES (test_user_id, test_article_id, TRUE)
        RETURNING id INTO user_article_id;
        
        -- Check that read_at was set
        SELECT read_at INTO read_timestamp FROM user_articles WHERE id = user_article_id;
        
        -- Mark article as starred
        UPDATE user_articles SET is_starred = TRUE WHERE id = user_article_id;
        
        -- Check that starred_at was set
        SELECT starred_at INTO starred_timestamp FROM user_articles WHERE id = user_article_id;
        
        -- Verify timestamps were set correctly
        timestamps_correct := (read_timestamp IS NOT NULL) AND (starred_timestamp IS NOT NULL);
        
        IF timestamps_correct THEN
            success_count := success_count + 1;
        ELSE
            RAISE WARNING 'Property 7 failed for iteration %: read_at=%, starred_at=%',
                test_iteration, read_timestamp, starred_timestamp;
        END IF;
        
        -- Cleanup
        DELETE FROM auth.users WHERE id = test_user_id;
    END LOOP;
    
    RAISE NOTICE 'Property 7 Results: % / % tests passed (%.2f%%)', 
        success_count, total_iterations, (success_count::FLOAT / total_iterations * 100);
    
    IF success_count = total_iterations THEN
        RAISE NOTICE '✓ Property 7: PASSED';
    ELSE
        RAISE EXCEPTION '✗ Property 7: FAILED - Only % / % tests passed', success_count, total_iterations;
    END IF;
END $$;

-- ============================================================================
-- Property 8: Default value consistency
-- Feature: database-schema, Property 8: Default value consistency
-- Validates: Requirements 1.3, 6.6
-- ============================================================================

DO $$
DECLARE
    test_iteration INTEGER;
    test_user_id UUID;
    profile_defaults_correct BOOLEAN;
    settings_defaults_correct BOOLEAN;
    success_count INTEGER := 0;
    total_iterations INTEGER := 100;
BEGIN
    RAISE NOTICE 'Starting Property 8: Default value consistency (% iterations)', total_iterations;
    
    FOR test_iteration IN 1..total_iterations LOOP
        -- Create test user
        test_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (test_user_id, generate_random_email(), crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
        
        -- Check profile defaults
        SELECT 
            timezone = 'America/New_York' AND 
            onboarding_completed = FALSE
        FROM profiles WHERE id = test_user_id
        INTO profile_defaults_correct;
        
        -- Create user settings
        INSERT INTO user_settings (user_id) VALUES (test_user_id);
        
        -- Check settings defaults
        SELECT 
            polling_interval_minutes = 60 AND
            enable_adaptive_polling = TRUE AND
            enable_ai_summaries = TRUE AND
            enable_ai_clustering = TRUE AND
            theme = 'system'
        FROM user_settings WHERE user_id = test_user_id
        INTO settings_defaults_correct;
        
        IF profile_defaults_correct AND settings_defaults_correct THEN
            success_count := success_count + 1;
        ELSE
            RAISE WARNING 'Property 8 failed for iteration %: profile_defaults=%, settings_defaults=%',
                test_iteration, profile_defaults_correct, settings_defaults_correct;
        END IF;
        
        -- Cleanup
        DELETE FROM auth.users WHERE id = test_user_id;
    END LOOP;
    
    RAISE NOTICE 'Property 8 Results: % / % tests passed (%.2f%%)', 
        success_count, total_iterations, (success_count::FLOAT / total_iterations * 100);
    
    IF success_count = total_iterations THEN
        RAISE NOTICE '✓ Property 8: PASSED';
    ELSE
        RAISE EXCEPTION '✗ Property 8: FAILED - Only % / % tests passed', success_count, total_iterations;
    END IF;
END $$;

-- ============================================================================
-- Property 11: Aggregate calculation accuracy
-- Feature: database-schema, Property 11: Aggregate calculation accuracy
-- Validates: Requirements 9.5, 10.5, 14.3
-- ============================================================================

DO $$
DECLARE
    test_iteration INTEGER;
    test_user_id UUID;
    test_feed_id UUID;
    test_folder_id UUID;
    article_count INTEGER;
    unread_count_from_view INTEGER;
    actual_unread_count INTEGER;
    counts_match BOOLEAN;
    success_count INTEGER := 0;
    total_iterations INTEGER := 100;
BEGIN
    RAISE NOTICE 'Starting Property 11: Aggregate calculation accuracy (% iterations)', total_iterations;
    
    FOR test_iteration IN 1..total_iterations LOOP
        -- Create test user
        test_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (test_user_id, generate_random_email(), crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
        
        -- Create folder
        INSERT INTO folders (id, user_id, name, position)
        VALUES (gen_random_uuid(), test_user_id, 'Test Folder', 1)
        RETURNING id INTO test_folder_id;
        
        -- Create feed
        INSERT INTO feeds (id, user_id, folder_id, name, url, status, priority)
        VALUES (gen_random_uuid(), test_user_id, test_folder_id, 'Test Feed', generate_random_url(), 'active', 'medium')
        RETURNING id INTO test_feed_id;
        
        -- Create random number of articles (1-10)
        article_count := 1 + floor(random() * 10)::INTEGER;
        
        FOR i IN 1..article_count LOOP
            INSERT INTO articles (feed_id, guid, title, url)
            VALUES (test_feed_id, 'guid-' || test_iteration || '-' || i, 'Article ' || i, 'https://example.com/article' || i);
        END LOOP;
        
        -- Mark some as read (random)
        INSERT INTO user_articles (user_id, article_id, is_read)
        SELECT test_user_id, id, random() > 0.5
        FROM articles WHERE feed_id = test_feed_id;
        
        -- Get unread count from view
        SELECT unread_count INTO unread_count_from_view
        FROM folder_unread_counts
        WHERE user_id = test_user_id AND folder_id = test_folder_id;
        
        -- Calculate actual unread count
        SELECT COUNT(*) INTO actual_unread_count
        FROM articles a
        LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = test_user_id
        WHERE a.feed_id = test_feed_id
        AND (ua.is_read IS NULL OR ua.is_read = FALSE);
        
        counts_match := (unread_count_from_view = actual_unread_count);
        
        IF counts_match THEN
            success_count := success_count + 1;
        ELSE
            RAISE WARNING 'Property 11 failed for iteration %: view_count=%, actual_count=%',
                test_iteration, unread_count_from_view, actual_unread_count;
        END IF;
        
        -- Cleanup
        DELETE FROM auth.users WHERE id = test_user_id;
    END LOOP;
    
    RAISE NOTICE 'Property 11 Results: % / % tests passed (%.2f%%)', 
        success_count, total_iterations, (success_count::FLOAT / total_iterations * 100);
    
    IF success_count = total_iterations THEN
        RAISE NOTICE '✓ Property 11: PASSED';
    ELSE
        RAISE EXCEPTION '✗ Property 11: FAILED - Only % / % tests passed', success_count, total_iterations;
    END IF;
END $$;

-- ============================================================================
-- Property 14: Automatic cleanup behavior
-- Feature: database-schema, Property 14: Automatic cleanup behavior
-- Validates: Requirements 12.4, 12.5
-- ============================================================================

DO $$
DECLARE
    test_iteration INTEGER;
    test_user_id UUID;
    test_feed_id UUID;
    final_log_count INTEGER;
    cleanup_working BOOLEAN;
    success_count INTEGER := 0;
    total_iterations INTEGER := 50; -- Reduced iterations due to heavy operations
BEGIN
    RAISE NOTICE 'Starting Property 14: Automatic cleanup behavior (% iterations)', total_iterations;
    
    FOR test_iteration IN 1..total_iterations LOOP
        -- Create test user and feed
        test_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (test_user_id, generate_random_email(), crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
        
        INSERT INTO feeds (id, user_id, name, url, status, priority)
        VALUES (gen_random_uuid(), test_user_id, 'Test Feed', generate_random_url(), 'active', 'medium')
        RETURNING id INTO test_feed_id;
        
        -- Insert 105 sync logs (should trigger cleanup to keep only 100)
        FOR i IN 1..105 LOOP
            INSERT INTO feed_sync_log (
                feed_id, sync_started_at, sync_completed_at, status, 
                http_status_code, articles_found, articles_new, sync_duration_ms
            ) VALUES (
                test_feed_id,
                NOW() - (i || ' minutes')::INTERVAL,
                NOW() - (i || ' minutes')::INTERVAL + '30 seconds'::INTERVAL,
                'success',
                200,
                100,
                5,
                30000
            );
        END LOOP;
        
        -- Check that only 100 logs remain
        SELECT COUNT(*) INTO final_log_count
        FROM feed_sync_log WHERE feed_id = test_feed_id;
        
        cleanup_working := (final_log_count = 100);
        
        IF cleanup_working THEN
            success_count := success_count + 1;
        ELSE
            RAISE WARNING 'Property 14 failed for iteration %: final_count=% (expected 100)',
                test_iteration, final_log_count;
        END IF;
        
        -- Cleanup
        DELETE FROM auth.users WHERE id = test_user_id;
    END LOOP;
    
    RAISE NOTICE 'Property 14 Results: % / % tests passed (%.2f%%)', 
        success_count, total_iterations, (success_count::FLOAT / total_iterations * 100);
    
    IF success_count = total_iterations THEN
        RAISE NOTICE '✓ Property 14: PASSED';
    ELSE
        RAISE EXCEPTION '✗ Property 14: FAILED - Only % / % tests passed', success_count, total_iterations;
    END IF;
END $$;

-- Cleanup helper functions
DROP FUNCTION IF EXISTS generate_random_email();
DROP FUNCTION IF EXISTS generate_random_url();

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All property-based tests completed!';
    RAISE NOTICE '========================================';
END $$;
