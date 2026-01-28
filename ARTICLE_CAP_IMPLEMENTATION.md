# Article Cleanup System Implementation

## Summary
Comprehensive article cleanup system to prevent database bloat and manage article lifecycle. Replaces the original simple article cap with a sophisticated multi-strategy cleanup system.

## Overview

The new cleanup system implements:
- **Per-feed article limits** - Each feed maintains its own article cap (default 100 articles)
- **Age-based cleanup** - Unread articles older than a threshold (default 30 days) are automatically removed
- **Automatic cleanup during sync** - Every feed sync triggers cleanup for that feed
- **Scheduled background cleanup** - Daily cleanup job processes all users
- **User-configurable settings** - Users can customize cleanup behavior
- **Protected article preservation** - Starred, read, and commented articles are never deleted

## Architecture Components

### 1. Article Cleanup Service (`server/article-cleanup-service.ts`)

Core service that handles all cleanup operations:

**Key Methods:**
- `cleanupFeedArticles(userId, feedId)` - Clean up articles for a specific feed
- `cleanupUserArticles(userId)` - Clean up articles for all user's feeds
- `cleanupAllUsers()` - Clean up articles for all active users
- `getProtectedArticleIds(userId, feedId?)` - Get IDs of protected articles
- `getCleanupSettings(userId)` - Get user's cleanup settings or defaults

**Cleanup Strategies:**
1. **Per-Feed Limit Strategy** - Keep N most recent articles per feed
2. **Age-Based Strategy** - Delete unread articles older than threshold
3. **Combined Strategy** - Apply both limits simultaneously

**Protection Rules:**
- Starred articles are never deleted
- Read articles are never deleted
- Articles with comments are never deleted
- Multi-user protection: article persists if any user protects it

### 2. Cleanup Scheduler (`server/cleanup-scheduler.ts`)

Manages scheduled cleanup operations:

**Features:**
- Runs daily at 2 AM (configurable via cron expression)
- Processes all active users with auto-cleanup enabled
- Tracks execution metrics (users processed, articles deleted, duration)
- Prevents concurrent execution
- Compatible with serverless environments (Netlify Functions)

### 3. Configuration (`server/config.ts`)

Centralized cleanup configuration:

```typescript
export const cleanupConfig = {
  // Default articles to keep per feed
  defaultArticlesPerFeed: 100,
  
  // Default age threshold for unread articles (days)
  defaultUnreadAgeDays: 30,
  
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

### 4. Database Schema

**User Settings Extension:**
```sql
ALTER TABLE user_settings
ADD COLUMN articles_per_feed INTEGER DEFAULT 100,
ADD COLUMN unread_article_age_days INTEGER DEFAULT 30,
ADD COLUMN enable_auto_cleanup BOOLEAN DEFAULT TRUE;
```

**Cleanup Log Table:**
```sql
CREATE TABLE cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL, -- 'sync', 'scheduled', 'manual'
  articles_deleted INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Performance Indexes:**
```sql
CREATE INDEX idx_articles_feed_published ON articles(feed_id, published_at DESC);
CREATE INDEX idx_user_articles_protection ON user_articles(user_id, article_id) 
  WHERE is_starred = TRUE OR is_read = TRUE;
CREATE INDEX idx_cleanup_log_user_id ON cleanup_log(user_id);
CREATE INDEX idx_cleanup_log_created_at ON cleanup_log(created_at);
```

## API Endpoints

### User Cleanup Settings

#### GET /api/users/cleanup-settings
Get user's cleanup settings or defaults.

**Authentication:** Required

**Response:**
```json
{
  "settings": {
    "articles_per_feed": 100,
    "unread_article_age_days": 30,
    "enable_auto_cleanup": true
  }
}
```

#### PUT /api/users/cleanup-settings
Update user's cleanup settings.

**Authentication:** Required

**Request Body:**
```json
{
  "articles_per_feed": 150,
  "unread_article_age_days": 45,
  "enable_auto_cleanup": true
}
```

**Validation:**
- `articles_per_feed`: 50-500
- `unread_article_age_days`: 7-90
- `enable_auto_cleanup`: boolean

**Response:**
```json
{
  "settings": {
    "articles_per_feed": 150,
    "unread_article_age_days": 45,
    "enable_auto_cleanup": true
  }
}
```

### Admin Endpoints

#### GET /api/admin/cleanup-stats
Get cleanup operation statistics.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "stats": {
    "totalCleanups": 1250,
    "totalArticlesDeleted": 45000,
    "averageDuration": 1234,
    "errorRate": 0.02,
    "last24Hours": {
      "cleanups": 50,
      "articlesDeleted": 1800,
      "errors": 1
    },
    "byTriggerType": {
      "sync": { "count": 800, "articlesDeleted": 30000 },
      "scheduled": { "count": 400, "articlesDeleted": 14000 },
      "manual": { "count": 50, "articlesDeleted": 1000 }
    }
  }
}
```

#### GET /api/admin/cleanup-logs
Get paginated cleanup logs with filtering.

**Authentication:** Required (Admin only)

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `userId`: Filter by user ID
- `triggerType`: Filter by trigger type ('sync', 'scheduled', 'manual')
- `hasError`: Filter by error status (true/false)

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "userId": "uuid",
      "feedId": "uuid",
      "triggerType": "sync",
      "articlesDeleted": 25,
      "durationMs": 1234,
      "errorMessage": null,
      "createdAt": "2026-01-28T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25
  }
}
```

## How It Works

### Automatic Cleanup During Feed Sync

1. User triggers feed sync (manual or automatic)
2. Feed sync completes successfully
3. Cleanup service is called for each synced feed
4. Cleanup applies both per-feed limit and age-based strategies
5. Protected articles are excluded from deletion
6. Articles are deleted in batches of 500
7. Cleanup operation is logged to cleanup_log table
8. Errors are logged but don't fail the sync

### Scheduled Background Cleanup

1. Netlify scheduled function runs daily at 2 AM
2. Cleanup scheduler processes all active users
3. For each user, cleanup runs for all their feeds
4. Results are aggregated and logged
5. Metrics are tracked for monitoring

### User Settings Application

1. User updates cleanup settings via API
2. Settings are validated against min/max ranges
3. Settings are stored in user_settings table
4. Next cleanup operation uses new settings
5. If no custom settings, system defaults are used

## Performance Considerations

### Optimization Strategies

1. **Query Optimization**
   - Indexed queries on published_at, feed_id, user_id
   - Batch queries to reduce round trips
   - LIMIT clauses to avoid scanning entire tables

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

- **Large User Base**: Scheduled cleanup processes users in batches
- **Large Article Counts**: Batch deletions prevent memory issues
- **Serverless Compatibility**: Stateless execution, completes within function timeout

## Monitoring and Logging

### Cleanup Logs

All cleanup operations are logged to the `cleanup_log` table with:
- User ID and Feed ID
- Trigger type (sync, scheduled, manual)
- Articles deleted count
- Duration in milliseconds
- Error message (if failed)
- Timestamp

### Admin Dashboard

Administrators can:
- View cleanup statistics (total cleanups, articles deleted, error rate)
- Filter logs by user, trigger type, or error status
- Monitor cleanup performance and effectiveness
- Identify issues and trends

### Alerts

System alerts when:
- Cleanup error rate exceeds 5% over 24 hours
- Cleanup duration exceeds timeout threshold
- Scheduled cleanup fails to run

## Testing

### Unit Tests
- Cleanup logic with various article counts
- Settings validation (boundary values, invalid values)
- Error handling (database failures, timeouts)
- Protected article preservation

### Integration Tests
- Feed sync triggers cleanup
- Scheduled cleanup processes all users
- Cleanup log persistence
- Admin statistics endpoint

### Property-Based Tests
- Per-feed limit enforcement across random inputs
- Protected articles never deleted
- Age-based cleanup correctness
- Combined cleanup strategy
- Settings validation
- Multi-user article protection

## Migration from Old System

The old system (`cleanupOldArticles` method) has been replaced with the new comprehensive cleanup system:

**Old System:**
- Global article cap (250 articles total)
- Only ran during manual sync
- No user configuration
- No age-based cleanup
- No protection for read/starred articles

**New System:**
- Per-feed article limits (default 100 per feed)
- Runs during sync AND scheduled daily
- User-configurable settings
- Age-based cleanup (default 30 days)
- Full protection for starred/read/commented articles

## Troubleshooting

### No Articles Being Deleted

1. Check user has `enable_auto_cleanup: true`
2. Verify articles exceed per-feed limit or age threshold
3. Check if articles are protected (starred/read/commented)
4. Review cleanup_log for errors

### Too Many Articles Being Deleted

1. Check user's cleanup settings (may be too aggressive)
2. Verify age threshold is appropriate
3. Check per-feed limit is not too low
4. Review cleanup_log for unexpected deletions

### Performance Issues

1. Check cleanup duration in cleanup_log
2. Verify batch deletion is working (500 per batch)
3. Ensure database indexes are present
4. Check for concurrent cleanup operations

## Related Documentation

- [Scheduled Cleanup Configuration](docs/SCHEDULED_CLEANUP.md)
- [Design Document](.kiro/specs/article-cleanup-fix/design.md)
- [Requirements](.kiro/specs/article-cleanup-fix/requirements.md)
- [Database Schema Documentation](docs/DATABASE_SCHEMA_DOCUMENTATION.md)

## Requirements Implemented

This implementation addresses:
- **Requirement 1**: Per-Feed Article Limits
- **Requirement 2**: Age-Based Article Cleanup
- **Requirement 3**: Automatic Cleanup During Feed Sync
- **Requirement 4**: Scheduled Background Cleanup
- **Requirement 5**: User-Configurable Cleanup Settings
- **Requirement 6**: Protected Article Preservation
- **Requirement 7**: Cleanup Performance and Safety
- **Requirement 8**: Cleanup Monitoring and Reporting
