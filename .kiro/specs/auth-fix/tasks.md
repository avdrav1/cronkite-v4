# Implementation Plan: Authentication Fix

## Overview

This implementation plan addresses authentication issues where email login redirects back to the login page and Google OAuth returns "Unsupported provider" errors. The fixes involve session configuration, error handling improvements, and debug logging.

## Tasks

- [x] 1. Fix session cookie configuration for environment-aware settings
  - Update `server/auth-middleware.ts` to use secure cookies in production
  - Configure SameSite attribute based on environment
  - Add trust proxy setting for production deployments
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Add debug logging to authentication flow
  - [x] 2.1 Add logging to login route in `server/routes.ts`
    - Log authentication attempts with email (not password)
    - Log passport authenticate results
    - Log session creation success/failure
    - _Requirements: 4.1_

  - [x] 2.2 Add logging to AuthContext in `client/src/contexts/AuthContext.tsx`
    - Log API response status and errors
    - Log user state changes
    - _Requirements: 4.1_

- [x] 3. Improve OAuth error handling
  - [x] 3.1 Update `client/src/components/auth/GoogleAuthButton.tsx`
    - Detect "provider not enabled" errors
    - Display user-friendly message when OAuth is unavailable
    - _Requirements: 2.2, 4.3_

  - [x] 3.2 Update OAuth callback error handling in `server/routes.ts`
    - Add detailed error logging for OAuth failures
    - Return appropriate error messages
    - _Requirements: 2.4, 4.1_

- [x] 4. Checkpoint - Test authentication flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add authentication property tests
  - [ ]* 5.1 Write property test for valid credentials authentication
    - **Property 1: Authentication Success Establishes Session**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 5.2 Write property test for invalid credentials error handling
    - **Property 3: Invalid Credentials Return Error**
    - **Validates: Requirements 1.4, 4.2**

  - [ ]* 5.3 Write property test for auth error logging
    - **Property 6: Auth Errors Logged Server-Side**
    - **Validates: Requirements 4.1**

- [ ] 6. Final checkpoint - Verify authentication works
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Google OAuth "provider not enabled" error requires manual Supabase configuration
- Session cookie changes may require clearing browser cookies to test
- Property tests validate universal correctness properties
