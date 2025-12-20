-- Master Test Runner for Database Schema
-- This script runs all comprehensive database tests

-- Set up test environment
\set ON_ERROR_STOP on
\timing on

-- Display test information
SELECT 
    'Starting Comprehensive Database Schema Tests' as message,
    NOW() as start_time,
    current_database() as database,
    current_user as user_role;

-- Check database extensions
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector')
ORDER BY extname;

-- Check RLS status on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- ============================================================================
-- Run Property-Based Tests
-- ============================================================================
\echo ''
\echo '========================================'
\echo 'RUNNING PROPERTY-BASED TESTS'
\echo '========================================'

\i supabase/tests/comprehensive_property_tests.sql

-- ============================================================================
-- Run RLS Policy Tests
-- ============================================================================
\echo ''
\echo '========================================'
\echo 'RUNNING RLS POLICY TESTS'
\echo '========================================'

\i supabase/tests/comprehensive_rls_tests.sql

-- ============================================================================
-- Run Functions and Views Tests
-- ============================================================================
\echo ''
\echo '========================================'
\echo 'RUNNING FUNCTIONS AND VIEWS TESTS'
\echo '========================================'

\i supabase/tests/comprehensive_functions_views_tests.sql

-- ============================================================================
-- Run Existing Specific Tests
-- ============================================================================
\echo ''
\echo '========================================'
\echo 'RUNNING EXISTING SPECIFIC TESTS'
\echo '========================================'

\echo 'Running database optimization tests...'
\i test_database_optimization.sql

\echo 'Running RLS policies tests...'
\i test_rls_policies.sql

\echo 'Running feed sync log tests...'
\i test_feed_sync_log.sql

\echo 'Running vector search tests...'
\i test_vector_search.sql

-- ============================================================================
-- Final Test Summary
-- ============================================================================
\echo ''
\echo '========================================'
\echo 'TEST EXECUTION COMPLETED'
\echo '========================================'

SELECT 
    'All Database Schema Tests Completed Successfully!' as message,
    NOW() as completion_time;

-- Display final database statistics
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename) as column_count
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Display index information
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname)) as index_size
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexname) DESC
LIMIT 20;

\echo ''
\echo 'Database schema testing completed successfully!'
\echo 'All property-based tests, RLS policies, functions, and views have been validated.'