/**
 * Server Configuration
 * Centralized configuration for server settings
 */

export const config = {
  /**
   * Maximum articles to fetch per RSS sync
   */
  rssSyncMaxArticles: parseInt(process.env.RSS_SYNC_MAX_ARTICLES || '100', 10),
  
  /**
   * Maximum articles to return in API responses
   * Prevents Lambda response size limit (6MB)
   * Default: 1000
   */
  apiResponseMaxArticles: parseInt(process.env.API_RESPONSE_MAX_ARTICLES || '1000', 10),
} as const;

/**
 * Article Cleanup Configuration
 * Settings for the article cleanup system
 * Requirements: 1.1, 2.1, 7.1
 */
export const cleanupConfig = {
  /**
   * Default number of articles to keep per feed
   * Can be overridden by user settings
   * Default: 100
   */
  defaultArticlesPerFeed: parseInt(process.env.DEFAULT_ARTICLES_PER_FEED || '100', 10),
  
  /**
   * Default age threshold for unread articles (days)
   * Articles older than this will be cleaned up
   * Can be overridden by user settings
   * Default: 30
   */
  defaultUnreadAgeDays: parseInt(process.env.DEFAULT_UNREAD_AGE_DAYS || '30', 10),
  
  /**
   * Minimum articles per feed allowed in user settings
   */
  minArticlesPerFeed: 50,
  
  /**
   * Maximum articles per feed allowed in user settings
   */
  maxArticlesPerFeed: 500,
  
  /**
   * Minimum unread age days allowed in user settings
   */
  minUnreadAgeDays: 7,
  
  /**
   * Maximum unread age days allowed in user settings
   */
  maxUnreadAgeDays: 90,
  
  /**
   * Number of articles to delete per batch
   * Prevents query timeouts and memory issues
   */
  deleteBatchSize: 500,
  
  /**
   * Maximum time allowed for cleanup operation (milliseconds)
   * Cleanup will abort if it exceeds this timeout
   */
  cleanupTimeoutMs: 30000,
  
  /**
   * Cron expression for scheduled cleanup
   * Default: "0 2 * * *" (2 AM daily)
   */
  scheduledCleanupCron: process.env.SCHEDULED_CLEANUP_CRON || '0 2 * * *',
} as const;
