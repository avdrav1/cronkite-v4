# Implementation Plan: Session Management Fix

## Overview

This implementation plan addresses the session management issue where users cannot log in when stale session cookies exist. The fix enhances the authentication middleware to validate session integrity and automatically clear invalid sessions.

## Tasks

- [x] 1. Add session validation utilities
  - [x] 1.1 Create `isValidSession` helper function in auth-middleware.ts
    - Check if `req.isAuthenticated()` returns true
    - Verify `req.user` exists and has required fields (id, email)
    - Return boolean indicating session validity
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Create `validateSession` function with detailed result
    - Return object with `isValid` boolean and `reason` string
    - Reasons: 'not_authenticated', 'missing_user', 'invalid_user_data', 'valid'
    - Export for use in other middleware
    - _Requirements: 2.1, 2.2, 4.1_

  - [x] 1.3 Create `clearInvalidSession` async helper function
    - Call `req.logout()` to clear Passport session
    - Call `req.session.destroy()` to destroy Express session
    - Clear session cookie with `res.clearCookie('cronkite.sid')`
    - Handle errors gracefully with logging
    - _Requirements: 1.2, 1.3, 3.1_

- [-] 2. Enhance requireNoAuth middleware
  - [x] 2.1 Update `requireNoAuth` to be async and validate session integrity
    - If not authenticated, proceed immediately
    - If authenticated, call `isValidSession` to check validity
    - If invalid, call `clearInvalidSession` and proceed
    - If valid, return 400 error (already logged in)
    - _Requirements: 1.1, 3.1, 3.2_

  - [ ]* 2.2 Write property test for session validation consistency
    - **Property 1: Session Validation Consistency**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.3 Write property test for invalid session clearing
    - **Property 2: Invalid Session Clearing**
    - **Validates: Requirements 1.1, 1.2, 3.1**

  - [ ]* 2.4 Write property test for valid session blocking
    - **Property 3: Valid Session Blocking**
    - **Validates: Requirements 4.1**

- [x] 3. Enhance Passport deserializer
  - [x] 3.1 Update `passport.deserializeUser` to handle missing users
    - If user not found in database, return `done(null, false)`
    - Log the invalidation for debugging
    - Handle database errors gracefully, return `done(null, false)`
    - _Requirements: 4.2, 4.3_

  - [ ]* 3.2 Write property test for deserializer graceful handling
    - **Property 4: Deserializer Graceful Handling**
    - **Validates: Requirements 4.2, 4.3**

- [x] 4. Checkpoint - Verify session management fixes
  - Ensure all tests pass, ask the user if questions arise.
  - Test login flow with stale cookies manually

- [x] 5. Add integration tests
  - [x]* 5.1 Write integration test for login with stale session
    - Create session, simulate invalid state, attempt login
    - Verify login succeeds after auto-clear
    - _Requirements: 1.1, 3.1_

  - [x]* 5.2 Write integration test for login with valid session
    - Create valid session, attempt login
    - Verify 400 error is returned
    - _Requirements: 4.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The fix is backward compatible - valid sessions continue to work as before
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
