# RSS Feed Synchronization System

## Overview

The RSS synchronization system provides robust feed parsing, article extraction, and batch processing capabilities for the Cronkite news aggregation platform.

## Features

### 1. RSS Feed Parsing
- Supports standard RSS 2.0 and Atom feeds
- Handles various content encodings (content:encoded, description, etc.)
- Extracts metadata including author, published date, and images
- Cleans HTML content and generates excerpts

### 2. Article Extraction
- Extracts article title, URL, author, and content
- Generates unique GUIDs for articles
- Extracts images from multiple sources (enclosures, media:content, inline images)
- Creates mock vector embeddings (ready for AI integration)
- Prevents duplicate articles using feed_id + guid uniqueness

### 3. Batch Processing
- Processes multiple feeds concurrently with configurable batch size
- Implements rate limiting with delays between batches
- Handles individual feed failures gracefully
- Continues processing remaining feeds even if some fail

### 4. Error Handling
- Comprehensive error handling for network failures
- HTTP status code tracking (404, 500, etc.)
- Retry mechanism with exponential backoff
- Detailed error logging for debugging

### 5. Caching Support
- Respects ETag headers for conditional requests
- Respects Last-Modified headers
- Handles 304 Not Modified responses efficiently
- Reduces bandwidth usage and server load

### 6. Sync Logging
- Tracks sync start and completion times
- Records sync duration, articles found/new/updated
- Logs HTTP status codes and error messages
- Stores feed size and caching headers

## API

### `syncFeed(feed: Feed, options?: SyncOptions): Promise<SyncResult>`

Synchronizes a single RSS feed.

**Parameters:**
- `feed`: Feed object containing URL and metadata
- `options`: Optional configuration
  - `maxArticles`: Maximum number of articles to process (default: unlimited)
  - `respectEtag`: Use ETag for conditional requests (default: false)
  - `respectLastModified`: Use Last-Modified for conditional requests (default: false)

**Returns:** `SyncResult` object with sync statistics

### `syncFeeds(feeds: Feed[], options?: SyncOptions & BatchOptions): Promise<SyncResult[]>`

Synchronizes multiple feeds in batches.

**Parameters:**
- `feeds`: Array of Feed objects
- `options`: Optional configuration
  - All `SyncOptions` parameters
  - `batchSize`: Number of feeds to process concurrently (default: 5)
  - `delayMs`: Delay between batches in milliseconds (default: 1000)

**Returns:** Array of `SyncResult` objects

### `withRetry<T>(operation: () => Promise<T>, maxRetries?: number, delayMs?: number): Promise<T>`

Retry mechanism for failed operations.

**Parameters:**
- `operation`: Async function to retry
- `maxRetries`: Maximum number of retry attempts (default: 3)
- `delayMs`: Initial delay between retries (default: 1000)

**Returns:** Result of the operation

## Data Flow

```
1. User triggers sync via API endpoint
   ↓
2. System retrieves user's subscribed feeds
   ↓
3. Batch processor groups feeds
   ↓
4. For each feed:
   a. Start sync log entry
   b. Fetch RSS feed (with caching headers)
   c. Parse RSS content
   d. Extract articles
   e. Check for duplicates
   f. Create/update articles in database
   g. Complete sync log entry
   ↓
5. Return sync results to user
```

## Error Handling Strategy

### Network Errors
- Timeout after 10 seconds
- Retry with exponential backoff
- Log detailed error messages
- Continue processing other feeds

### Parsing Errors
- Skip malformed articles
- Log parsing errors
- Continue processing valid articles
- Mark sync as partially successful

### Database Errors
- Rollback failed transactions
- Log database errors
- Mark sync as failed
- Preserve existing data

## Performance Considerations

### Batch Processing
- Default batch size: 5 feeds
- Configurable delay between batches
- Prevents overwhelming RSS servers
- Reduces memory usage

### Caching
- Uses ETag and Last-Modified headers
- Handles 304 Not Modified responses
- Reduces bandwidth usage
- Improves sync speed

### Article Limits
- Configurable max articles per feed
- Prevents processing excessive content
- Reduces database load
- Improves sync performance

## Testing

The system has been tested with:
- ✅ Valid RSS feeds (TechCrunch, The Verge)
- ✅ Invalid URLs (network errors)
- ✅ 404 responses (not found)
- ✅ Batch processing with mixed success/failure
- ✅ Error handling and recovery
- ✅ Article extraction and deduplication

## Future Enhancements

1. **AI Integration**
   - Replace mock embeddings with real AI-generated embeddings
   - Implement semantic similarity search
   - Generate AI summaries for articles

2. **Advanced Scheduling**
   - Implement priority-based scheduling
   - Adaptive polling based on feed update frequency
   - Background job queue for async processing

3. **Content Enhancement**
   - Full-text article extraction from URLs
   - Image optimization and caching
   - Content sanitization and validation

4. **Monitoring**
   - Real-time sync progress tracking
   - Performance metrics and analytics
   - Alert system for failed syncs

## Usage Example

```typescript
import { syncFeeds } from './rss-sync';
import { storage } from './storage';

// Get user's feeds
const userFeeds = await storage.getUserFeeds(userId);

// Sync all feeds
const results = await syncFeeds(userFeeds, {
  maxArticles: 50,
  respectEtag: true,
  respectLastModified: true,
  batchSize: 3,
  delayMs: 2000
});

// Check results
const successCount = results.filter(r => r.success).length;
const totalNew = results.reduce((sum, r) => sum + r.articlesNew, 0);

console.log(`Synced ${successCount}/${userFeeds.length} feeds, ${totalNew} new articles`);
```

## Dependencies

- `rss-parser`: RSS/Atom feed parsing
- `cheerio`: HTML parsing and content extraction
- `node-fetch`: HTTP requests (built-in in Node.js 18+)

## Configuration

Environment variables:
- None required (uses default configuration)

Optional configuration:
- Batch size: Adjust based on server capacity
- Delay between batches: Adjust based on rate limits
- Max articles: Adjust based on storage capacity
- Timeout: Adjust based on network conditions
