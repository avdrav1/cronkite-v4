# Implementation Plan: Left Navigation & Flagship Feeds

## Overview

This implementation replaces hardcoded mock data in the left sidebar with dynamic user subscription data and identifies flagship feeds for priority maintenance.

## Tasks

- [ ] 1. Create useFeedsQuery hook for fetching user feeds
  - Create `client/src/hooks/useFeedsQuery.ts`
  - Use TanStack Query with queryKey `['user-feeds']`
  - Call `/api/feeds/user` endpoint
  - Configure 5-minute stale time for caching
  - _Requirements: 3.1, 5.3_

- [ ] 2. Create FeedsList component
  - [ ] 2.1 Create `client/src/components/layout/FeedsList.tsx`
    - Import useFeedsQuery hook
    - Implement feed grouping by category
    - Render collapsible CategoryFolder components
    - Render FeedItem components within folders
    - _Requirements: 3.2_

  - [ ] 2.2 Implement empty state for no subscriptions
    - Show prompt to add feeds when user has no subscriptions
    - Link to onboarding flow
    - _Requirements: 3.5_

  - [ ]* 2.3 Write property test for feed grouping
    - **Property 1: Feed Grouping Preserves All Feeds**
    - **Validates: Requirements 3.2**

- [ ] 3. Remove hardcoded mock data from AppShell
  - [ ] 3.1 Remove hardcoded FolderItem components
    - Remove `<FolderItem label="Tech" ...>` and children
    - Remove `<FolderItem label="News" ...>` and children
    - _Requirements: 2.1, 2.2_

  - [ ] 3.2 Remove hardcoded article counts
    - Remove `count={42}` from "All Articles" NavItem
    - Remove `count={12}` from "Unread" NavItem
    - Remove `count={5}` from "Starred" NavItem
    - _Requirements: 2.3_

  - [ ] 3.3 Integrate FeedsList component into AppShell
    - Import and render FeedsList in sidebar
    - Pass navigation handlers for feed/category selection
    - _Requirements: 3.1_

- [ ] 4. Implement feed and category filtering
  - [ ] 4.1 Update FeedItem click handler
    - Navigate to `/?source={feedName}` on click
    - _Requirements: 3.3_

  - [ ] 4.2 Update CategoryFolder click handler
    - Navigate to `/?category={categoryName}` on click
    - _Requirements: 3.4_

  - [ ] 4.3 Implement active state highlighting
    - Parse URL parameters to determine active feed/category
    - Apply active styling to selected item
    - _Requirements: 4.1_

- [ ] 5. Implement navigation state management
  - [ ] 5.1 Clear filters on "All Articles" click
    - Navigate to `/` without query parameters
    - _Requirements: 4.2_

  - [ ] 5.2 Persist category folder expansion state
    - Use useState or localStorage for folder states
    - Remember expanded/collapsed during session
    - _Requirements: 4.4_

- [ ] 6. Implement real-time subscription updates
  - [ ] 6.1 Invalidate feeds query on subscription change
    - Call `queryClient.invalidateQueries(['user-feeds'])` after subscribe
    - Call `queryClient.invalidateQueries(['user-feeds'])` after unsubscribe
    - _Requirements: 5.1, 5.2_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Update flagship feeds in database
  - [ ] 8.1 Review current is_featured flags in recommended_feeds
    - Query database to see current flagship count
    - _Requirements: 1.1_

  - [ ] 8.2 Ensure ~100 feeds are marked as flagship
    - Update is_featured flag for major sources
    - Cover all major categories
    - _Requirements: 1.1, 1.3_

- [ ] 9. Final checkpoint - Verify integration
  - Test sidebar with real user subscriptions
  - Verify filtering works correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
