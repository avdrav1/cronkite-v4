# Requirements Document: Article Cleanup System Fix

## Introduction

The article cleanup system in Cronkite is not functioning correctly, leading to excessive article accumulation. Users returning after several days of inactivity are finding thousands of unread articles (4000+), which degrades performance and user experience. This spec addresses the cleanup logic, configuration, and automation to ensure articles are properly managed according to user preferences and system constraints.

## Glossary

- **Article**: An RSS feed item stored in the articles table with metadata, content, and optional embedding
- **User_Article**: A join table tracking per-user article state (read, starred, removed)
- **Protected_Article**: An article that is either starred or marked as read, which should never be deleted
- **Unread_Article**: An article that has not been marked as read by the user
- **Feed_Sync**: The process of fetching new articles from an RSS feed URL
- **Cleanup_Job**: A background process that removes old unread articles based on configured limits
- **Article_Cap**: The maximum number of articles to retain per feed or per user
- **Age_Threshold**: The maximum age in days for unread articles before they are eligible for deletion
- **Background_Scheduler**: A service that runs periodic tasks independent of user actions

## Requirements

### Requirement 1: Per-Feed Article Limits

**User Story:** As a user, I want each of my feeds to maintain a reasonable number of recent articles, so that I don't get overwhelmed with thousands of old articles.

#### Acceptance Criteria

1. THE System SHALL maintain a configurable maximum number of articles per feed per user
2. WHEN the article count for a feed exceeds the per-feed limit, THE System SHALL delete the oldest unread articles from that feed
3. THE System SHALL protect starred articles from deletion regardless of feed article count
4. THE System SHALL protect read articles from deletion regardless of feed article count
5. WHEN calculating articles to delete, THE System SHALL only count unread, unstarred articles toward the limit

### Requirement 2: Age-Based Article Cleanup

**User Story:** As a user, I want old unread articles to be automatically removed after a certain time period, so that my feed stays current and relevant.

#### Acceptance Criteria

1. THE System SHALL maintain a configurable age threshold for unread articles (default 30 days)
2. WHEN an unread article exceeds the age threshold, THE System SHALL mark it as eligible for deletion
3. THE System SHALL protect starred articles from age-based deletion regardless of age
4. THE System SHALL protect read articles from age-based deletion regardless of age
5. WHEN calculating article age, THE System SHALL use the article's published_at timestamp

### Requirement 3: Automatic Cleanup During Feed Sync

**User Story:** As a user, I want articles to be cleaned up automatically when feeds are synced, so that I don't accumulate excessive articles between syncs.

#### Acceptance Criteria

1. WHEN a feed sync completes successfully, THE System SHALL trigger cleanup for that specific feed
2. THE Cleanup_Job SHALL apply both per-feed limits and age-based limits during sync cleanup
3. THE System SHALL log the number of articles deleted during each cleanup operation
4. WHEN cleanup fails, THE System SHALL log the error but continue with feed sync operations
5. THE Cleanup_Job SHALL complete within 5 seconds to avoid blocking feed sync operations

### Requirement 4: Scheduled Background Cleanup

**User Story:** As a user, I want articles to be cleaned up periodically even when I'm not actively using the app, so that articles don't accumulate during periods of inactivity.

#### Acceptance Criteria

1. THE Background_Scheduler SHALL run a cleanup job at least once per day
2. THE Cleanup_Job SHALL process all active users during scheduled cleanup
3. THE Cleanup_Job SHALL apply both per-feed limits and age-based limits during scheduled cleanup
4. WHEN scheduled cleanup runs, THE System SHALL log the total number of articles deleted across all users
5. THE Scheduled_Cleanup SHALL be compatible with serverless environments (Netlify Functions)

### Requirement 5: User-Configurable Cleanup Settings

**User Story:** As a user, I want to configure how many articles to keep per feed and how long to keep unread articles, so that I can customize the cleanup behavior to my reading habits.

#### Acceptance Criteria

1. THE System SHALL provide a user setting for articles per feed (default 100, range 50-500)
2. THE System SHALL provide a user setting for unread article age threshold (default 30 days, range 7-90 days)
3. WHEN a user changes cleanup settings, THE System SHALL apply the new settings on the next cleanup operation
4. THE System SHALL store user cleanup preferences in the user_settings table
5. WHEN a user has not configured cleanup settings, THE System SHALL use system default values

### Requirement 6: Protected Article Preservation

**User Story:** As a user, I want my starred and read articles to be preserved indefinitely, so that I don't lose important content I've engaged with.

#### Acceptance Criteria

1. THE System SHALL never delete articles that are marked as starred by any user
2. THE System SHALL never delete articles that are marked as read by any user
3. WHEN determining articles to delete, THE System SHALL query the user_articles table for protected status
4. THE System SHALL preserve articles with comments regardless of read/starred status
5. WHEN an article is protected by multiple users, THE System SHALL only delete it when no users protect it

### Requirement 7: Cleanup Performance and Safety

**User Story:** As a system administrator, I want cleanup operations to be efficient and safe, so that they don't impact application performance or accidentally delete important data.

#### Acceptance Criteria

1. THE Cleanup_Job SHALL process article deletions in batches of 500 to avoid query timeouts
2. THE Cleanup_Job SHALL use database transactions to ensure atomic deletion operations
3. WHEN cleanup encounters an error, THE System SHALL rollback the current batch and continue with remaining batches
4. THE System SHALL maintain referential integrity by cascading deletes to related tables (user_articles, article_comments)
5. THE Cleanup_Job SHALL complete within 30 seconds for a single user's articles

### Requirement 8: Cleanup Monitoring and Reporting

**User Story:** As a system administrator, I want to monitor cleanup operations and their effectiveness, so that I can ensure the system is working correctly.

#### Acceptance Criteria

1. THE System SHALL log each cleanup operation with timestamp, user ID, and articles deleted count
2. THE System SHALL track cleanup metrics in a cleanup_log table (timestamp, user_id, feed_id, articles_deleted, duration_ms)
3. WHEN cleanup fails, THE System SHALL log the error with context (user ID, feed ID, error message)
4. THE System SHALL provide an admin endpoint to view cleanup statistics (total deletions, average duration, error rate)
5. THE System SHALL alert administrators when cleanup error rate exceeds 5% over 24 hours
