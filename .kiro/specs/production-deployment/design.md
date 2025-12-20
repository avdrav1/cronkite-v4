# Design Document: Production Deployment

## Overview

This design outlines the architecture and implementation strategy for deploying Cronkite to production on Netlify with OAuth authentication and real RSS feed integration. The system will transition from development mock data to a fully functional production environment with secure authentication, automated feed synchronization, and proper environment configuration.

## Architecture

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Netlify Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Static Assets   │         │  Netlify         │          │
│  │  (React SPA)     │◄────────┤  Functions       │          │
│  │                  │         │  (API Routes)    │          │
│  └──────────────────┘         └──────────────────┘          │
│           │                            │                     │
│           │                            │                     │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            │                            ▼
            │                   ┌─────────────────┐
            │                   │   Supabase      │
            │                   │   Production    │
            │                   │   Database      │
            │                   └─────────────────┘
            │                            │
            ▼                            │
    ┌──────────────────┐                │
    │  OAuth Provider  │                │
    │  (Google)        │◄───────────────┘
    └──────────────────┘
```

### Component Architecture

1. **Frontend (React SPA)**
   - Served as static assets from Netlify CDN
   - Client-side routing with Wouter
   - OAuth flow initiation
   - API communication via fetch

2. **Backend (Netlify Functions)**
   - Express.js API routes deployed as serverless functions
   - Session management with secure cookies
   - OAuth callback handling
   - RSS feed synchronization endpoints

3. **Database (Supabase Production)**
   - PostgreSQL with pgvector extension
   - Row Level Security (RLS) policies
   - User profiles and authentication
   - Feed and article storage

4. **Authentication Flow**
   - Supabase Auth for OAuth providers
   - Session-based authentication with secure cookies
   - JWT token validation for API requests

## Components and Interfaces

### 1. Netlify Configuration

**File: `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist/public"
  functions = "dist/functions"

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--legacy-peer-deps"

# Serverless function configuration
[functions]
  node_bundler = "esbuild"
  external_node_modules = ["express", "pg"]

# SPA redirect for client-side routing
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

### 2. Build System Modifications

**File: `script/build.ts`**

The build script needs to be enhanced to:
- Build frontend assets to `dist/public`
- Build backend as Netlify function to `dist/functions/api.js`
- Bundle all dependencies for serverless environment
- Copy necessary files (migrations, etc.)

**Build Process:**
```typescript
interface BuildConfig {
  frontend: {
    entry: 'client/src/main.tsx',
    outDir: 'dist/public',
    format: 'esm'
  },
  backend: {
    entry: 'server/index.ts',
    outDir: 'dist/functions',
    format: 'cjs',
    platform: 'node',
    external: ['pg-native']
  }
}
```

### 3. OAuth Integration

**Supabase OAuth Configuration:**

```typescript
// shared/supabase.ts
export const supabaseConfig = {
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  auth: {
    redirectTo: `${process.env.APP_URL}/auth/callback`,
    providers: ['google'],
    flowType: 'pkce' // Proof Key for Code Exchange
  }
}
```

**OAuth Flow:**

1. **Initiation** (Client-side)
   ```typescript
   const { data, error } = await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       redirectTo: `${window.location.origin}/auth/callback`,
       scopes: 'email profile'
     }
   })
   ```

2. **Callback Handling** (Client-side)
   ```typescript
   // /auth/callback route
   const { data: { session }, error } = await supabase.auth.getSession()
   if (session) {
     // Send session to backend for profile creation
     await fetch('/api/auth/oauth/callback', {
       method: 'POST',
       body: JSON.stringify({ session }),
       credentials: 'include'
     })
   }
   ```

3. **Profile Creation** (Server-side)
   ```typescript
   // server/routes.ts - /api/auth/oauth/callback
   async (req, res) => {
     const { session } = req.body
     const user = await supabase.auth.getUser(session.access_token)
     
     // Create or update profile
     const profile = await storage.upsertUserFromOAuth(user)
     
     // Create session
     req.login(profile, (err) => {
       if (err) return res.status(500).json({ error: 'Session creation failed' })
       res.json({ user: profile })
     })
   }
   ```

### 4. Environment Configuration

**Required Environment Variables:**

**Production (.env.production):**
```bash
# Supabase Production
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=[production-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[production-service-role-key]

# Database
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Application
NODE_ENV=production
APP_URL=https://cronkite.netlify.app
SESSION_SECRET=[generated-secret-key]

# OAuth
GOOGLE_CLIENT_ID=[google-oauth-client-id]
GOOGLE_CLIENT_SECRET=[google-oauth-client-secret]

# RSS Sync
RSS_SYNC_INTERVAL=3600000  # 1 hour in milliseconds
RSS_SYNC_BATCH_SIZE=5
RSS_SYNC_MAX_ARTICLES=100
```

**Netlify Environment Variables Setup:**
- Configure via Netlify Dashboard → Site Settings → Environment Variables
- All secrets should be marked as "Sensitive"
- Use different values for preview and production deployments

### 5. Production Feed Configuration

**Feed Management Strategy:**

```typescript
// server/production-feeds.ts
export interface ProductionFeedConfig {
  id: string
  name: string
  url: string
  category: string
  syncInterval: 'hourly' | 'daily' | 'weekly'
  priority: 'high' | 'medium' | 'low'
  enabled: boolean
}

export const PRODUCTION_FEEDS: ProductionFeedConfig[] = [
  // High-priority feeds (sync hourly)
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'tech',
    syncInterval: 'hourly',
    priority: 'high',
    enabled: true
  },
  {
    id: 'bbc-news',
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    category: 'news',
    syncInterval: 'hourly',
    priority: 'high',
    enabled: true
  },
  // ... more feeds
]
```

**Feed Synchronization Service:**

```typescript
// server/feed-sync-service.ts
export class FeedSyncService {
  private syncInterval: NodeJS.Timeout | null = null
  
  async start() {
    // Initial sync on startup
    await this.syncAllFeeds()
    
    // Schedule periodic syncs
    const interval = parseInt(process.env.RSS_SYNC_INTERVAL || '3600000')
    this.syncInterval = setInterval(() => this.syncAllFeeds(), interval)
  }
  
  async syncAllFeeds() {
    const feeds = await storage.getActiveFeeds()
    const results = await syncFeeds(feeds, {
      batchSize: parseInt(process.env.RSS_SYNC_BATCH_SIZE || '5'),
      maxArticles: parseInt(process.env.RSS_SYNC_MAX_ARTICLES || '100'),
      respectEtag: true,
      respectLastModified: true
    })
    
    // Log sync results
    console.log(`Feed sync completed: ${results.length} feeds processed`)
  }
  
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }
}
```

### 6. Database Migration Strategy

**Migration Execution:**

```typescript
// server/startup-validation.ts
export async function runProductionMigrations() {
  // Check if migrations are needed
  const migrationsNeeded = await checkMigrationStatus()
  
  if (migrationsNeeded) {
    console.log('Running database migrations...')
    // Migrations are handled by Supabase CLI
    // This function validates they've been applied
    await validateMigrations()
  }
  
  // Seed recommended feeds if table is empty
  const feedCount = await storage.getRecommendedFeedCount()
  if (feedCount === 0) {
    console.log('Seeding recommended feeds...')
    await seedRecommendedFeeds()
  }
}
```

## Data Models

### User Profile (Extended)

```typescript
interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  timezone: string
  region_code: string | null
  onboarding_completed: boolean
  oauth_provider: 'google' | 'github' | 'email' | null
  oauth_provider_id: string | null
  created_at: Date
  updated_at: Date
}
```

### Feed Configuration

```typescript
interface Feed {
  id: string
  name: string
  url: string
  site_url: string | null
  description: string | null
  icon_url: string | null
  category: string
  last_synced_at: Date | null
  sync_status: 'active' | 'error' | 'disabled'
  sync_error: string | null
  etag: string | null
  last_modified: string | null
  created_at: Date
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: OAuth Authentication Round Trip
*For any* valid OAuth provider response, completing the OAuth flow and then checking authentication status should result in an authenticated user session with matching user data.

**Validates: Requirements 2.2, 2.3**

### Property 2: Environment Configuration Completeness
*For any* production deployment, all required environment variables should be present and valid before the application starts serving requests.

**Validates: Requirements 4.3, 4.4**

### Property 3: Feed Synchronization Idempotence
*For any* RSS feed, synchronizing the same feed content multiple times should not create duplicate articles in the database.

**Validates: Requirements 3.4**

### Property 4: API Route Proxying
*For any* API request to `/api/*`, Netlify should correctly proxy the request to the serverless function without 404 errors.

**Validates: Requirements 1.3**

### Property 5: SPA Route Handling
*For any* valid application route, navigating to that route should serve the correct page content without 404 errors.

**Validates: Requirements 1.2, 1.6**

### Property 6: User Flow Routing
*For any* user authentication state (new vs returning), the system should route to the appropriate destination (onboarding vs main feed).

**Validates: Requirements 5.1, 5.7**

### Property 7: Feed Content Production Mode
*For any* user viewing their feed after onboarding, the system should display real articles from production feeds, not mock data.

**Validates: Requirements 3.6, 5.4**

### Property 8: Authentication State Persistence
*For any* authenticated user, making multiple API requests with the same session should maintain authentication state without requiring re-authentication.

**Validates: Requirements 2.4, 2.5**

### Property 9: User Preference Persistence
*For any* user updating their feed preferences in settings, the changes should be reflected in their feed content on subsequent page loads.

**Validates: Requirements 5.5, 5.6**

### Property 10: Feed Sync Error Resilience
*For any* RSS feed that fails to sync, the system should log the error, continue processing other feeds, and not crash the sync service.

**Validates: Requirements 3.5**

### Property 11: Secret Security
*For any* environment configuration, secrets should never be exposed in client-side code, logs, or error messages.

**Validates: Requirements 4.2, 4.6**

### Property 12: Feed Processing Completeness
*For any* valid RSS/Atom feed content, the system should successfully parse and store articles with proper categorization.

**Validates: Requirements 3.2, 3.3**

## Error Handling

### OAuth Errors

```typescript
enum OAuthErrorType {
  PROVIDER_ERROR = 'oauth_provider_error',
  CALLBACK_ERROR = 'oauth_callback_error',
  PROFILE_CREATION_ERROR = 'profile_creation_error',
  SESSION_ERROR = 'session_creation_error'
}

interface OAuthError {
  type: OAuthErrorType
  message: string
  provider: string
  details?: any
}
```

**Error Handling Strategy:**
- Display user-friendly error messages
- Log detailed errors for debugging
- Provide retry mechanisms for transient failures
- Fallback to email/password authentication if OAuth fails

### Feed Sync Errors

```typescript
enum FeedSyncErrorType {
  NETWORK_ERROR = 'network_error',
  PARSE_ERROR = 'parse_error',
  VALIDATION_ERROR = 'validation_error',
  DATABASE_ERROR = 'database_error'
}

interface FeedSyncError {
  type: FeedSyncErrorType
  feedId: string
  feedUrl: string
  message: string
  httpStatusCode?: number
  retryable: boolean
}
```

**Error Handling Strategy:**
- Log all sync errors to database
- Implement exponential backoff for retries
- Disable feeds after consecutive failures (threshold: 10)
- Send alerts for critical feed failures
- Continue processing other feeds on individual failures

### Environment Configuration Errors

```typescript
class ConfigurationError extends Error {
  constructor(
    public missingVars: string[],
    public invalidVars: string[]
  ) {
    super(`Configuration error: Missing ${missingVars.length} required variables`)
  }
}
```

**Error Handling Strategy:**
- Fail fast on startup if required variables are missing
- Provide clear error messages indicating which variables are missing
- Validate variable formats (URLs, keys, etc.)
- Never expose secrets in error messages or logs

## Testing Strategy

### Unit Tests

**Focus Areas:**
- OAuth callback parsing and validation
- Feed URL validation and parsing
- Environment variable validation
- Session cookie configuration
- Build script output verification

**Example Tests:**
```typescript
describe('OAuth Integration', () => {
  it('should parse Google OAuth callback correctly', () => {
    const callback = parseOAuthCallback(mockGoogleResponse)
    expect(callback).toHaveProperty('access_token')
    expect(callback).toHaveProperty('user')
  })
  
  it('should handle OAuth errors gracefully', () => {
    const error = parseOAuthCallback(mockErrorResponse)
    expect(error).toBeInstanceOf(OAuthError)
  })
})

describe('Environment Configuration', () => {
  it('should validate all required variables are present', () => {
    const result = validateEnvironment(mockEnv)
    expect(result.valid).toBe(true)
  })
  
  it('should identify missing required variables', () => {
    const result = validateEnvironment(incompleteEnv)
    expect(result.missingVars).toContain('SUPABASE_URL')
  })
})
```

### Property-Based Tests

**Configuration:**
- Use `fast-check` library for property testing
- Minimum 100 iterations per property test
- Each test references its design document property

**Property Test Examples:**

```typescript
import fc from 'fast-check'

// Feature: production-deployment, Property 1: OAuth Authentication Round Trip
describe('Property 1: OAuth Round Trip', () => {
  it('should maintain user data through OAuth flow', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          avatar: fc.webUrl()
        }),
        async (userData) => {
          // Simulate OAuth flow
          const session = await simulateOAuthFlow(userData)
          const profile = await checkAuthStatus(session.cookie)
          
          // Verify data consistency
          expect(profile.email).toBe(userData.email)
          expect(profile.display_name).toBe(userData.name)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: production-deployment, Property 3: Feed Synchronization Idempotence
describe('Property 3: Feed Sync Idempotence', () => {
  it('should not create duplicates on repeated syncs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          feedUrl: fc.webUrl(),
          articles: fc.array(fc.record({
            guid: fc.uuid(),
            title: fc.string(),
            url: fc.webUrl()
          }), { minLength: 1, maxLength: 10 })
        }),
        async (feedData) => {
          // Sync feed multiple times
          await syncFeed(feedData.feedUrl)
          const count1 = await getArticleCount(feedData.feedUrl)
          
          await syncFeed(feedData.feedUrl)
          const count2 = await getArticleCount(feedData.feedUrl)
          
          // Article count should not increase
          expect(count2).toBe(count1)
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Integration Tests

**Test Scenarios:**
1. Complete OAuth flow from initiation to profile creation
2. Feed sync from URL fetch to database storage
3. User onboarding flow from login to personalized feed
4. Session management across multiple requests
5. Build and deployment artifact generation

**Example Integration Test:**
```typescript
describe('Complete User Flow Integration', () => {
  it('should handle new user from OAuth to personalized feed', async () => {
    // 1. OAuth authentication
    const authResult = await authenticateWithGoogle(mockGoogleUser)
    expect(authResult.success).toBe(true)
    
    // 2. Check onboarding status
    const user = await getUser(authResult.userId)
    expect(user.onboarding_completed).toBe(false)
    
    // 3. Complete onboarding
    await completeOnboarding(authResult.userId, {
      interests: ['tech', 'science'],
      region: 'US'
    })
    
    // 4. Verify feed content
    const feed = await getUserFeed(authResult.userId)
    expect(feed.articles.length).toBeGreaterThan(0)
    expect(feed.articles.every(a => !a.isMock)).toBe(true)
  })
})
```

### Deployment Tests

**Pre-Deployment Checks:**
- Build artifacts are generated correctly
- All environment variables are configured
- Database migrations are applied
- Feed sync service starts successfully

**Post-Deployment Checks:**
- Application is accessible at production URL
- OAuth flow completes successfully
- API endpoints respond correctly
- Feed sync is running on schedule
- No console errors in browser

## Deployment Checklist

### Pre-Deployment

- [ ] Create Supabase production project
- [ ] Run all database migrations
- [ ] Seed recommended feeds
- [ ] Configure Google OAuth credentials
- [ ] Generate secure SESSION_SECRET
- [ ] Set up Netlify site
- [ ] Configure all environment variables in Netlify
- [ ] Test build locally
- [ ] Run all tests (unit, property, integration)

### Deployment

- [ ] Push code to GitHub
- [ ] Connect Netlify to repository
- [ ] Configure build settings
- [ ] Deploy to production
- [ ] Verify deployment success
- [ ] Test OAuth flow in production
- [ ] Verify feed sync is running
- [ ] Test complete user flow

### Post-Deployment

- [ ] Monitor error logs
- [ ] Check feed sync status
- [ ] Verify user registrations
- [ ] Monitor database performance
- [ ] Set up alerts for critical errors
- [ ] Document production URLs and credentials (securely)