# User Guide: Article Cleanup Settings

## Overview

Cronkite automatically manages your article collection to keep your feed fresh and relevant. The cleanup system removes old unread articles while preserving content you've engaged with.

## What Gets Cleaned Up

The cleanup system automatically removes:
- **Old unread articles** - Articles you haven't read that exceed the age threshold
- **Excess articles per feed** - When a feed has too many articles, the oldest unread ones are removed

## What's Always Protected

The following articles are **never** deleted:
- ⭐ **Starred articles** - Articles you've marked as favorites
- ✓ **Read articles** - Articles you've already read
- 💬 **Commented articles** - Articles with your comments or others' comments

## Cleanup Settings

You can customize how cleanup works for your account:

### Articles Per Feed
**Default: 100 articles**  
**Range: 50-500 articles**

Controls how many articles to keep for each feed. When a feed exceeds this limit, the oldest unread articles are removed.

**Examples:**
- **50 articles**: Minimal, keeps only recent articles
- **100 articles**: Default, balanced for most users
- **200 articles**: More history, good for infrequent readers
- **500 articles**: Maximum, keeps extensive history

### Unread Article Age
**Default: 30 days**  
**Range: 7-90 days**

Controls how long to keep unread articles before they're automatically removed.

**Examples:**
- **7 days**: Aggressive cleanup, only recent news
- **30 days**: Default, keeps about a month of history
- **60 days**: Extended history for occasional readers
- **90 days**: Maximum, keeps 3 months of unread articles

### Enable Auto Cleanup
**Default: Enabled**

Controls whether automatic cleanup runs for your account.

**When enabled:**
- Cleanup runs after each feed sync
- Scheduled cleanup processes your feeds daily
- Old articles are automatically removed

**When disabled:**
- No automatic cleanup occurs
- Articles accumulate indefinitely
- You must manually manage your article collection

## When Cleanup Runs

### During Feed Sync
Every time your feeds are synced (manually or automatically), cleanup runs for the synced feeds. This keeps your article count manageable as new articles arrive.

### Scheduled Daily Cleanup
A background job runs daily at 2 AM to clean up articles across all users. This ensures articles don't accumulate during periods of inactivity.

## How to Update Your Settings

### Via Settings Page (Coming Soon)
1. Navigate to Settings
2. Go to "Article Management" or "Cleanup Settings"
3. Adjust your preferences
4. Click "Save Changes"

### Via API
You can update settings programmatically:

**Endpoint:** `PUT /api/users/cleanup-settings`

**Request:**
```json
{
  "articles_per_feed": 150,
  "unread_article_age_days": 45,
  "enable_auto_cleanup": true
}
```

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

## Best Practices

### For Daily Readers
- **Articles per feed**: 50-100
- **Unread age**: 7-14 days
- **Auto cleanup**: Enabled

You read regularly, so you don't need to keep many old articles.

### For Weekly Readers
- **Articles per feed**: 100-200
- **Unread age**: 30-45 days
- **Auto cleanup**: Enabled

You need more history to catch up on the week's news.

### For Occasional Readers
- **Articles per feed**: 200-500
- **Unread age**: 60-90 days
- **Auto cleanup**: Enabled

You read infrequently, so you want to keep more history available.

### For Archivists
- **Articles per feed**: 500
- **Unread age**: 90 days
- **Auto cleanup**: Enabled or Disabled

You want to keep extensive history. Consider starring important articles to preserve them permanently.

## Understanding the Impact

### Lower Limits (More Aggressive Cleanup)
**Pros:**
- Faster feed loading
- Less overwhelming article count
- Focus on recent, relevant content
- Better performance

**Cons:**
- May miss older articles you wanted to read
- Less history available
- Need to check feeds more frequently

### Higher Limits (Less Aggressive Cleanup)
**Pros:**
- More time to read articles
- Extensive history available
- Less pressure to keep up
- Good for research and reference

**Cons:**
- Larger article counts can be overwhelming
- Slower feed loading with many articles
- May accumulate thousands of unread articles

## Frequently Asked Questions

### Will my starred articles ever be deleted?
No, starred articles are permanently protected from cleanup.

### What happens to articles I've already read?
Read articles are never deleted by the cleanup system.

### Can I recover deleted articles?
No, once articles are deleted by cleanup, they cannot be recovered. Star important articles to prevent deletion.

### Why are my articles still accumulating?
Check that:
1. Auto cleanup is enabled in your settings
2. Your limits aren't too high (500 articles per feed, 90 days)
3. You're not starring or reading all articles (protected articles aren't cleaned up)

### How do I see what was cleaned up?
Administrators can view cleanup logs in the admin panel. Regular users can see the impact by monitoring their article counts over time.

### Does cleanup affect other users?
No, cleanup is per-user. Your settings only affect your own article collection. If multiple users subscribe to the same feed, each user's cleanup runs independently.

### What if I want to keep everything?
Set your limits to maximum (500 articles per feed, 90 days) or disable auto cleanup. However, this may impact performance with very large article counts.

## Troubleshooting

### Too Many Articles Being Deleted
1. Increase your per-feed limit (up to 500)
2. Increase your age threshold (up to 90 days)
3. Star articles you want to keep permanently
4. Check that you're marking articles as read

### Not Enough Articles Being Deleted
1. Decrease your per-feed limit (down to 50)
2. Decrease your age threshold (down to 7 days)
3. Ensure auto cleanup is enabled
4. Check that feeds are syncing regularly

### Articles I Want to Read Are Being Deleted
1. Star articles you want to read later
2. Mark articles as read when you open them
3. Increase your age threshold
4. Check feeds more frequently

## Related Documentation

- [Article Cleanup System Implementation](../ARTICLE_CAP_IMPLEMENTATION.md)
- [Scheduled Cleanup Configuration](SCHEDULED_CLEANUP.md)
- [Database Schema Documentation](DATABASE_SCHEMA_DOCUMENTATION.md)

## Support

If you have questions or issues with cleanup settings:
1. Check this guide for common scenarios
2. Review your current settings
3. Contact support with specific details about your issue
