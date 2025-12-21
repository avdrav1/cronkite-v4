# Implementation Plan: Authentication Fix

## Overview

This implementation plan addresses authentication issues where email login redirects back to the login page and Google OAuth returns "Unsupported provider" errors. The fixes involve session configuration, error handling improvements, and debug logging.

## Current Status: BLOCKED - Awaiting Netlify Environment Configuration

**Root Cause Identified:** The 502 errors are caused by missing/invalid Netlify environment variables. Build logs showed `SUPABASE_ANON_KEY` with length 21 - valid JWT keys are 100+ characters starting with `eyJ`.

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

- [x] 5. Fix Netlify serverless function handler
  - [x] 5.1 Replace custom request/response handling with serverless-http
    - Install serverless-http package
    - Update netlify-handler.ts to use serverless-http
    - Add serverless-http to build allowlist
    - _Fixes: 502 errors on /api/auth/login_

  - [x] 5.2 Fix async storage initialization in auth-middleware
    - Update passport strategies to use async getStorage()
    - Fix handleSupabaseAuth to use async storage
    - _Fixes: Storage not initialized errors_

  - [x] 5.3 Fix type errors in routes.ts
    - Update registerRoutes signature to accept null httpServer
    - Fix parameter types for Netlify compatibility
    - _Fixes: TypeScript compilation errors_

- [ ] 6. **USER ACTION REQUIRED: Configure Netlify Environment Variables**
  - Go to https://app.netlify.com/projects/cronkite-v4/settings/env
  - Set the following environment variables:
    - `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
    - `SUPABASE_ANON_KEY` - Your Supabase anon key (starts with `eyJ...`, 100+ chars)
    - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
    - `SESSION_SECRET` - A randomly generated secret (run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
    - `APP_URL` - `https://cronkite-v4.netlify.app`
  - After setting variables, trigger a new deploy

- [ ] 7. **USER ACTION REQUIRED: Enable Google OAuth in Supabase**
  - Go to your Supabase project → Authentication → Providers → Google
  - Enable the Google provider
  - Configure Google OAuth credentials (Client ID and Secret)

- [ ]* 8. Add authentication property tests (optional)
  - [ ]* 8.1 Write property test for valid credentials authentication
    - **Property 1: Authentication Success Establishes Session**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 8.2 Write property test for invalid credentials error handling
    - **Property 3: Invalid Credentials Return Error**
    - **Validates: Requirements 1.4, 4.2**

  - [ ]* 8.3 Write property test for auth error logging
    - **Property 6: Auth Errors Logged Server-Side**
    - **Validates: Requirements 4.1**

- [ ] 9. Final checkpoint - Verify authentication works
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Google OAuth "provider not enabled" error requires manual Supabase configuration
- Session cookie changes may require clearing browser cookies to test
- Property tests validate universal correctness properties
- **Important**: Session-based auth in serverless has limitations - sessions don't persist between function invocations. For production, consider JWT-based auth or using Supabase Auth directly.

## Quick Reference: Environment Variables Needed

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | `eyJhbGciOiJIUzI1NiIs...` (100+ chars) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIs...` (100+ chars) |
| `SESSION_SECRET` | Random secret for sessions | 64-char hex string |
| `APP_URL` | Production app URL | `https://cronkite-v4.netlify.app` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:...` |

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Google OAuth "provider not enabled" error requires manual Supabase configuration
- Session cookie changes may require clearing browser cookies to test
- Property tests validate universal correctness properties
- **Important**: Session-based auth in serverless has limitations - sessions don't persist between function invocations. For production, consider JWT-based auth or using Supabase Auth directly.
