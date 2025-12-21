# Design Document: Authentication Fix

## Overview

This design addresses authentication issues in the Cronkite application where email login redirects back to the login page and Google OAuth returns "Unsupported provider" errors. The solution involves fixing session configuration, improving error handling, and providing clear guidance for OAuth provider setup.

## Architecture

The authentication system uses a layered approach:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ LoginForm   │  │ GoogleAuth  │  │ AuthContext         │ │
│  │             │  │ Button      │  │ (State Management)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Server                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ /api/auth/  │  │ Session     │  │ Passport.js         │ │
│  │ routes      │  │ Middleware  │  │ (Local Strategy)    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Auth        │  │ Profiles    │  │ OAuth Providers     │ │
│  │ (Users)     │  │ (Table)     │  │ (Google, etc.)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Session Configuration Fix

The current session configuration has issues with cookie settings that may prevent proper session persistence.

**Current Issue:**
```typescript
cookie: {
  secure: false, // Always false - problematic in production
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  domain: undefined,
  path: '/'
}
```

**Fixed Configuration:**
```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/'
}
```

### 2. OAuth Error Handling

Add graceful handling when Google OAuth is not configured in Supabase.

**GoogleAuthButton Enhancement:**
```typescript
const handleGoogleAuth = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile'
      }
    });

    if (error) {
      // Check for provider not enabled error
      if (error.message.includes('provider is not enabled') || 
          error.message.includes('Unsupported provider')) {
        setError('Google login is not available. Please use email/password or contact support.');
        return;
      }
      throw error;
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Google authentication failed');
  }
};
```

### 3. Login Flow Debugging

Add comprehensive logging to identify where the login flow fails.

**Enhanced Login Route:**
```typescript
app.post('/api/auth/login', requireNoAuth, (req, res, next) => {
  console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
  
  passport.authenticate('local', (err, user, info) => {
    console.log('Passport authenticate result:', { err, user: !!user, info });
    
    if (err) {
      console.error('Authentication error:', err);
      return res.status(500).json({ error: 'Authentication error', message: err.message });
    }
    
    if (!user) {
      console.log('Authentication failed:', info);
      return res.status(401).json({ error: 'Authentication failed', message: info?.message || 'Invalid credentials' });
    }
    
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('Session creation error:', loginErr);
        return res.status(500).json({ error: 'Login failed', message: 'Session creation failed' });
      }
      
      console.log('Login successful, session created:', { userId: user.id, sessionId: req.sessionID });
      res.json({ user: { id: user.id, email: user.email, display_name: user.display_name } });
    });
  })(req, res, next);
});
```

## Data Models

No changes to data models required. The existing Profile schema is sufficient.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authentication Success Establishes Session

*For any* valid email and password combination that exists in the database, authenticating with those credentials SHALL result in a session being established with a valid session cookie.

**Validates: Requirements 1.1, 1.2**

### Property 2: Authentication Redirect Based on Onboarding Status

*For any* authenticated user, the system SHALL redirect to `/onboarding` if `onboarding_completed` is false, and to `/` if `onboarding_completed` is true.

**Validates: Requirements 1.3**

### Property 3: Invalid Credentials Return Error

*For any* email/password combination where either the email doesn't exist or the password is incorrect, the authentication attempt SHALL return a 401 status with an error message.

**Validates: Requirements 1.4, 4.2**

### Property 4: Authenticated Users Redirected from Login

*For any* request to the login page with a valid session, the system SHALL redirect the user away from the login page.

**Validates: Requirements 1.5**

### Property 5: OAuth Callback Creates User and Session

*For any* valid OAuth session data, the OAuth callback handler SHALL either retrieve an existing user or create a new user, and establish a session.

**Validates: Requirements 2.3**

### Property 6: Auth Errors Logged Server-Side

*For any* authentication error, the system SHALL log the error details to the server console including error type, message, and relevant context.

**Validates: Requirements 4.1**

## Error Handling

### Authentication Errors

| Error Type | HTTP Status | User Message | Server Log |
|------------|-------------|--------------|------------|
| Invalid credentials | 401 | "Invalid email or password" | Full error details |
| User not found | 401 | "Invalid email or password" | "User not found: {email}" |
| Session creation failed | 500 | "Login failed. Please try again." | Full error with stack |
| OAuth provider disabled | 400 | "Google login is not available" | "OAuth provider not enabled" |
| OAuth callback failed | 500 | "Authentication failed. Please try again." | Full OAuth error |

### Client-Side Error Display

```typescript
// AuthContext error handling
const login = async (email: string, password: string) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Throw with server-provided message
      throw new Error(data.message || 'Login failed');
    }

    setUser(data.user);
  } catch (error) {
    console.error('Login error:', error);
    throw error; // Re-throw for component to handle
  }
};
```

## Testing Strategy

### Unit Tests

1. Test session configuration for different environments
2. Test error message formatting
3. Test OAuth error detection and handling

### Property-Based Tests

Using Vitest with fast-check for property-based testing:

1. **Property 1**: Generate random valid credentials, verify session establishment
2. **Property 2**: Generate users with different onboarding states, verify redirect
3. **Property 3**: Generate invalid credentials, verify 401 response
4. **Property 4**: Test authenticated requests to login page
5. **Property 5**: Generate OAuth session data, verify user creation/retrieval
6. **Property 6**: Generate auth errors, verify logging

### Integration Tests

1. Full login flow with valid credentials
2. Full login flow with invalid credentials
3. OAuth callback handling
4. Session persistence across requests

## Implementation Notes

### Immediate Fixes Required

1. **Session Cookie Configuration**: Update `server/auth-middleware.ts` to use environment-aware cookie settings
2. **OAuth Error Handling**: Update `client/src/components/auth/GoogleAuthButton.tsx` to handle provider-not-enabled errors gracefully
3. **Debug Logging**: Add comprehensive logging to identify where login flow fails

### Supabase Configuration (Manual Step)

To enable Google OAuth:
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add Google OAuth Client ID and Secret from Google Cloud Console
4. Configure authorized redirect URIs in Google Cloud Console
