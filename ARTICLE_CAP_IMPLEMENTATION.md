# Article Cap Implementation

## Summary
Added configurable article cap to prevent Lambda 502 errors and manage database size.

## Changes Made

### 1. Configuration (`server/config.ts`)
- Created centralized config file
- Added `maxArticlesPerUserFeed` setting (default: 250)
- Reads from `MAX_ARTICLES_PER_USER_FEED` environment variable

### 2. Storage Layer
- Added `cleanupOldArticles(userId, maxArticles)` method to `IStorage` interface
- Implemented in both `MemStorage` and `SupabaseStorage`
- Deletes oldest articles beyond the cap, keeping most recent ones

### 3. API Routes (`server/routes.ts`)
- Updated `GET /api/articles` to cap response at configured limit
- Added cleanup call after feed sync (both foreground and background)
- Cleanup runs automatically after successful sync

### 4. Environment Variables
- Added `MAX_ARTICLES_PER_USER_FEED` to env.ts documentation
- Added to .env.example with default value of 250

## Usage

Set the environment variable to change the cap:

```bash
MAX_ARTICLES_PER_USER_FEED=500  # Keep 500 most recent articles
```

Default is 250 if not set.

## How It Works

1. **Response Cap**: API returns max 250 articles (or configured limit) to prevent Lambda payload errors
2. **Database Cleanup**: After each feed sync, old articles beyond the cap are automatically deleted
3. **Per-User**: Cleanup is per-user, based on their subscribed feeds
4. **Keeps Newest**: Always keeps the most recently published articles

## Testing

After deployment:
1. Trigger a feed sync
2. Check logs for cleanup message: "Cleaned up X old articles for user Y"
3. Verify article count stays at or below the cap
