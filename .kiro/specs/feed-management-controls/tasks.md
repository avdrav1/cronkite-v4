# Implementation Plan: Feed Management Controls

## Overview

This implementation plan covers the feed management controls feature including manual feed synchronization, feed subscription limits, feed deletion, article state persistence, and engagement signal tracking. The implementation builds on the existing Express.js/Supabase architecture.

## Tasks

- [x] 1. Database Schema Updates
  - [x] 1.1 Add engagement signal columns to user_articles table
    - Add migration file for engagement_signal and engagement_signal_at columns
    - Add CHECK constraint for valid signal values ('positive', 'negative')
    - Create index for efficient engagement queries
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.2 Update TypeScript schema definitions
    - Add engagement_signal and engagement_signal_at to userArticles schema
    - Update UserArticle type exports
    - Add MAX_FEEDS_PER_USER constant (25)
    - _Requirements: 3.1, 8.1_

- [x] 2. Storage Layer Implementation
  - [x] 2.1 Implement feed count methods in storage interface
    - Add getUserFeedCount method to IStorage interface
    - Implement in MemStorage class
    - Implement in SupabaseStorage class
    - _Requirements: 5.1, 5.2_

  - [x] 2.2 Implement subscription with limit checking
    - Add subscribeToFeedsWithLimit method to IStorage
    - Implement limit validation before subscription
    - Return detailed result with subscribed/rejected feeds
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ]* 2.3 Write property test for feed limit enforcement
    - **Property 5: Feed Limit Enforcement Invariant**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [x] 2.4 Implement article state management methods
    - Add markArticleRead method
    - Add markArticleStarred method
    - Add getStarredArticles method
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3_

  - [ ]* 2.5 Write property tests for article state round trips
    - **Property 9: Read State Round Trip**
    - **Property 10: Starred State Round Trip**
    - **Validates: Requirements 6.1, 6.2, 6.5, 7.1, 7.2, 7.5**

  - [x] 2.6 Implement engagement signal methods
    - Add setEngagementSignal method
    - Add getArticlesWithEngagement method
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 2.7 Write property test for engagement signal management
    - **Property 13: Engagement Signal State Management**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6**

- [x] 3. Checkpoint - Storage Layer Complete
  - Ensure all storage tests pass, ask the user if questions arise.

- [x] 4. API Routes Implementation
  - [x] 4.1 Implement single feed sync endpoint
    - Add POST /api/feeds/:feedId/sync route
    - Validate feed ownership
    - Return detailed sync results
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 4.2 Write property test for single feed sync
    - **Property 1: Single Feed Sync Isolation**
    - **Property 3: Feed Sync Timestamp Update**
    - **Validates: Requirements 1.1, 1.2, 1.5**

  - [x] 4.3 Implement bulk sync endpoint
    - Add POST /api/feeds/sync-all route
    - Process feeds in batches
    - Return aggregate results
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.4 Write property test for bulk sync
    - **Property 4: Bulk Sync Completeness**
    - **Validates: Requirements 2.1, 2.3**

  - [x] 4.5 Implement feed count endpoint
    - Add GET /api/feeds/count route
    - Return currentCount, maxAllowed, remaining, isNearLimit
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 4.6 Write property test for feed count response
    - **Property 8: Feed Count Response Structure**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 4.7 Update subscription endpoint with limit enforcement
    - Modify POST /api/feeds/subscribe to check limits
    - Return appropriate error when limit exceeded
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.8 Implement article read state endpoint
    - Add PUT /api/articles/:articleId/read route
    - Handle both marking read and unread
    - _Requirements: 6.1, 6.2_

  - [x] 4.9 Implement article star state endpoint
    - Add PUT /api/articles/:articleId/star route
    - Handle both starring and unstarring
    - _Requirements: 7.1, 7.2_

  - [x] 4.10 Implement starred articles endpoint
    - Add GET /api/articles/starred route
    - Return paginated starred articles
    - _Requirements: 7.3_

  - [ ]* 4.11 Write property test for starred articles filter
    - **Property 12: Starred Articles Filter**
    - **Validates: Requirements 7.3**

  - [x] 4.12 Implement engagement signal endpoint
    - Add PUT /api/articles/:articleId/engagement route
    - Handle positive, negative, and null signals
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 5. Checkpoint - API Routes Complete
  - Ensure all API tests pass, ask the user if questions arise.

- [x] 6. Authorization and Validation
  - [x] 6.1 Implement feed ownership validation
    - Add helper to verify user owns feed before operations
    - Apply to sync and delete endpoints
    - _Requirements: 4.4_

  - [ ]* 6.2 Write property test for feed ownership
    - **Property 7: Feed Ownership Authorization**
    - **Validates: Requirements 4.4**

  - [x] 6.3 Implement user state isolation
    - Ensure all article state queries filter by user_id
    - Verify RLS policies are in place
    - _Requirements: 6.4, 7.4_

  - [ ]* 6.4 Write property test for user isolation
    - **Property 11: User State Isolation**
    - **Validates: Requirements 6.4, 7.4**

- [x] 7. Client-Side Integration
  - [x] 7.1 Add sync button to feed list UI
    - Add sync icon button to each feed item
    - Add "Sync All" button to feed list header
    - Show loading state during sync
    - _Requirements: 1.4, 2.4_

  - [x] 7.2 Add feed count display to settings
    - Show current/max feed count
    - Display warning when near limit
    - _Requirements: 5.3, 5.4_

  - [x] 7.3 Add read/starred toggle to article cards
    - Add read indicator (filled/unfilled circle)
    - Add star toggle button
    - Persist state on click
    - _Requirements: 6.1, 6.2, 7.1, 7.2_

  - [x] 7.4 Add engagement buttons to article cards
    - Add thumbs up/down buttons
    - Show current engagement state
    - Update on click
    - _Requirements: 8.1, 8.2, 8.6_

  - [x] 7.5 Add starred articles view
    - Add "Starred" filter option
    - Display only starred articles when selected
    - _Requirements: 7.3_

- [x] 8. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The existing unsubscribe endpoint (DELETE /api/feeds/unsubscribe/:id) already exists and may need minor updates
