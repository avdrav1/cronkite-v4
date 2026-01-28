# Scheduled Cleanup Configuration

## Overview

The scheduled cleanup function runs daily at 2 AM to clean up old articles across all users. This ensures that articles don't accumulate excessively during periods of user inactivity.

## Configuration

### Netlify Scheduled Function

The cleanup is implemented as a Netlify Scheduled Function using the modern inline configuration format:

**File:** `netlify/functions/scheduled-cleanup.ts`

```typescript
export const config: Config = {
  schedule: "0 2 * * *"  // Runs daily at 2 AM
};
```

### Cron Schedule Format

The schedule uses standard cron format: `minute hour day month weekday`

- `0 2 * * *` = At 02:00 (2 AM) every day
- Minute: 0 (at the top of the hour)
- Hour: 2 (2 AM)
- Day: * (every day)
- Month: * (every month)
- Weekday: * (every day of the week)

### Build Configuration

The function is built as an ESM module (.mjs) by the build script:

**File:** `script/build.ts`

```typescript
await esbuild({
  entryPoints: ["netlify/functions/scheduled-cleanup.ts"],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: "dist/functions/scheduled-cleanup.mjs",
  // ...
});
```

### Netlify Configuration

The `netlify.toml` file specifies the functions directory:

```toml
[build]
  functions = "dist/functions"

[functions]
  node_bundler = "esbuild"
```

**Note:** Scheduled functions use inline config export. The schedule is defined in the function file itself, not in netlify.toml.

## What the Cleanup Does

The scheduled cleanup function:

1. **Processes all active users** with feeds and auto-cleanup enabled
2. **Applies per-feed limits** (default 100 articles per feed)
3. **Removes old unread articles** (default 30 days threshold)
4. **Preserves protected articles** (starred, read, or commented)
5. **Logs all operations** to the cleanup_log table
6. **Handles errors gracefully** without failing for all users

## Testing Locally

### Option 1: Direct Invocation

Run the test script to directly invoke the function:

```bash
npx tsx scripts/test-scheduled-cleanup.ts
```

This script:
- Verifies the cron schedule configuration
- Imports and invokes the handler
- Displays detailed results
- Validates the response format

### Option 2: Netlify Dev

Start the Netlify dev server and invoke the function:

```bash
# Terminal 1: Start Netlify dev server
netlify dev

# Terminal 2: Invoke the function
netlify functions:invoke scheduled-cleanup
```

### Option 3: Build and Test

Build the function and test the built version:

```bash
# Build all functions
npm run build

# Verify the function was built
ls -lh dist/functions/scheduled-cleanup.mjs

# Test the built function (requires Netlify CLI)
netlify functions:invoke scheduled-cleanup --functions dist/functions
```

## Monitoring

### Logs

The function logs detailed information:

```
🧹 Article Cleanup Scheduler triggered at [timestamp]
Step 1: Importing cleanup scheduler...
Step 2: Running scheduled cleanup...
📊 Cleanup Summary:
   Users processed: X
   Articles deleted: Y
   Cleanup duration: Zms
```

### Response Format

Success response:
```json
{
  "success": true,
  "timestamp": "2026-01-28T02:00:00.000Z",
  "duration": 1234,
  "results": {
    "usersProcessed": 10,
    "articlesDeleted": 150,
    "cleanupDurationMs": 1200
  }
}
```

Error response:
```json
{
  "success": false,
  "timestamp": "2026-01-28T02:00:00.000Z",
  "duration": 500,
  "error": "Error message",
  "stack": "Stack trace..."
}
```

### Database Logs

All cleanup operations are logged to the `cleanup_log` table:

```sql
SELECT 
  created_at,
  user_id,
  feed_id,
  trigger_type,
  articles_deleted,
  duration_ms,
  error_message
FROM cleanup_log
WHERE trigger_type = 'scheduled'
ORDER BY created_at DESC
LIMIT 10;
```

## Deployment

### Automatic Deployment

When you deploy to Netlify, the scheduled function is automatically:

1. Built by the build script
2. Deployed to Netlify Functions
3. Scheduled according to the inline config
4. Monitored by Netlify's function logs

### Manual Deployment

```bash
# Deploy to preview
npm run netlify:deploy:preview

# Deploy to production
npm run netlify:deploy:prod
```

### Verification

After deployment, verify the function is scheduled:

1. Go to Netlify Dashboard
2. Navigate to Functions
3. Find `scheduled-cleanup`
4. Check the schedule configuration
5. View execution logs

## Troubleshooting

### Function Not Running

1. **Check Netlify Dashboard**: Verify the function is deployed and scheduled
2. **Check Logs**: Look for errors in Netlify function logs
3. **Verify Schedule**: Ensure the cron expression is correct
4. **Test Locally**: Run the test script to verify functionality

### No Articles Deleted

1. **Check User Settings**: Verify users have auto-cleanup enabled
2. **Check Article Ages**: Ensure articles exceed the age threshold
3. **Check Feed Limits**: Verify feeds exceed the per-feed limit
4. **Check Protected Articles**: Starred/read articles are never deleted

### Performance Issues

1. **Check Duration**: Review cleanup_log for slow operations
2. **Check Batch Size**: Verify batch deletion is working (500 per batch)
3. **Check Database**: Ensure indexes are present and used
4. **Check Concurrency**: Verify only one cleanup runs at a time

## Configuration Options

### User Settings

Users can configure cleanup behavior in their settings:

- `articles_per_feed`: 50-500 (default 100)
- `unread_article_age_days`: 7-90 (default 30)
- `enable_auto_cleanup`: true/false (default true)

### System Defaults

System-wide defaults are configured in `server/config.ts`:

```typescript
export const cleanupConfig = {
  defaultArticlesPerFeed: 100,
  defaultUnreadAgeDays: 30,
  deleteBatchSize: 500,
  cleanupTimeoutMs: 30000,
  scheduledCleanupCron: '0 2 * * *',
};
```

## Related Documentation

- [Article Cleanup Service](../server/article-cleanup-service.ts)
- [Cleanup Scheduler](../server/cleanup-scheduler.ts)
- [Design Document](../.kiro/specs/article-cleanup-fix/design.md)
- [Requirements](../.kiro/specs/article-cleanup-fix/requirements.md)

## Requirements Implemented

This configuration implements:

- **Requirement 4.1**: Background scheduler runs at least once per day
- **Requirement 4.5**: Compatible with serverless environments (Netlify Functions)

## Support

For issues or questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review Netlify function logs
3. Check the cleanup_log table for operation history
4. Run the test script to verify local functionality
