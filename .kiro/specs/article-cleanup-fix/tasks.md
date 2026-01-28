# Implementation Plan: Article Cleanup System Fix

## Overview

This implementation plan converts the article cleanup fix design into discrete coding tasks. The approach is incremental, building from database schema changes through service implementation to integration with existing systems. Each task builds on previous work, with checkpoints to ensure stability.

## Tasks

- [ ] 1. Database schema updates and migrations
  - [x] 1.1 Create cleanup_log table migration
    - Write SQL migration to create cleanup_log table with all fields (id, user_id, feed_id, trigger_type, articles_deleted, duration_ms, error_message, created_at)
    - Add indexes on user_id and created_at for query performance
    - Test migration on local Supabase instance
    - _Requirements: 8.2_
  
  - [x] 1.2 Add cleanup settings to user_settings table
    - Write SQL migration to add articles_per_feed, unread_article_age_days, enable_auto_cleanup columns
    - Set appropriate defaults (100, 30, true)
    - Test migration on local Supabase instance
    - _Requirements: 5.1, 5.2, 5.4_
  
  - [x] 1.3 Add performance indexes for cleanup queries
    - Create index on articles(feed_id, published_at DESC) for efficient article ordering
    - Create partial index on user_articles(user_id, article_id) WHERE is_starred OR is_read for protected article queries
    - Test index performance with EXPLAIN ANALYZE
    - _Requirements: 7.1_
  
  - [x] 1.4 Update Drizzle schema definitions
    - Add cleanupLog table definition to shared/schema.ts
    - Add cleanup settings fields to userSettings table definition
    - Export types for CleanupLogEntry
    - Run drizzle-kit generate to sync types
    - _Requirements: 8.2, 5.4_

- [ ] 2. Implement cleanup configuration
  - [x] 2.1 Add cleanup configuration to server/config.ts
    - Add defaultArticlesPerFeed, defaultUnreadAgeDays, min/max ranges
    - Add deleteBatchSize, cleanupTimeoutMs constants
    - Add scheduledCleanupCron configuration
    - Export cleanupConfig object
    - _Requirements: 1.1, 2.1, 7.1_
  
  - [ ]* 2.2 Write unit tests for configuration validation
    - Test default values are correct
    - Test environment variable overrides work
    - Test min/max range constants
    - _Requirements: 1.1, 2.1_

- [ ] 3. Implement core cleanup service
  - [x] 3.1 Create ArticleCleanupService class structure
    - Create server/article-cleanup-service.ts file
    - Define CleanupSettings, CleanupResult, ProtectedArticleQuery interfaces
    - Implement constructor with storage dependency
    - Add getCleanupSettings method to fetch user settings or defaults
    - _Requirements: 5.3, 5.5_
  
  - [x] 3.2 Implement protected article identification
    - Implement getProtectedArticleIds method
    - Query user_articles for starred and read articles
    - Query article_comments for articles with comments
    - Return Set of protected article IDs
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 3.3 Write property test for protected article identification
    - **Property 2: Protected Articles Are Never Deleted**
    - **Validates: Requirements 1.3, 1.4, 2.3, 2.4, 6.1, 6.2, 6.4**
    - Generate random articles with random protection states
    - Verify all protected articles identified correctly
  
  - [x] 3.4 Implement per-feed limit cleanup strategy
    - Implement getArticlesExceedingFeedLimit private method
    - Query articles for feed ordered by published_at DESC
    - Filter out protected articles
    - Return article IDs beyond the limit
    - _Requirements: 1.2, 1.5_
  
  - [ ]* 3.5 Write property test for per-feed limit enforcement
    - **Property 1: Per-Feed Limit Enforcement**
    - **Validates: Requirements 1.2, 1.5**
    - Generate random feeds with varying article counts
    - Verify cleanup enforces limit correctly
  
  - [x] 3.6 Implement age-based cleanup strategy
    - Implement getArticlesExceedingAgeThreshold private method
    - Calculate cutoff date from age threshold
    - Query unread articles older than cutoff
    - Filter out protected articles
    - Return article IDs
    - _Requirements: 2.2, 2.5_
  
  - [ ]* 3.7 Write property test for age-based cleanup
    - **Property 3: Age-Based Cleanup**
    - **Validates: Requirements 2.2, 2.5**
    - Generate random articles with random published dates
    - Verify old unread articles deleted correctly

- [ ] 4. Implement batch deletion and logging
  - [x] 4.1 Implement batch deletion logic
    - Implement batchDeleteArticles private method
    - Split article IDs into batches of cleanupConfig.deleteBatchSize
    - Use Drizzle transactions for each batch
    - Handle errors with rollback and continue
    - Return total deleted count
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ]* 4.2 Write property test for batch deletion
    - **Property 11: Batch Deletion**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Generate random article counts requiring batching (500-5000)
    - Verify batching occurs and all articles deleted
  
  - [x] 4.3 Implement cleanup logging
    - Implement logCleanup private method
    - Insert into cleanup_log table with all required fields
    - Handle logging errors gracefully (don't fail cleanup)
    - _Requirements: 3.3, 8.1, 8.2, 8.3_
  
  - [ ]* 4.4 Write property test for cleanup logging
    - **Property 5: Cleanup Logging Completeness**
    - **Validates: Requirements 3.3, 8.1, 8.2, 8.3**
    - Generate random cleanup scenarios
    - Verify log entries contain all required fields

- [x] 5. Checkpoint - Core service complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement cleanup orchestration methods
  - [x] 6.1 Implement cleanupFeedArticles method
    - Get user cleanup settings
    - Check if auto-cleanup enabled
    - Get protected article IDs
    - Apply per-feed limit strategy
    - Apply age-based strategy
    - Combine deletion candidates (union)
    - Execute batch deletion
    - Log cleanup operation
    - Return CleanupResult with error handling
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [ ]* 6.2 Write property test for combined cleanup strategy
    - **Property 4: Combined Cleanup Strategy**
    - **Validates: Requirements 3.2, 4.3**
    - Generate articles violating both limits
    - Verify both constraints enforced
  
  - [ ]* 6.3 Write property test for cleanup performance
    - **Property 6: Cleanup Performance**
    - **Validates: Requirements 3.5, 7.5**
    - Generate random article counts
    - Verify cleanup completes within time limits
  
  - [x] 6.4 Implement cleanupUserArticles method
    - Get all user's feeds from storage
    - Call cleanupFeedArticles for each feed
    - Aggregate results (total deleted, total duration)
    - Handle errors per-feed (continue on failure)
    - Return aggregated CleanupResult
    - _Requirements: 4.2_
  
  - [x] 6.5 Implement cleanupAllUsers method
    - Get all active users with feeds
    - Call cleanupUserArticles for each user
    - Aggregate results (users processed, total deleted)
    - Handle errors per-user (continue on failure)
    - Return aggregated results
    - _Requirements: 4.2, 4.4_
  
  - [ ]* 6.6 Write property test for all users processed
    - **Property 7: All Active Users Processed**
    - **Validates: Requirements 4.2, 4.4**
    - Generate random number of users
    - Verify all users processed and counts aggregate correctly

- [ ] 7. Implement storage layer methods
  - [x] 7.1 Add cleanup methods to storage interface
    - Add getUserSettings method to Storage interface
    - Add getProtectedArticles method to Storage interface
    - Add batchDeleteArticles method to Storage interface
    - Add logCleanup method to Storage interface
    - _Requirements: 5.4, 6.3, 7.1, 8.2_
  
  - [x] 7.2 Implement cleanup methods in SupabaseStorage
    - Implement getUserSettings using Drizzle query
    - Implement getProtectedArticles with joins on user_articles and article_comments
    - Implement batchDeleteArticles with transaction support
    - Implement logCleanup with insert to cleanup_log
    - _Requirements: 5.4, 6.3, 7.1, 8.2_
  
  - [ ]* 7.3 Write integration tests for storage methods
    - Test getUserSettings returns correct data
    - Test getProtectedArticles identifies all protected articles
    - Test batchDeleteArticles handles transactions correctly
    - Test logCleanup persists data correctly

- [ ] 8. Implement user settings API endpoints
  - [x] 8.1 Add GET /api/users/cleanup-settings endpoint
    - Require authentication
    - Fetch user cleanup settings from storage
    - Return settings with defaults if not configured
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [x] 8.2 Add PUT /api/users/cleanup-settings endpoint
    - Require authentication
    - Validate settings with Zod schema (ranges 50-500, 7-90)
    - Update user_settings table
    - Return updated settings
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 8.3 Write property test for settings validation
    - **Property 8: Settings Validation**
    - **Validates: Requirements 5.1, 5.2**
    - Generate random settings values (valid and invalid)
    - Verify valid values accepted, invalid rejected
  
  - [ ]* 8.4 Write property test for settings application
    - **Property 9: Settings Application**
    - **Validates: Requirements 5.3**
    - Generate random user settings
    - Verify cleanup uses user settings instead of defaults
  
  - [ ]* 8.5 Write integration tests for settings endpoints
    - Test GET returns correct settings
    - Test PUT validates and updates settings
    - Test PUT rejects invalid values with 400

- [x] 9. Checkpoint - Settings and API complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integrate cleanup with feed sync
  - [x] 10.1 Update feed sync route to call cleanup
    - In POST /api/feeds/sync route, after successful sync
    - Call articleCleanupService.cleanupFeedArticles(userId, feedId)
    - Log cleanup results
    - Don't fail sync if cleanup fails (error handling)
    - _Requirements: 3.1, 3.4_
  
  - [x] 10.2 Update background feed sync to call cleanup
    - In background sync logic (routes.ts line ~1727)
    - Call articleCleanupService.cleanupFeedArticles(userId, feedId)
    - Log cleanup results
    - Don't fail sync if cleanup fails
    - _Requirements: 3.1, 3.4_
  
  - [ ]* 10.3 Write integration test for sync-triggered cleanup
    - Test feed sync triggers cleanup
    - Test cleanup errors don't fail sync
    - Verify cleanup log entry created
    - _Requirements: 3.1, 3.4_

- [ ] 11. Implement scheduled cleanup
  - [x] 11.1 Create CleanupScheduler class
    - Create server/cleanup-scheduler.ts file
    - Implement CleanupScheduler class with cleanupService dependency
    - Implement runScheduledCleanup method
    - Add isRunning flag to prevent concurrent execution
    - Log start, progress, and completion
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [x] 11.2 Create Netlify Function for scheduled cleanup
    - Create netlify/functions/scheduled-cleanup.ts
    - Import and call cleanupScheduler.runScheduledCleanup()
    - Return results as JSON
    - Handle errors and return 500 on failure
    - _Requirements: 4.1, 4.5_
  
  - [x] 11.3 Configure Netlify scheduled function
    - Add scheduled function configuration to netlify.toml
    - Set cron schedule to "0 2 * * *" (2 AM daily)
    - Test locally with netlify dev
    - _Requirements: 4.1, 4.5_
  
  - [ ]* 11.4 Write integration test for scheduled cleanup
    - Test scheduled cleanup processes all users
    - Test scheduled cleanup aggregates results correctly
    - Test scheduled cleanup handles errors gracefully
    - _Requirements: 4.2, 4.4_

- [ ] 12. Implement admin monitoring endpoints
  - [x] 12.1 Add GET /api/admin/cleanup-stats endpoint
    - Require admin authentication
    - Query cleanup_log for statistics (total deletions, average duration, error rate)
    - Calculate metrics over last 24 hours
    - Return aggregated statistics
    - _Requirements: 8.4_
  
  - [x] 12.2 Add GET /api/admin/cleanup-logs endpoint
    - Require admin authentication
    - Query cleanup_log with pagination
    - Support filtering by user_id, feed_id, trigger_type
    - Return paginated log entries
    - _Requirements: 8.4_
  
  - [ ]* 12.3 Write integration tests for admin endpoints
    - Test cleanup-stats returns correct aggregations
    - Test cleanup-logs supports pagination and filtering
    - Test endpoints require admin authentication

- [ ] 13. Implement multi-user article protection
  - [x] 13.1 Update getProtectedArticleIds to handle multi-user protection
    - Query user_articles for all users protecting each article
    - Return article IDs protected by any user
    - _Requirements: 6.5_
  
  - [x] 13.2 Update deletion logic to respect multi-user protection
    - Before deleting article, check if any other user protects it
    - Skip deletion if article is protected by any user
    - _Requirements: 6.5_
  
  - [ ]* 13.3 Write property test for multi-user protection
    - **Property 10: Multi-User Article Protection**
    - **Validates: Requirements 6.5**
    - Generate articles with multi-user protection
    - Verify article persists while any user protects it

- [ ] 14. Remove old cleanup implementation
  - [x] 14.1 Remove old cleanupOldArticles method
    - Delete cleanupOldArticles method from server/supabase-storage.ts
    - Remove calls to old method from routes.ts
    - Update any references to use new cleanup service
    - _Requirements: 1.2_
  
  - [x] 14.2 Update configuration
    - Remove maxArticlesPerUserFeed from server/config.ts
    - Remove MAX_ARTICLES_PER_USER_FEED environment variable references
    - Update .env.example with new cleanup configuration variables
    - _Requirements: 1.1, 2.1_
  
  - [x] 14.3 Update documentation
    - Update ARTICLE_CAP_IMPLEMENTATION.md with new cleanup system details
    - Document new API endpoints in relevant docs
    - Document new user settings in user guide

- [x] 15. Final checkpoint - Complete system integration
  - Ensure all tests pass, ask the user if questions arise.
  - Run full test suite including property tests
  - Test on local Supabase instance with realistic data
  - Verify cleanup logs are being created correctly
  - Verify scheduled cleanup works in Netlify dev environment

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (min 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation preserves backward compatibility until old system is removed
