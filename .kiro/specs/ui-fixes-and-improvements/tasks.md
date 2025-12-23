# Implementation Plan: UI Fixes and Improvements

## Overview

This plan addresses four UI/UX issues: custom feed 500 error, button visibility, button separation, and trending card integration. Tasks are ordered to fix the most impactful issues first.

## Tasks

- [x] 1. Fix ArticleCard button visibility
  - [x] 1.1 Make Star button always visible
    - Remove `opacity-0 group-hover:opacity-100` classes from Star button
    - Keep the filled/outline state logic intact
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 1.2 Make Remove button always visible
    - Remove `opacity-0 group-hover:opacity-100` classes from Remove button
    - _Requirements: 2.2_
  - [x] 1.3 Make Engagement buttons always visible
    - Remove `opacity-0 group-hover:opacity-100` classes from thumbs up/down buttons
    - _Requirements: 3.6, 3.7_

- [-] 2. Reorganize ArticleCard button layout
  - [x] 2.1 Separate engagement buttons from star/remove
    - Create left-aligned group for thumbs up/down
    - Create right-aligned group for star and remove
    - Use flexbox with justify-between for separation
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 2.2 Write unit tests for button layout
    - Test DOM structure has correct button grouping
    - Test all buttons are visible without hover
    - _Requirements: 2.1, 2.2, 3.1, 3.6_

- [x] 3. Checkpoint - Verify ArticleCard changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix custom feed backend endpoint
  - [x] 4.1 Implement feed URL validation
    - Fetch the URL and verify it's valid RSS/Atom
    - Parse feed metadata (title, description)
    - Return validation result with feed details
    - _Requirements: 1.1, 1.5_
  - [x] 4.2 Implement custom feed database persistence
    - Add createCustomFeed method to storage interface
    - Insert feed into recommended_feeds table with is_custom flag
    - Return created feed with generated ID
    - _Requirements: 1.2, 1.3_
  - [x] 4.3 Update /api/feeds/custom endpoint
    - Call validation first
    - Persist to database on success
    - Return feed ID and details
    - _Requirements: 1.3, 1.4, 1.6_
  - [ ]* 4.4 Write property test for custom feed round trip
    - **Property 1: Custom Feed Round Trip**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 5. Checkpoint - Verify custom feed flow
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Verify trending card integration
  - [x] 6.1 Verify clusters API endpoint exists and returns data
    - Check /api/clusters endpoint
    - Ensure it returns trending cluster data
    - _Requirements: 4.1_
  - [x] 6.2 Verify mixed feed logic in Home page
    - Confirm createMixedFeed function works correctly
    - Verify trending cards are inserted at correct intervals
    - _Requirements: 4.2, 4.3_
  - [x] 6.3 Verify filter exclusion of trending cards
    - Confirm trending cards are hidden when filtering by source/category
    - Confirm trending cards are hidden when filtering by status
    - _Requirements: 4.5, 4.6_
  - [ ]* 6.4 Write property test for trending card insertion
    - **Property 4: Trending Card Insertion Frequency**
    - **Validates: Requirements 4.1, 4.2**

- [x] 7. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The ArticleCard changes (tasks 1-2) are purely frontend and can be tested visually
- The custom feed fix (task 4) requires backend changes and database access
- The trending card verification (task 6) may reveal the feature is already working
