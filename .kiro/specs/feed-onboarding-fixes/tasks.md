# Implementation Plan: Feed Onboarding Fixes

## Overview

This implementation plan addresses three critical issues: category loss during feed subscription, missing articles after sync, and overwhelming onboarding UX. Tasks are ordered to fix the most critical data issue first (category preservation), then sync visibility, then UX improvements.

## Tasks

- [x] 1. Fix Category Preservation in Feed Subscription
  - [x] 1.1 Add folder_name column to feeds table
    - Create migration to add `folder_name TEXT` column to feeds table
    - Add index on `(user_id, folder_name)` for efficient grouping
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Modify subscribeToFeeds() to preserve category
    - Update `server/supabase-storage.ts` subscribeToFeeds function
    - Copy `category` from recommended_feeds to `folder_name` in user feeds
    - _Requirements: 1.1, 1.4_

  - [ ]* 1.3 Write property test for category preservation
    - **Property 1: Category Preservation Round-Trip**
    - **Validates: Requirements 1.1, 1.4**

  - [x] 1.4 Update getUserFeeds to include folder_name
    - Ensure the feeds query returns folder_name field
    - Update TypeScript types if needed
    - _Requirements: 1.2_

- [x] 2. Checkpoint - Verify category preservation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add Sync Progress Tracking and Visual Feedback
  - [x] 3.1 Add sync status tracking to storage layer
    - Create `getFeedSyncStatus()` method in storage
    - Track syncing/completed/failed counts per user
    - _Requirements: 2.6, 2.7_

  - [x] 3.2 Create sync status API endpoint
    - Add `GET /api/feeds/sync/status` endpoint
    - Return current sync progress for authenticated user
    - _Requirements: 2.6, 2.7_

  - [x] 3.3 Enhance sync response with detailed results
    - Modify `POST /api/feeds/sync` to return detailed results
    - Include success count, failure count, new articles count
    - _Requirements: 2.1, 2.4, 2.9_

  - [ ]* 3.4 Write property test for sync resilience
    - **Property 3: Sync Resilience**
    - **Validates: Requirements 2.4**

- [x] 4. Add Visual Feedback in UI Components
  - [x] 4.1 Add sync progress indicator to ConfirmationStep
    - Show "Syncing feeds..." with progress (e.g., "3/10 feeds")
    - Display spinner during sync
    - _Requirements: 2.6, 2.7_

  - [x] 4.2 Add loading state to Home/MasonryGrid
    - Show "Fetching your articles..." during initial load
    - Display skeleton cards while loading
    - _Requirements: 2.6_

  - [x] 4.3 Add empty state for no articles
    - Show helpful message when no articles available
    - Explain that articles will appear as feeds sync
    - _Requirements: 2.8_

  - [x] 4.4 Add error state with retry option
    - Display user-friendly error message on sync failure
    - Provide "Retry" button to re-trigger sync
    - _Requirements: 2.9_

- [x] 5. Checkpoint - Verify sync feedback
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Improve Onboarding Feed Selection UX
  - [x] 6.1 Sort feeds by featured status and popularity
    - Featured feeds first, then by popularity_score descending
    - Apply sorting in feed selection component
    - _Requirements: 3.1_

  - [ ]* 6.2 Write property test for feed ordering
    - **Property 5: Featured Feed Priority**
    - **Validates: Requirements 3.1**

  - [x] 6.3 Implement 6-feed initial limit with "Show more"
    - Show only top 6 feeds per category initially
    - Add "Show more" button to reveal remaining feeds
    - _Requirements: 3.2, 3.3_

  - [ ]* 6.4 Write property test for feed display limit
    - **Property 6: Initial Feed Display Limit**
    - **Validates: Requirements 3.2**

  - [x] 6.5 Add search/filter input for feeds
    - Add search input above feed list
    - Filter feeds by name and description
    - _Requirements: 3.4_

  - [x] 6.6 Enhance feed card display
    - Show feed name, description, and popularity indicator
    - Add visual badge for featured feeds
    - _Requirements: 3.5, 3.6_

  - [ ]* 6.7 Write property test for feed card content
    - **Property 7: Feed Card Content Completeness**
    - **Validates: Requirements 3.5**

- [x] 7. Final Checkpoint - Full integration test
  - Ensure all tests pass, ask the user if questions arise.
  - Test complete onboarding flow end-to-end
  - Verify feeds appear with correct categories in sidebar

## Notes

- Tasks marked with `*` are optional property-based tests
- The `folder_name` column approach is simpler than using the `folders` table with joins
- Sync progress uses polling rather than WebSockets for simplicity
- Property tests use `fast-check` library for TypeScript
