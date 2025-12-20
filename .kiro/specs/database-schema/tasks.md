# Implementation Plan

- [x] 1. Set up Supabase project and core configuration
  - Initialize Supabase project with PostgreSQL database
  - Configure environment variables and connection strings
  - Set up Supabase CLI and local development environment
  - Enable required extensions (pgvector for semantic search)
  - _Requirements: 1.1, 15.1_

- [x] 2. Create core user management tables and triggers
  - [x] 2.1 Create profiles table extending Supabase auth.users
    - Define profiles table schema with all required fields
    - Set up foreign key relationship to auth.users with CASCADE delete
    - Add default values for timezone and onboarding_completed
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 2.2 Implement automatic profile creation trigger
    - Create handle_new_user() function for profile creation
    - Set up trigger on auth.users INSERT to create profiles
    - Extract display name from user metadata or email prefix
    - _Requirements: 1.1, 1.2_

  - [ ]* 2.3 Write property test for automatic profile creation
    - **Property 1: Automatic profile creation**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 2.4 Create user_settings table with comprehensive preferences
    - Define all settings categories (polling, digest, AI, appearance)
    - Set appropriate default values for all settings
    - Link to profiles table with CASCADE delete
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 2.5 Write property test for settings storage completeness
    - **Property 17: Settings storage completeness**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [x] 2.6 Create user_interests table for onboarding
    - Define table for storing user interest categories
    - Set up unique constraint on (user_id, category)
    - Add timestamp tracking for selection dates
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [ ]* 2.7 Write property test for interest management
    - **Property 4: Unique constraint enforcement (partial)**
    - **Validates: Requirements 7.3**

- [ ] 3. Create feed management system
  - [x] 3.1 Create folders table for feed organization
    - Define folders table with user ownership and positioning
    - Set up unique constraint on (user_id, name)
    - Add support for custom icons and ordering
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 3.2 Create feeds table with comprehensive metadata
    - Define feeds table with all required fields and enums
    - Set up unique constraint on (user_id, url)
    - Add foreign key to folders with SET NULL on delete
    - Include status tracking and ETL metadata fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.3 Write property test for feed constraint enforcement
    - **Property 4: Unique constraint enforcement (partial)**
    - **Validates: Requirements 2.1, 3.1**

  - [ ]* 3.4 Write property test for folder-feed relationships
    - **Property 5: Foreign key relationship integrity (partial)**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 3.5 Create recommended_feeds table and seed data
    - Define recommended feeds table structure
    - Create comprehensive seed data with 500+ feeds
    - Include categorization, tagging, and popularity metrics
    - Set up public RLS policy for read access
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 3.6 Write property test for recommended feeds access
    - **Property 3: User data isolation (partial)**
    - **Validates: Requirements 13.4**

- [x] 4. Implement article storage and AI features
  - [x] 4.1 Create articles table with AI enhancement fields
    - Define articles table with content and metadata fields
    - Set up unique constraint on (feed_id, guid)
    - Add AI summary and vector embedding fields
    - Include cluster relationship and timestamps
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write property test for article uniqueness
    - **Property 4: Unique constraint enforcement (partial)**
    - **Validates: Requirements 4.1, 4.6**

  - [x] 4.3 Create user_articles table for reading state
    - Define user-article relationship table
    - Set up unique constraint on (user_id, article_id)
    - Add read/starred status with timestamp tracking
    - Include engagement metrics fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 4.4 Write property test for user article state management
    - **Property 9: UPSERT behavior correctness**
    - **Validates: Requirements 5.1**

  - [ ]* 4.5 Write property test for timestamp tracking
    - **Property 7: Timestamp tracking accuracy**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 4.6 Create clusters table for AI topic grouping
    - Define clusters table with AI-generated content
    - Add article count and source tracking
    - Include timeframe and expiration fields
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

  - [ ]* 4.7 Write property test for cluster lifecycle management
    - **Property 19: Cluster lifecycle management**
    - **Validates: Requirements 9.1, 9.3, 9.4**

- [x] 5. Create AI usage and digest tracking
  - [x] 5.1 Create ai_usage table for daily limits
    - Define table for tracking daily AI operations
    - Set up unique constraint on (user_id, usage_date)
    - Add separate counters for summaries and clustering
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 5.2 Write property test for AI usage tracking
    - **Property 9: UPSERT behavior correctness (partial)**
    - **Validates: Requirements 10.1**

  - [x] 5.3 Create digest_history table for email tracking
    - Define table for digest delivery tracking
    - Add array field for included article IDs
    - Include delivery method and engagement metrics
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 5.4 Write property test for digest tracking completeness
    - **Property 20: Digest tracking completeness**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**

- [x] 6. Implement system operations and logging
  - [x] 6.1 Create feed_sync_log table with automatic cleanup
    - Define sync log table with comprehensive metrics
    - Create cleanup trigger to maintain last 100 logs per feed
    - Add indexes for performance and querying
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 6.2 Write property test for sync logging completeness
    - **Property 18: Sync logging completeness**
    - **Validates: Requirements 12.1, 12.2, 12.3**

  - [ ]* 6.3 Write property test for automatic cleanup behavior
    - **Property 14: Automatic cleanup behavior**
    - **Validates: Requirements 12.4, 12.5**

- [x] 7. Set up Row Level Security policies
  - [x] 7.1 Enable RLS on all user-specific tables
    - Enable RLS on profiles, folders, feeds, articles, user_articles
    - Enable RLS on user_settings, user_interests, clusters
    - Enable RLS on ai_usage, digest_history tables
    - _Requirements: 13.1_

  - [x] 7.2 Create comprehensive RLS policies
    - Create policies for profile access (own data only)
    - Create policies for feed management (own feeds only)
    - Create policies for article access (own subscribed feeds only)
    - Create policies for all other user-specific tables
    - _Requirements: 13.2, 13.3_

  - [ ]* 7.3 Write property test for user data isolation
    - **Property 3: User data isolation**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4**

  - [ ]* 7.4 Write property test for cascade deletion integrity
    - **Property 2: Cascade deletion integrity**
    - **Validates: Requirements 1.4, 13.5**

- [x] 8. Create database views and functions
  - [x] 8.1 Create convenience views for common queries
    - Create articles_with_feed view for joined article data
    - Create user_article_feed view for complete reading interface
    - Create folder_unread_counts view for folder statistics
    - Create feed_stats view for feed health metrics
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ]* 8.2 Write property test for view data consistency
    - **Property 12: View data consistency**
    - **Validates: Requirements 14.1, 14.2**

  - [ ]* 8.3 Write property test for aggregate calculation accuracy
    - **Property 11: Aggregate calculation accuracy**
    - **Validates: Requirements 9.5, 10.5, 14.3**

  - [x] 8.4 Create utility functions for common operations
    - Create calculate_relevancy_score function
    - Create mark_folder_read bulk operation function
    - Add any other utility functions for common patterns
    - _Requirements: 14.4, 14.5_

  - [ ]* 8.5 Write property test for bulk operation correctness
    - **Property 13: Bulk operation correctness**
    - **Validates: Requirements 14.5**

- [-] 9. Set up vector search capabilities (optional)
  - [x] 9.1 Configure pgvector extension for semantic search
    - Verify pgvector extension is available and enabled
    - Create vector indexes for article embeddings
    - Set up cosine similarity operations
    - _Requirements: 15.1, 15.2, 15.4_

  - [ ]* 9.2 Write property test for vector embedding storage
    - **Property 15: Vector embedding storage**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4**

  - [ ]* 9.3 Write property test for AI processing coordination
    - **Property 16: AI processing coordination**
    - **Validates: Requirements 4.5, 15.5**

- [x] 10. Create database indexes and optimize performance
  - [x] 10.1 Create all required indexes for performance
    - Add indexes on foreign keys and frequently queried fields
    - Create composite indexes for common query patterns
    - Add partial indexes for filtered queries (active feeds, unread articles)
    - Optimize for feed synchronization and user reading patterns

  - [x] 10.2 Set up database constraints and validation
    - Verify all foreign key constraints are properly configured
    - Test enum constraints and default values
    - Validate unique constraints across all tables
    - Ensure proper cascade behaviors

- [x] 11. Final integration testing and validation
  - [x] 11.1 Run comprehensive database tests
    - Execute all property-based tests with 100+ iterations
    - Validate all RLS policies with different user scenarios
    - Test all database functions and views
    - Verify trigger behaviors and automatic cleanup

  - [x] 11.2 Load test with realistic data volumes
    - Create test data sets with realistic article volumes
    - Test query performance with large datasets
    - Validate index effectiveness and query optimization
    - Test concurrent access patterns

  - [x] 11.3 Document database schema and usage patterns
    - Create comprehensive schema documentation
    - Document all views, functions, and common query patterns
    - Provide examples for application integration
    - Document backup and maintenance procedures

- [x] 12. Checkpoint - Ensure all tests pass, ask the user if questions arise