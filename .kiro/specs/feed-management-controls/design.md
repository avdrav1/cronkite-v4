# Design Document: Feed Management Controls

## Overview

This design document outlines the implementation of comprehensive feed management controls for the Cronkite news aggregator. The feature set includes manual feed synchronization (single and bulk), feed subscription limits (25 max), feed deletion capabilities, article state persistence (read/starred), and engagement signal tracking (thumbs up/down).

The implementation builds upon the existing Express.js backend with Supabase storage, extending the current API routes and storage interfaces to support these new capabilities.

## Architecture

```mermaid
graph TB
    subgraph Client
        UI[React UI Components]
        ArticleCard[Article Card]
        FeedList[Feed List]
        SyncButton[Sync Controls]
    end
    
    subgraph API Layer
        Routes[Express Routes]
        AuthMiddleware[Auth Middleware]
    end
    
    subgraph Business Logic
        FeedManager[Feed Manager]
        SyncController[Sync Controller]
        ArticleStateManager[Article State Manager]
        EngagementTracker[Engagement Tracker]
    end
    
    subgraph Storage
        Storage[IStorage Interface]
        SupabaseStorage[Supabase Storage]
        MemStorage[Memory Storage]
    end
    
    subgraph Database
        Feeds[(feeds)]
        UserArticles[(user_articles)]
        Articles[(articles)]
    end
    
    UI --> Routes
    ArticleCard --> Routes
    FeedList --> Routes
    SyncButton --> Routes
    
    Routes --> AuthMiddleware
    AuthMiddleware --> FeedManager
    AuthMiddleware --> SyncController
    AuthMiddleware --> ArticleStateManager
    AuthMiddleware --> EngagementTracker
    
    FeedManager --> Storage
    SyncController --> Storage
    ArticleStateManager --> Storage
    EngagementTracker --> Storage
    
    Storage --> SupabaseStorage
    Storage --> MemStorage
    
    SupabaseStorage --> Feeds
    SupabaseStorage --> UserArticles
    SupabaseStorage --> Articles
```

## Components and Interfaces

### API Endpoints

#### Feed Synchronization Endpoints

```typescript
// POST /api/feeds/:feedId/sync - Sync a single feed
interface SingleFeedSyncRequest {
  waitForResults?: boolean; // Default: true for single feed
}

interface SingleFeedSyncResponse {
  success: boolean;
  feedId: string;
  feedName: string;
  articlesFound: number;
  articlesNew: number;
  articlesUpdated: number;
  error?: string;
  syncDurationMs?: number;
}

// POST /api/feeds/sync-all - Sync all user feeds
interface BulkSyncRequest {
  waitForResults?: boolean; // Default: false for bulk
}

interface BulkSyncResponse {
  success: boolean;
  totalFeeds: number;
  successfulSyncs: number;
  failedSyncs: number;
  newArticles: number;
  updatedArticles: number;
  errors: Array<{ feedId: string; feedName: string; error: string }>;
}
```

#### Feed Management Endpoints

```typescript
// GET /api/feeds/count - Get user's feed count and capacity
interface FeedCountResponse {
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  isNearLimit: boolean; // true if 20+ feeds
}

// DELETE /api/feeds/:feedId - Delete/unsubscribe from a feed
interface DeleteFeedResponse {
  success: boolean;
  message: string;
  newFeedCount: number;
}
```

#### Article State Endpoints

```typescript
// PUT /api/articles/:articleId/read - Mark article as read/unread
interface UpdateReadStateRequest {
  isRead: boolean;
}

interface UpdateReadStateResponse {
  success: boolean;
  articleId: string;
  isRead: boolean;
  readAt: string | null;
}

// PUT /api/articles/:articleId/star - Star/unstar article
interface UpdateStarStateRequest {
  isStarred: boolean;
}

interface UpdateStarStateResponse {
  success: boolean;
  articleId: string;
  isStarred: boolean;
  starredAt: string | null;
}

// GET /api/articles/starred - Get all starred articles
interface StarredArticlesResponse {
  articles: Array<Article & { userState: UserArticle }>;
  total: number;
}
```

#### Engagement Signal Endpoints

```typescript
// PUT /api/articles/:articleId/engagement - Set engagement signal
interface UpdateEngagementRequest {
  signal: 'positive' | 'negative' | null; // null to remove
}

interface UpdateEngagementResponse {
  success: boolean;
  articleId: string;
  signal: 'positive' | 'negative' | null;
  signalAt: string | null;
}
```

### Storage Interface Extensions

```typescript
interface IStorage {
  // Existing methods...
  
  // Feed Count and Limit
  getUserFeedCount(userId: string): Promise<number>;
  
  // Enhanced subscription with limit check
  subscribeToFeedsWithLimit(
    userId: string, 
    feedIds: string[], 
    maxLimit: number
  ): Promise<{ subscribed: string[]; rejected: string[]; reason?: string }>;
  
  // Article State Management (enhanced)
  markArticleRead(userId: string, articleId: string, isRead: boolean): Promise<UserArticle>;
  markArticleStarred(userId: string, articleId: string, isStarred: boolean): Promise<UserArticle>;
  getStarredArticles(userId: string, limit?: number, offset?: number): Promise<Article[]>;
  
  // Engagement Signals
  setEngagementSignal(
    userId: string, 
    articleId: string, 
    signal: 'positive' | 'negative' | null
  ): Promise<UserArticle>;
  getArticlesWithEngagement(userId: string, feedId?: string): Promise<Array<Article & { engagement?: string }>>;
}
```

## Data Models

### Database Schema Updates

The existing `user_articles` table already has the necessary fields for read/starred states. We need to add an engagement signal field:

```sql
-- Add engagement signal column to user_articles
ALTER TABLE user_articles 
ADD COLUMN IF NOT EXISTS engagement_signal TEXT CHECK (engagement_signal IN ('positive', 'negative')),
ADD COLUMN IF NOT EXISTS engagement_signal_at TIMESTAMPTZ;

-- Create index for efficient engagement queries
CREATE INDEX IF NOT EXISTS idx_user_articles_engagement 
ON user_articles(user_id, engagement_signal) 
WHERE engagement_signal IS NOT NULL;
```

### TypeScript Schema Updates

```typescript
// Update to shared/schema.ts
export const userArticles = pgTable("user_articles", {
  // ... existing fields ...
  engagement_signal: text("engagement_signal"), // 'positive' | 'negative' | null
  engagement_signal_at: timestamp("engagement_signal_at", { withTimezone: true }),
});

// Type updates
export type UserArticle = {
  // ... existing fields ...
  engagement_signal: 'positive' | 'negative' | null;
  engagement_signal_at: Date | null;
};
```

### Constants

```typescript
// Feed limit constant
export const MAX_FEEDS_PER_USER = 25;
export const FEED_LIMIT_WARNING_THRESHOLD = 20;
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Single Feed Sync Isolation

*For any* user with multiple feeds and any specific feed ID, when a single feed sync is triggered, only that specific feed should be synced and the response should contain sync statistics (articlesFound, articlesNew, articlesUpdated) for that feed only.

**Validates: Requirements 1.1, 1.2**

### Property 2: Feed Sync Error Handling

*For any* feed sync operation that fails (due to network error, invalid URL, etc.), the response should contain a descriptive error message and the error should not prevent other operations from succeeding.

**Validates: Requirements 1.3, 2.5**

### Property 3: Feed Sync Timestamp Update

*For any* successful feed sync operation, the feed's last_fetched_at timestamp should be updated to a value greater than or equal to the sync start time.

**Validates: Requirements 1.5**

### Property 4: Bulk Sync Completeness

*For any* user with N feeds, when bulk sync is triggered, all N feeds should be processed and the aggregate response should have totalFeeds equal to N, and successfulSyncs + failedSyncs should equal N.

**Validates: Requirements 2.1, 2.3**

### Property 5: Feed Limit Enforcement Invariant

*For any* user, the number of subscribed feeds should never exceed MAX_FEEDS_PER_USER (25). Any subscription attempt that would exceed this limit should be rejected with an error containing the current count and maximum allowed.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

### Property 6: Unsubscribe at Limit

*For any* user at the feed limit (25 feeds), unsubscribing from a feed should succeed and reduce the feed count by 1, allowing room for new subscriptions.

**Validates: Requirements 3.4, 4.1, 4.5**

### Property 7: Feed Ownership Authorization

*For any* user attempting to unsubscribe from a feed, the operation should only succeed if the feed belongs to that user. Attempts to unsubscribe from feeds owned by other users should be rejected with an authorization error.

**Validates: Requirements 4.4**

### Property 8: Feed Count Response Structure

*For any* user, the feed count endpoint should return currentCount (actual number of feeds), maxAllowed (25), remaining (25 - currentCount), and isNearLimit (true if currentCount >= 20).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 9: Read State Round Trip

*For any* article and user, marking the article as read should persist with a timestamp, and subsequently marking it as unread should clear the timestamp. The read state should be retrievable and match the last set value.

**Validates: Requirements 6.1, 6.2, 6.5**

### Property 10: Starred State Round Trip

*For any* article and user, starring the article should persist with a timestamp, and subsequently unstarring should clear the timestamp. The starred state should be retrievable and match the last set value.

**Validates: Requirements 7.1, 7.2, 7.5**

### Property 11: User State Isolation

*For any* article and two different users, setting read/starred/engagement states for one user should not affect the states for the other user. Each user's states are independent.

**Validates: Requirements 6.4, 7.4**

### Property 12: Starred Articles Filter

*For any* user with some starred and some unstarred articles, requesting starred articles should return only articles where isStarred is true, and the count should match the number of articles the user has starred.

**Validates: Requirements 7.3**

### Property 13: Engagement Signal State Management

*For any* article and user, setting an engagement signal (positive/negative) should persist with a timestamp. Changing the signal should update both value and timestamp. Setting to null should clear the signal. The current signal state should be retrievable with articles.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6**

## Error Handling

### Feed Sync Errors

| Error Condition | HTTP Status | Error Code | Message |
|----------------|-------------|------------|---------|
| Feed not found | 404 | FEED_NOT_FOUND | Feed with ID {feedId} not found |
| Feed not owned by user | 403 | FEED_NOT_AUTHORIZED | You do not have permission to sync this feed |
| Network timeout | 500 | SYNC_TIMEOUT | Feed sync timed out after {timeout}ms |
| Invalid RSS format | 500 | INVALID_RSS | Failed to parse RSS feed: {details} |

### Feed Subscription Errors

| Error Condition | HTTP Status | Error Code | Message |
|----------------|-------------|------------|---------|
| Feed limit exceeded | 400 | FEED_LIMIT_EXCEEDED | Cannot subscribe: you have {current}/25 feeds. Remove {excess} feed(s) first. |
| Feed already subscribed | 400 | ALREADY_SUBSCRIBED | You are already subscribed to this feed |
| Invalid feed URL | 400 | INVALID_FEED_URL | The provided URL is not a valid RSS feed |

### Article State Errors

| Error Condition | HTTP Status | Error Code | Message |
|----------------|-------------|------------|---------|
| Article not found | 404 | ARTICLE_NOT_FOUND | Article with ID {articleId} not found |
| Invalid engagement signal | 400 | INVALID_SIGNAL | Engagement signal must be 'positive', 'negative', or null |

## Testing Strategy

### Unit Tests

Unit tests will verify individual component behavior:

- Feed count calculation and limit checking
- Response structure validation
- Error message formatting
- Timestamp handling for article states

### Property-Based Tests

Property-based tests will use Vitest with fast-check to verify the correctness properties:

- **Feed limit invariant**: Generate random subscription sequences and verify count never exceeds 25
- **State round trips**: Generate random read/starred/engagement state changes and verify consistency
- **User isolation**: Generate multi-user scenarios and verify state independence
- **Sync response structure**: Generate various sync scenarios and verify response completeness

### Integration Tests

Integration tests will verify end-to-end flows:

- Complete subscription → sync → unsubscribe flow
- Article state persistence across sessions
- Bulk sync with mixed success/failure feeds

### Test Configuration

```typescript
// vitest.config.ts additions
export default defineConfig({
  test: {
    // Property tests should run at least 100 iterations
    testTimeout: 30000, // Allow time for property tests
  }
});
```

### Property Test Framework

Tests will use `fast-check` for property-based testing:

```typescript
import * as fc from 'fast-check';

// Example property test structure
describe('Feed Management Properties', () => {
  it('Property 5: Feed limit is never exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 30 }),
        async (feedIds) => {
          // Test implementation
        }
      ),
      { numRuns: 100 }
    );
  });
});
```
