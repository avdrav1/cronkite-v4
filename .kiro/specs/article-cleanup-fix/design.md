# Design Document: Article Cleanup System Fix

## Overview

This design addresses the broken article cleanup system in Cronkite by implementing a comprehensive, multi-layered cleanup strategy. The current system only cleans up during manual sync operations and uses an incorrect global article cap (250 articles total across all feeds), leading to massive article accumulation.

The new design implements:
1. **Per-feed article limits** - Each feed maintains its own article cap (default 100 articles)
2. **Age-based cleanup** - Unread articles older than a threshold (default 30 days) are automatically removed
3. **Automatic cleanup during sync** - Every feed sync triggers cleanup for that feed
4. **Scheduled background cleanup** - Daily cleanup job processes all users
5. **User-configurable settings** - Users can customize cleanup behavior
6. **Protected article preservation** - Starred, read, and commented articles are never deleted

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Cleanup Triggers                         │
├─────────────────────────────────────────────────────────────┤
│  1. Feed Sync Complete → Per-Feed Cleanup                   │
│  2. Scheduled Job (Daily) → All-User Cleanup                │
│  3. Manual Trigger (Admin) → Specific User/Feed Cleanup     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Article Cleanup Service                         │
├─────────────────────────────────────────────────────────────┤
│  • cleanupFeedArticles(userId, feedId)                      │
│  • cleanupUserArticles(userId)                              │
│  • cleanupAllUsers()                                        │
│  • getProtectedArticleIds(userId, feedId?)                  │
│  • getCleanupSettings(userId)                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Cleanup Strategies                          │
├─────────────────────────────────────────────────────────────┤
│  1. Per-Feed Limit Strategy                                 │
│     - Keep N most recent articles per feed                  │
│     - Exclude protected articles from count                 │
│                                                              │
│  2. Age-Based Strategy                                      │
│     - Delete unread articles older than threshold           │
│     - Exclude protected articles                            │
│                                                              │
│  3. Combined Strategy (default)                             │
│     - Apply both per-feed and age-based limits              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                Database Operations                           │
├─────────────────────────────────────────────────────────────┤
│  • Query protected articles (user_articles table)           │
│  • Query articles by feed and age                           │
│  • Batch delete articles (500 per batch)                    │
│  • Log cleanup operations (cleanup_log table)               │
│  • Cascade delete related records                           │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Feed Sync Integration** (`server/routes.ts`, `server/rss-sync.ts`)
   - After successful feed sync, call `cleanupFeedArticles(userId, feedId)`
   - Non-blocking: cleanup errors don't fail the sync

2. **Background Scheduler** (`server/feed-scheduler.ts` or new `server/cleanup-scheduler.ts`)
   - Daily scheduled job calls `cleanupAllUsers()`
   - Compatible with Netlify Functions (stateless execution)

3. **User Settings** (`server/routes.ts`, `shared/schema.ts`)
   - New fields in `user_settings` table: `articles_per_feed`, `unread_article_age_days`
   - API endpoints to get/update cleanup settings

4. **Storage Layer** (`server/supabase-storage.ts`)
   - Replace existing `cleanupOldArticles()` method
   - Add new cleanup methods with per-feed logic

## Components and Interfaces

### 1. Cleanup Configuration

```typescript
// server/config.ts
export const cleanupConfig = {
  // Default articles to keep per feed
  defaultArticlesPerFeed: parseInt(process.env.DEFAULT_ARTICLES_PER_FEED || '100', 10),
  
  // Default age threshold for unread articles (days)
  defaultUnreadAgeDays: parseInt(process.env.DEFAULT_UNREAD_AGE_DAYS || '30', 10),
  
  // Minimum/maximum values for user settings
  minArticlesPerFeed: 50,
  maxArticlesPerFeed: 500,
  minUnreadAgeDays: 7,
  maxUnreadAgeDays: 90,
  
  // Batch size for deletions
  deleteBatchSize: 500,
  
  // Cleanup timeout (ms)
  cleanupTimeoutMs: 30000,
  
  // Scheduled cleanup interval (cron expression)
  scheduledCleanupCron: '0 2 * * *', // 2 AM daily
};
```

### 2. User Settings Schema

```typescript
// shared/schema.ts - Add to user_settings table
export const userSettings = pgTable("user_settings", {
  // ... existing fields ...
  
  // Cleanup settings
  articles_per_feed: integer("articles_per_feed").default(100),
  unread_article_age_days: integer("unread_article_age_days").default(30),
  enable_auto_cleanup: boolean("enable_auto_cleanup").default(true),
});
```

### 3. Cleanup Log Schema

```typescript
// shared/schema.ts - New table
export const cleanupLog = pgTable("cleanup_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }),
  feed_id: uuid("feed_id").references(() => feeds.id, { onDelete: "set null" }),
  trigger_type: text("trigger_type").notNull(), // 'sync', 'scheduled', 'manual'
  articles_deleted: integer("articles_deleted").notNull().default(0),
  duration_ms: integer("duration_ms").notNull(),
  error_message: text("error_message"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 4. Article Cleanup Service

```typescript
// server/article-cleanup-service.ts

export interface CleanupSettings {
  articlesPerFeed: number;
  unreadAgeDays: number;
  enableAutoCleanup: boolean;
}

export interface CleanupResult {
  articlesDeleted: number;
  durationMs: number;
  error?: string;
}

export interface ProtectedArticleQuery {
  userId: string;
  feedId?: string;
}

export class ArticleCleanupService {
  private storage: Storage;
  
  constructor(storage: Storage) {
    this.storage = storage;
  }
  
  /**
   * Get user's cleanup settings or defaults
   */
  async getCleanupSettings(userId: string): Promise<CleanupSettings> {
    const settings = await this.storage.getUserSettings(userId);
    
    return {
      articlesPerFeed: settings.articles_per_feed ?? cleanupConfig.defaultArticlesPerFeed,
      unreadAgeDays: settings.unread_article_age_days ?? cleanupConfig.defaultUnreadAgeDays,
      enableAutoCleanup: settings.enable_auto_cleanup ?? true,
    };
  }
  
  /**
   * Get IDs of protected articles (starred, read, or with comments)
   */
  async getProtectedArticleIds(query: ProtectedArticleQuery): Promise<Set<string>> {
    // Query user_articles for starred or read articles
    // Query article_comments for articles with comments
    // Return union of both sets
  }
  
  /**
   * Clean up articles for a specific feed
   * Called after feed sync completes
   */
  async cleanupFeedArticles(
    userId: string,
    feedId: string
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    
    try {
      // Get user's cleanup settings
      const settings = await this.getCleanupSettings(userId);
      
      if (!settings.enableAutoCleanup) {
        return { articlesDeleted: 0, durationMs: Date.now() - startTime };
      }
      
      // Get protected article IDs
      const protectedIds = await this.getProtectedArticleIds({ userId, feedId });
      
      // Strategy 1: Per-feed limit cleanup
      const limitDeleteIds = await this.getArticlesExceedingFeedLimit(
        userId,
        feedId,
        settings.articlesPerFeed,
        protectedIds
      );
      
      // Strategy 2: Age-based cleanup
      const ageDeleteIds = await this.getArticlesExceedingAgeThreshold(
        userId,
        feedId,
        settings.unreadAgeDays,
        protectedIds
      );
      
      // Combine both strategies (union of IDs)
      const deleteIds = new Set([...limitDeleteIds, ...ageDeleteIds]);
      
      // Delete in batches
      const articlesDeleted = await this.batchDeleteArticles(Array.from(deleteIds));
      
      // Log cleanup operation
      await this.logCleanup({
        userId,
        feedId,
        triggerType: 'sync',
        articlesDeleted,
        durationMs: Date.now() - startTime,
      });
      
      return { articlesDeleted, durationMs: Date.now() - startTime };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log error
      await this.logCleanup({
        userId,
        feedId,
        triggerType: 'sync',
        articlesDeleted: 0,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      });
      
      return {
        articlesDeleted: 0,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Clean up articles for all feeds of a user
   * Called by scheduled cleanup job
   */
  async cleanupUserArticles(userId: string): Promise<CleanupResult> {
    // Get all user's feeds
    // Call cleanupFeedArticles for each feed
    // Aggregate results
  }
  
  /**
   * Clean up articles for all users
   * Called by scheduled background job
   */
  async cleanupAllUsers(): Promise<{ usersProcessed: number; totalDeleted: number }> {
    // Get all active users
    // Call cleanupUserArticles for each user
    // Aggregate results
  }
  
  /**
   * Get article IDs that exceed the per-feed limit
   */
  private async getArticlesExceedingFeedLimit(
    userId: string,
    feedId: string,
    limit: number,
    protectedIds: Set<string>
  ): Promise<string[]> {
    // Query articles for this feed, ordered by published_at DESC
    // Skip protected articles
    // Return IDs beyond the limit
  }
  
  /**
   * Get article IDs that exceed the age threshold
   */
  private async getArticlesExceedingAgeThreshold(
    userId: string,
    feedId: string,
    ageDays: number,
    protectedIds: Set<string>
  ): Promise<string[]> {
    // Calculate cutoff date (now - ageDays)
    // Query unread articles older than cutoff
    // Skip protected articles
    // Return IDs
  }
  
  /**
   * Delete articles in batches
   */
  private async batchDeleteArticles(articleIds: string[]): Promise<number> {
    // Delete in batches of cleanupConfig.deleteBatchSize
    // Use transactions for safety
    // Return total deleted count
  }
  
  /**
   * Log cleanup operation
   */
  private async logCleanup(log: {
    userId: string;
    feedId?: string;
    triggerType: string;
    articlesDeleted: number;
    durationMs: number;
    error?: string;
  }): Promise<void> {
    // Insert into cleanup_log table
  }
}

// Export singleton
export const articleCleanupService = new ArticleCleanupService(getStorage());
```

### 5. Cleanup Scheduler

```typescript
// server/cleanup-scheduler.ts

export class CleanupScheduler {
  private cleanupService: ArticleCleanupService;
  private isRunning: boolean = false;
  
  constructor(cleanupService: ArticleCleanupService) {
    this.cleanupService = cleanupService;
  }
  
  /**
   * Run scheduled cleanup for all users
   * Compatible with Netlify Functions (stateless)
   */
  async runScheduledCleanup(): Promise<{
    usersProcessed: number;
    totalDeleted: number;
    durationMs: number;
  }> {
    if (this.isRunning) {
      console.log('⏭️ Cleanup already running, skipping');
      return { usersProcessed: 0, totalDeleted: 0, durationMs: 0 };
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🧹 Starting scheduled cleanup for all users');
      
      const result = await this.cleanupService.cleanupAllUsers();
      
      const durationMs = Date.now() - startTime;
      
      console.log(`✅ Scheduled cleanup complete: ${result.usersProcessed} users, ${result.totalDeleted} articles deleted in ${durationMs}ms`);
      
      return {
        ...result,
        durationMs,
      };
      
    } catch (error) {
      console.error('❌ Scheduled cleanup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

// Export singleton
export const cleanupScheduler = new CleanupScheduler(articleCleanupService);
```

## Data Models

### Cleanup Settings (User Settings Extension)

```typescript
interface UserCleanupSettings {
  articlesPerFeed: number;        // 50-500, default 100
  unreadAgeDays: number;          // 7-90, default 30
  enableAutoCleanup: boolean;     // default true
}
```

### Cleanup Log Entry

```typescript
interface CleanupLogEntry {
  id: string;
  userId: string;
  feedId: string | null;
  triggerType: 'sync' | 'scheduled' | 'manual';
  articlesDeleted: number;
  durationMs: number;
  errorMessage: string | null;
  createdAt: Date;
}
```

### Protected Article Set

```typescript
interface ProtectedArticleSet {
  starredIds: Set<string>;        // From user_articles where is_starred = true
  readIds: Set<string>;           // From user_articles where is_read = true
  commentedIds: Set<string>;      // From article_comments
  allProtectedIds: Set<string>;   // Union of above
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Per-Feed Limit Enforcement

*For any* feed with more than the configured limit of unread, unstarred articles, after cleanup runs, the number of unread, unstarred articles for that feed should be at or below the limit, and the remaining articles should be the most recent ones by published_at timestamp.

**Validates: Requirements 1.2, 1.5**

### Property 2: Protected Articles Are Never Deleted

*For any* article that is starred, read, or has comments, that article should never be deleted by any cleanup operation regardless of age or feed article count.

**Validates: Requirements 1.3, 1.4, 2.3, 2.4, 6.1, 6.2, 6.4**

### Property 3: Age-Based Cleanup

*For any* unread, unstarred article with a published_at timestamp older than the configured age threshold, that article should be deleted during cleanup.

**Validates: Requirements 2.2, 2.5**

### Property 4: Combined Cleanup Strategy

*For any* cleanup operation (sync or scheduled), both per-feed limit enforcement and age-based cleanup should be applied, resulting in the deletion of articles that violate either constraint.

**Validates: Requirements 3.2, 4.3**

### Property 5: Cleanup Logging Completeness

*For any* cleanup operation, a log entry should be created containing the user ID, feed ID (if applicable), trigger type, articles deleted count, duration in milliseconds, and error message (if failed).

**Validates: Requirements 3.3, 8.1, 8.2, 8.3**

### Property 6: Cleanup Performance

*For any* single user's cleanup operation, the total duration should complete within 30 seconds, and individual feed cleanup should complete within 5 seconds.

**Validates: Requirements 3.5, 7.5**

### Property 7: All Active Users Processed

*For any* scheduled cleanup run, all users with active feeds and auto-cleanup enabled should be processed, and the total articles deleted should equal the sum of articles deleted per user.

**Validates: Requirements 4.2, 4.4**

### Property 8: Settings Validation

*For any* user cleanup settings update, if the articlesPerFeed value is outside the range [50, 500] or unreadAgeDays is outside the range [7, 90], the update should be rejected with a validation error.

**Validates: Requirements 5.1, 5.2**

### Property 9: Settings Application

*For any* user with custom cleanup settings, when cleanup runs for that user, the cleanup operation should use the user's configured values rather than system defaults.

**Validates: Requirements 5.3**

### Property 10: Multi-User Article Protection

*For any* article that is protected (starred, read, or commented) by at least one user, that article should not be deleted even if it would be deleted for other users based on their cleanup settings.

**Validates: Requirements 6.5**

### Property 11: Batch Deletion

*For any* cleanup operation that needs to delete more than 500 articles, the deletions should be processed in batches of 500 or fewer, and all batches should complete successfully or rollback on error.

**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

### Cleanup Errors

1. **Database Query Failures**
   - Log error with context (user ID, feed ID, query type)
   - Return zero articles deleted
   - Don't block feed sync operations
   - Continue with remaining feeds/users

2. **Batch Deletion Failures**
   - Rollback current batch transaction
   - Log error with batch details
   - Continue with remaining batches
   - Track partial success in cleanup log

3. **Settings Validation Errors**
   - Return 400 Bad Request with validation details
   - Don't update settings
   - Provide clear error messages with valid ranges

4. **Timeout Errors**
   - Abort cleanup operation after timeout
   - Log partial results
   - Schedule retry for next cleanup cycle

### Error Recovery

1. **Transactional Safety**
   - Each batch deletion wrapped in transaction
   - Rollback on any error within batch
   - Preserve database consistency

2. **Graceful Degradation**
   - If cleanup fails for one feed, continue with others
   - If cleanup fails for one user, continue with others
   - Track success/failure rates in cleanup log

3. **Monitoring and Alerts**
   - Track error rate over 24-hour window
   - Alert if error rate exceeds 5%
   - Provide admin dashboard for cleanup metrics

## Testing Strategy

### Unit Tests

Unit tests will focus on specific examples and edge cases:

1. **Cleanup Logic Tests**
   - Test cleanup with exactly at limit (boundary)
   - Test cleanup with zero articles
   - Test cleanup with all protected articles
   - Test cleanup with mixed protected/unprotected articles

2. **Settings Validation Tests**
   - Test boundary values (50, 500, 7, 90)
   - Test invalid values (49, 501, 6, 91)
   - Test default value application

3. **Error Handling Tests**
   - Test database query failure
   - Test batch deletion failure
   - Test timeout handling
   - Test transaction rollback

4. **Integration Tests**
   - Test feed sync triggers cleanup
   - Test scheduled cleanup processes all users
   - Test cleanup log persistence
   - Test admin statistics endpoint

### Property-Based Tests

Property-based tests will verify universal properties across randomized inputs. Each test will run a minimum of 100 iterations.

**Test Configuration:**
- Library: fast-check (for TypeScript/JavaScript)
- Iterations: 100 minimum per property
- Tag format: `Feature: article-cleanup-fix, Property {N}: {property_text}`

**Property Test Suite:**

1. **Property 1: Per-Feed Limit Enforcement**
   - Generate: Random feeds with varying article counts (0-1000)
   - Generate: Random limit values (50-500)
   - Execute: Cleanup operation
   - Verify: Article count ≤ limit, most recent articles retained

2. **Property 2: Protected Articles Are Never Deleted**
   - Generate: Random articles with random protection states
   - Execute: Cleanup with various limits and age thresholds
   - Verify: All protected articles still exist

3. **Property 3: Age-Based Cleanup**
   - Generate: Random articles with random published_at dates
   - Generate: Random age thresholds (7-90 days)
   - Execute: Cleanup operation
   - Verify: Old unread articles deleted, recent articles retained

4. **Property 4: Combined Cleanup Strategy**
   - Generate: Random articles violating both limits
   - Execute: Cleanup operation
   - Verify: Both constraints enforced

5. **Property 5: Cleanup Logging Completeness**
   - Generate: Random cleanup scenarios
   - Execute: Cleanup operation
   - Verify: Log entry exists with all required fields

6. **Property 6: Cleanup Performance**
   - Generate: Random article counts (0-10000)
   - Execute: Cleanup operation with timing
   - Verify: Duration within limits

7. **Property 7: All Active Users Processed**
   - Generate: Random number of users (1-100)
   - Execute: Scheduled cleanup
   - Verify: All users processed, counts aggregate correctly

8. **Property 8: Settings Validation**
   - Generate: Random settings values (valid and invalid)
   - Execute: Settings update
   - Verify: Valid values accepted, invalid rejected

9. **Property 9: Settings Application**
   - Generate: Random user settings
   - Execute: Cleanup operation
   - Verify: User settings used instead of defaults

10. **Property 10: Multi-User Article Protection**
    - Generate: Random articles with multi-user protection
    - Execute: Cleanup for different users
    - Verify: Article persists while any user protects it

11. **Property 11: Batch Deletion**
    - Generate: Random article counts requiring batching (500-5000)
    - Execute: Cleanup operation
    - Verify: Batching occurs, all articles deleted or rolled back

### Test Data Generators

```typescript
// fast-check generators for property tests

// Generate random article with configurable properties
const articleGen = fc.record({
  id: fc.uuid(),
  feedId: fc.uuid(),
  publishedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  isStarred: fc.boolean(),
  isRead: fc.boolean(),
  hasComments: fc.boolean(),
});

// Generate random cleanup settings
const settingsGen = fc.record({
  articlesPerFeed: fc.integer({ min: 50, max: 500 }),
  unreadAgeDays: fc.integer({ min: 7, max: 90 }),
  enableAutoCleanup: fc.boolean(),
});

// Generate random feed with articles
const feedWithArticlesGen = fc.record({
  feedId: fc.uuid(),
  articles: fc.array(articleGen, { minLength: 0, maxLength: 1000 }),
});
```

## Performance Considerations

### Optimization Strategies

1. **Query Optimization**
   - Use indexed queries on published_at, feed_id, user_id
   - Batch queries to reduce round trips
   - Use LIMIT clauses to avoid scanning entire tables

2. **Batch Processing**
   - Process deletions in batches of 500
   - Use bulk delete operations
   - Minimize transaction overhead

3. **Caching**
   - Cache user settings for duration of cleanup
   - Cache protected article IDs per feed
   - Avoid redundant queries

4. **Parallel Processing**
   - Process multiple feeds concurrently (with rate limiting)
   - Use Promise.all for independent operations
   - Limit concurrency to avoid overwhelming database

### Scalability

1. **Large User Base**
   - Scheduled cleanup processes users in batches
   - Implement pagination for user queries
   - Track progress to resume on failure

2. **Large Article Counts**
   - Batch deletions prevent memory issues
   - Use streaming queries for large result sets
   - Implement timeout protection

3. **Serverless Compatibility**
   - Stateless execution (no in-memory state)
   - Complete within function timeout (15 minutes for Netlify)
   - Use database for coordination (no shared memory)

## Migration Strategy

### Database Migrations

1. **Add cleanup_log table**
   ```sql
   CREATE TABLE cleanup_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
     feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
     trigger_type TEXT NOT NULL,
     articles_deleted INTEGER NOT NULL DEFAULT 0,
     duration_ms INTEGER NOT NULL,
     error_message TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   
   CREATE INDEX idx_cleanup_log_user_id ON cleanup_log(user_id);
   CREATE INDEX idx_cleanup_log_created_at ON cleanup_log(created_at);
   ```

2. **Add cleanup settings to user_settings**
   ```sql
   ALTER TABLE user_settings
   ADD COLUMN articles_per_feed INTEGER DEFAULT 100,
   ADD COLUMN unread_article_age_days INTEGER DEFAULT 30,
   ADD COLUMN enable_auto_cleanup BOOLEAN DEFAULT TRUE;
   ```

3. **Add indexes for cleanup queries**
   ```sql
   CREATE INDEX idx_articles_feed_published ON articles(feed_id, published_at DESC);
   CREATE INDEX idx_user_articles_protection ON user_articles(user_id, article_id) 
     WHERE is_starred = TRUE OR is_read = TRUE;
   ```

### Code Migration

1. **Phase 1: Add new cleanup service**
   - Implement ArticleCleanupService
   - Add cleanup_log table
   - Add user settings fields
   - Deploy without activating

2. **Phase 2: Integrate with feed sync**
   - Update feed sync to call new cleanup
   - Keep old cleanup as fallback
   - Monitor both systems

3. **Phase 3: Add scheduled cleanup**
   - Implement CleanupScheduler
   - Add Netlify Function for scheduled execution
   - Test in staging environment

4. **Phase 4: Remove old cleanup**
   - Remove old cleanupOldArticles method
   - Update config to remove old settings
   - Clean up unused code

### Rollback Plan

1. **If cleanup causes issues**
   - Disable auto-cleanup via feature flag
   - Revert to manual cleanup only
   - Investigate and fix issues

2. **If performance degrades**
   - Increase batch size limits
   - Reduce cleanup frequency
   - Add more aggressive caching

3. **If data loss occurs**
   - Restore from database backup
   - Disable cleanup system
   - Audit protection logic
