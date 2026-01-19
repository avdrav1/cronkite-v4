/**
 * Server Configuration
 * Centralized configuration for server settings
 */

export const config = {
  /**
   * Maximum number of articles to keep per user feed
   * Older articles will be automatically cleaned up
   * Default: 250
   */
  maxArticlesPerUserFeed: parseInt(process.env.MAX_ARTICLES_PER_USER_FEED || '250', 10),
  
  /**
   * Maximum articles to fetch per RSS sync
   */
  rssSyncMaxArticles: parseInt(process.env.RSS_SYNC_MAX_ARTICLES || '100', 10),
} as const;
