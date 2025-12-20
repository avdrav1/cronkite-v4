# Implementation Plan: Database Configuration Fix

## Overview

This implementation plan addresses the category mismatch issue by creating a category mapping system and updating feed filtering logic. The tasks are organized to fix the immediate onboarding issue first, then add comprehensive validation and testing.

## Tasks

- [x] 1. Create category mapping service
  - Create shared category mapping module with bidirectional translation
  - Define complete mapping between frontend IDs and database categories
  - Add validation and error handling for unmapped categories
  - _Requirements: 1.2, 2.1, 2.3, 2.4, 2.5_

- [ ]* 1.1 Write property test for category mapping service
  - **Property 1: Category mapping bidirectional consistency**
  - **Validates: Requirements 1.2, 2.1, 2.3, 2.4**

- [x] 2. Update feed filtering with category mapping
  - Modify existing feed filtering to use category mapping service
  - Update filterFeedsByInterests to translate frontend categories to database categories
  - Add fallback behavior for unmapped categories with logging
  - _Requirements: 1.1, 1.5, 2.3_

- [ ]* 2.1 Write property test for interest-based filtering
  - **Property 2: Interest-based feed filtering accuracy**
  - **Validates: Requirements 1.1**

- [ ]* 2.2 Write property test for mapping fallback behavior
  - **Property 5: Fallback behavior on mapping failure**
  - **Validates: Requirements 1.5**

- [x] 3. Update API routes to use category mapping
  - Modify /api/feeds/recommended endpoint to use enhanced filtering
  - Add category translation in query parameter processing
  - Update error handling and logging for category-related issues
  - _Requirements: 1.1, 1.3, 1.4_

- [ ]* 3.1 Write unit tests for API category translation
  - Test specific examples like "tech" -> "Technology" mapping
  - Test error cases and fallback behavior
  - _Requirements: 1.3, 1.4_

- [x] 4. Checkpoint - Test onboarding flow
  - Ensure all tests pass, verify onboarding flow loads feeds correctly

- [x] 5. Update seeding scripts with category validation
  - Modify seeding scripts to use category mapping for validation
  - Add category validation before database insertion
  - Update both development (105 feeds) and production (865 feeds) seeding
  - _Requirements: 3.1, 3.2, 3.5, 5.2, 5.5_

- [ ]* 5.1 Write property test for seeding category consistency
  - **Property 3: Seeding category consistency**
  - **Validates: Requirements 3.1, 3.2, 5.2, 5.5**

- [ ]* 5.2 Write property test for seeding validation
  - **Property 8: Seeding rejection of invalid categories**
  - **Validates: Requirements 3.5**

- [x] 6. Add database storage validation
  - Update storage layer to validate categories during feed insertion
  - Add category mapping validation in SupabaseStorage and MemStorage
  - Ensure stored feeds have valid database category names
  - _Requirements: 2.2_

- [ ]* 6.1 Write property test for storage category validation
  - **Property 7: Feed storage category validation**
  - **Validates: Requirements 2.2**

- [x] 7. Enhance database connectivity fallback
  - Improve fallback behavior when database connection fails
  - Ensure MemStorage fallback uses proper category mapping
  - Add comprehensive logging for database connectivity issues
  - _Requirements: 4.4_

- [ ]* 7.1 Write property test for database fallback
  - **Property 6: Database connectivity fallback**
  - **Validates: Requirements 4.4**

- [x] 8. Add mapping completeness validation
  - Create startup validation to ensure all frontend categories have mappings
  - Add validation that seeded data covers all frontend categories
  - Implement checks for mapping consistency and completeness
  - _Requirements: 2.5, 3.3_

- [ ]* 8.1 Write property test for mapping completeness
  - **Property 4: Mapping completeness validation**
  - **Validates: Requirements 2.5, 3.3**

- [x] 9. Update npm scripts and tooling
  - Add npm scripts for database seeding with category validation
  - Create scripts to check category distribution and mapping status
  - Update existing scripts to use consistent category mapping
  - _Requirements: 5.1, 5.3, 5.4_

- [x] 10. Final integration testing
  - Run complete onboarding flow end-to-end
  - Verify feed filtering works with all category combinations
  - Test both development (105 feeds) and production (865 feeds) scenarios
  - _Requirements: All requirements_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation prioritizes fixing the immediate onboarding issue first