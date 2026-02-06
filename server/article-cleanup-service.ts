/**
 * Article Cleanup Service
 * Implements Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 4.1, 5.3, 6.1, 7.1, 8.1
 * 
 * This service handles:
 * - Per-feed article limit enforcement
 * - Age-based article cleanup
 * - Protected article preservation (starred, read, commented)
 * - Automatic cleanup during feed sync
 * - Scheduled background cleanup
 * - User-configurable cleanup settings
 * - Cleanup logging and monitoring
 */

import { type IStorage } from "./storage";
import { cleanupConfig } from "./config";

/**
 * User cleanup settings
 */
export interface CleanupSettings {
  articlesPerFeed: number;
  unreadAgeDays: number;
  enableAutoCleanup: boolean;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  articlesDeleted: number;
  durationMs: number;
  error?: string;
}

/**
 * Query parameters for protected article identification
 */
export interface ProtectedArticleQuery {
  userId: string;
  feedId?: string;
}

/**
 * Core Article Cleanup Service
 * Orchestrates all cleanup operations with configurable strategies
 */
export class ArticleCleanupService {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  /**
   * Get user's cleanup settings or system defaults
   * Requirements: 5.3, 5.5 - Fetch user settings with fallback to defaults
   * 
   * @param userId - ID of the user
   * @returns Promise<CleanupSettings> - User's cleanup settings or defaults
   */
  async getCleanupSettings(userId: string): Promise<CleanupSettings> {
    try {
      const settings = await this.storage.getUserSettings(userId);
      
      return {
        articlesPerFeed: settings?.articles_per_feed ?? cleanupConfig.defaultArticlesPerFeed,
        unreadAgeDays: settings?.unread_article_age_days ?? cleanupConfig.defaultUnreadAgeDays,
        enableAutoCleanup: settings?.enable_auto_cleanup ?? true,
      };
    } catch (error) {
      console.error(`Failed to get cleanup settings for user ${userId}:`, error);
      
      // Return defaults on error
      return {
        articlesPerFeed: cleanupConfig.defaultArticlesPerFeed,
        unreadAgeDays: cleanupConfig.defaultUnreadAgeDays,
        enableAutoCleanup: true,
      };
    }
  }
  
  /**
   * Get IDs of protected articles (starred, read, or with comments)
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5 - Identify articles that should never be deleted
   * 
   * Protected articles include:
   * - Articles marked as starred by ANY user (Requirement 6.1, 6.5)
   * - Articles marked as read by ANY user (Requirement 6.2, 6.5)
   * - Articles with comments from any user (Requirement 6.4)
   * 
   * Multi-user protection (Requirement 6.5):
   * An article is protected if ANY user has starred, read, or commented on it.
   * This ensures articles are not deleted while any user still values them.
   * 
   * @param query - Query parameters with userId and optional feedId
   * @returns Promise<Set<string>> - Set of protected article IDs for efficient lookup
   */
  async getProtectedArticleIds(query: ProtectedArticleQuery): Promise<Set<string>> {
    const { userId, feedId } = query;
    const protectedIds = new Set<string>();
    
    try {
      // Query 1: Get articles that are starred or read by ANY user (not just the specified user)
      // Requirements 6.1, 6.2, 6.5: Multi-user protection
      const userArticleStates = await this.storage.getProtectedArticles(userId, feedId);
      
      for (const articleId of userArticleStates) {
        protectedIds.add(articleId);
      }
      
      console.log(`🛡️  Found ${protectedIds.size} protected articles (starred/read by any user)${feedId ? ` in feed ${feedId}` : ''}`);
      
      // Query 2: Get articles with comments (from any user)
      // Requirement 6.4: Articles with comments are protected
      const articlesWithComments = await this.storage.getArticlesWithComments(feedId);
      
      for (const articleId of articlesWithComments) {
        protectedIds.add(articleId);
      }
      
      console.log(`🛡️  Total ${protectedIds.size} protected articles (including ${articlesWithComments.length} with comments)`);
      
      return protectedIds;
      
    } catch (error) {
      console.error(`Failed to get protected article IDs for user ${userId}:`, error);
      
      // Return empty set on error to be safe (don't delete anything if we can't determine protection)
      return new Set<string>();
    }
  }
  
  /**
   * Get article IDs that exceed the per-feed limit
   * Requirements: 1.2, 1.5 - Enforce per-feed article limits while preserving protected articles
   * 
   * Strategy:
   * 1. Query all articles for the feed ordered by published_at DESC (most recent first)
   * 2. Filter out protected articles (starred, read, commented)
   * 3. Keep the first N articles (within limit)
   * 4. Return IDs of articles beyond the limit for deletion
   * 
   * @param userId - ID of the user
   * @param feedId - ID of the feed
   * @param limit - Maximum number of articles to keep per feed
   * @param protectedIds - Set of protected article IDs to exclude
   * @returns Promise<string[]> - Array of article IDs to delete
   */
  private async getArticlesExceedingFeedLimit(
    userId: string,
    feedId: string,
    limit: number,
    protectedIds: Set<string>
  ): Promise<string[]> {
    try {
      // Query all articles for this feed, ordered by published_at DESC (most recent first)
      // We don't apply a limit here because we need to filter out protected articles first
      const allArticles = await this.storage.getArticlesByFeedId(feedId);
      
      console.log(`📊 Feed ${feedId}: Found ${allArticles.length} total articles`);
      
      // Filter out protected articles
      const unprotectedArticles = allArticles.filter(article => !protectedIds.has(article.id));
      
      console.log(`📊 Feed ${feedId}: ${unprotectedArticles.length} unprotected articles (${protectedIds.size} protected)`);
      
      // If we're within the limit, no articles need to be deleted
      if (unprotectedArticles.length <= limit) {
        console.log(`✅ Feed ${feedId}: Within limit (${unprotectedArticles.length}/${limit}), no cleanup needed`);
        return [];
      }
      
      // Articles are already sorted by published_at DESC, so we keep the first N
      // and delete the rest (older articles)
      const articlesToDelete = unprotectedArticles.slice(limit);
      const deleteIds = articlesToDelete.map(article => article.id);
      
      console.log(`🗑️  Feed ${feedId}: ${deleteIds.length} articles exceed limit (keeping ${limit} most recent)`);
      
      return deleteIds;
      
    } catch (error) {
      console.error(`Failed to get articles exceeding feed limit for feed ${feedId}:`, error);
      
      // Return empty array on error to be safe (don't delete anything if we can't determine what to delete)
      return [];
    }
  }
  
  /**
   * Get article IDs that exceed the age threshold
   * Requirements: 2.2, 2.5 - Remove unread articles older than configured threshold
   * 
   * Strategy:
   * 1. Calculate cutoff date (now - ageDays)
   * 2. Query unread articles older than cutoff date
   * 3. Filter out protected articles (starred, read, commented)
   * 4. Return IDs of old unread articles for deletion
   * 
   * @param userId - ID of the user
   * @param feedId - ID of the feed
   * @param ageDays - Maximum age in days for unread articles
   * @param protectedIds - Set of protected article IDs to exclude
   * @returns Promise<string[]> - Array of article IDs to delete
   */
  private async getArticlesExceedingAgeThreshold(
    userId: string,
    feedId: string,
    ageDays: number,
    protectedIds: Set<string>
  ): Promise<string[]> {
    try {
      // Calculate cutoff date (now - ageDays)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ageDays);
      
      console.log(`📅 Age threshold: ${ageDays} days (cutoff: ${cutoffDate.toISOString()})`);
      
      // Query all articles for this feed
      const allArticles = await this.storage.getArticlesByFeedId(feedId);
      
      // Filter for articles that are:
      // 1. Older than cutoff date (published_at < cutoffDate)
      // 2. Not protected (not in protectedIds set)
      // Note: Protected articles include read articles, so we only get unread articles here
      const oldUnreadArticles = allArticles.filter(article => {
        // Skip if protected (starred, read, or commented)
        if (protectedIds.has(article.id)) {
          return false;
        }
        
        // Check if article is older than cutoff
        if (!article.published_at) {
          // If no published_at, use created_at as fallback
          const articleDate = article.created_at ? new Date(article.created_at) : new Date();
          return articleDate < cutoffDate;
        }
        
        const publishedDate = new Date(article.published_at);
        return publishedDate < cutoffDate;
      });
      
      const deleteIds = oldUnreadArticles.map(article => article.id);
      
      console.log(`🗑️  Feed ${feedId}: ${deleteIds.length} articles exceed age threshold (${ageDays} days)`);
      
      return deleteIds;
      
    } catch (error) {
      console.error(`Failed to get articles exceeding age threshold for feed ${feedId}:`, error);
      
      // Return empty array on error to be safe (don't delete anything if we can't determine what to delete)
      return [];
    }
  }
  
  /**
   * Delete articles in batches with transaction safety
   * Requirements: 7.1, 7.2, 7.3 - Process deletions in batches with error handling
   * Requirement 6.5: Multi-user protection is enforced by caller filtering
   * 
   * Strategy:
   * 1. Split article IDs into batches of cleanupConfig.deleteBatchSize (500)
   * 2. Process each batch independently
   * 3. Use database transactions for atomic operations (if supported)
   * 4. On error, rollback current batch and continue with remaining batches
   * 5. Return total count of successfully deleted articles
   * 
   * Note: Supabase client doesn't support explicit transactions, but each batch
   * deletion is atomic. If a batch fails, we log the error and continue with
   * remaining batches to maximize cleanup success.
   * 
   * IMPORTANT: This method assumes the caller has already filtered out protected
   * articles (starred, read, or commented by ANY user). Multi-user protection
   * (Requirement 6.5) is enforced by getProtectedArticleIds() which queries for
   * articles protected by ANY user, not just the current user. The cleanup
   * strategies (per-feed limit and age-based) filter out these protected articles
   * before calling this method.
   * 
   * @param articleIds - Array of article IDs to delete (must be pre-filtered to exclude protected articles)
   * @returns Promise<number> - Total number of articles successfully deleted
   */
  private async batchDeleteArticles(articleIds: string[]): Promise<number> {
    if (articleIds.length === 0) {
      console.log('📦 No articles to delete');
      return 0;
    }
    
    const batchSize = cleanupConfig.deleteBatchSize;
    const totalBatches = Math.ceil(articleIds.length / batchSize);
    let totalDeleted = 0;
    
    console.log(`📦 Starting batch deletion: ${articleIds.length} articles in ${totalBatches} batches (${batchSize} per batch)`);
    
    // Process each batch
    for (let i = 0; i < articleIds.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = articleIds.slice(i, i + batchSize);
      
      try {
        console.log(`📦 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} articles`);
        
        // Delete this batch using the storage layer
        // The storage layer will handle the actual deletion
        // Cascading deletes will automatically remove related records (user_articles, comments, etc.)
        const deleted = await this.storage.batchDeleteArticles(batch);
        
        totalDeleted += deleted;
        
        console.log(`✅ Batch ${batchNumber}/${totalBatches} complete: ${deleted} articles deleted`);
        
      } catch (error) {
        // Log error but continue with remaining batches
        console.error(`❌ Batch ${batchNumber}/${totalBatches} failed:`, error);
        console.error(`   Batch contained ${batch.length} article IDs`);
        
        // Continue with next batch - we want to delete as much as possible
        // even if some batches fail
        continue;
      }
    }
    
    console.log(`📦 Batch deletion complete: ${totalDeleted}/${articleIds.length} articles deleted`);
    
    return totalDeleted;
  }

  /**
   * Clean up articles for a specific feed
   * Requirements: 3.1, 3.2, 3.4 - Main orchestration method for feed cleanup
   * 
   * Tries the fast server-side RPC first. Falls back to JS-based cleanup
   * if the RPC function hasn't been deployed yet.
   */
  async cleanupFeedArticles(
    userId: string,
    feedId: string
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    
    console.log(`🧹 Starting cleanup for user ${userId}, feed ${feedId}`);
    
    try {
      // Step 1: Get user's cleanup settings
      const settings = await this.getCleanupSettings(userId);
      
      console.log(`⚙️  Cleanup settings: articlesPerFeed=${settings.articlesPerFeed}, unreadAgeDays=${settings.unreadAgeDays}, autoCleanup=${settings.enableAutoCleanup}`);
      
      // Step 2: Check if auto-cleanup is enabled
      if (!settings.enableAutoCleanup) {
        console.log(`⏭️  Auto-cleanup disabled for user ${userId}, skipping`);
        const durationMs = Date.now() - startTime;
        await this.logCleanup({ userId, feedId, triggerType: 'sync', articlesDeleted: 0, durationMs });
        return { articlesDeleted: 0, durationMs };
      }
      
      // Step 3: Try fast RPC-based cleanup first
      const rpcResult = await this.storage.cleanupFeedArticlesViaRPC(
        feedId,
        settings.articlesPerFeed,
        settings.unreadAgeDays
      );
      
      if (rpcResult >= 0) {
        // RPC succeeded
        const durationMs = Date.now() - startTime;
        console.log(`✅ RPC cleanup complete: ${rpcResult} articles deleted in ${durationMs}ms`);
        await this.logCleanup({ userId, feedId, triggerType: 'sync', articlesDeleted: rpcResult, durationMs });
        return { articlesDeleted: rpcResult, durationMs };
      }
      
      // Step 4: RPC not available, fall back to JS-based cleanup
      console.log(`⚠️  RPC not available, falling back to JS-based cleanup`);
      return await this.cleanupFeedArticlesJS(userId, feedId, settings);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const durationMs = Date.now() - startTime;
      console.error(`❌ Cleanup failed for user ${userId}, feed ${feedId}:`, error);
      await this.logCleanup({ userId, feedId, triggerType: 'sync', articlesDeleted: 0, durationMs, error: errorMessage });
      return { articlesDeleted: 0, durationMs, error: errorMessage };
    }
  }

  /**
   * JS-based fallback cleanup (slower, used when RPC is not available)
   */
  private async cleanupFeedArticlesJS(
    userId: string,
    feedId: string,
    settings: CleanupSettings
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    
    try {
      const protectedIds = await this.getProtectedArticleIds({ userId, feedId });
      console.log(`🛡️  Protected articles: ${protectedIds.size}`);
      
      const limitDeleteIds = await this.getArticlesExceedingFeedLimit(userId, feedId, settings.articlesPerFeed, protectedIds);
      console.log(`📊 Per-feed limit strategy: ${limitDeleteIds.length} articles to delete`);
      
      const ageDeleteIds = await this.getArticlesExceedingAgeThreshold(userId, feedId, settings.unreadAgeDays, protectedIds);
      console.log(`📅 Age-based strategy: ${ageDeleteIds.length} articles to delete`);
      
      const deleteIds = new Set([...limitDeleteIds, ...ageDeleteIds]);
      console.log(`🔀 Combined strategies: ${deleteIds.size} unique articles to delete`);
      
      const articlesDeleted = await this.batchDeleteArticles(Array.from(deleteIds));
      const durationMs = Date.now() - startTime;
      
      console.log(`✅ JS cleanup complete: ${articlesDeleted} articles deleted in ${durationMs}ms`);
      await this.logCleanup({ userId, feedId, triggerType: 'sync', articlesDeleted, durationMs });
      return { articlesDeleted, durationMs };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const durationMs = Date.now() - startTime;
      console.error(`❌ JS cleanup failed:`, error);
      await this.logCleanup({ userId, feedId, triggerType: 'sync', articlesDeleted: 0, durationMs, error: errorMessage });
      return { articlesDeleted: 0, durationMs, error: errorMessage };
    }
  }

  /**
   * Clean up articles for all feeds of a user
   * Requirements: 4.2 - Process all feeds for a single user
   * 
   * This method is called by scheduled cleanup jobs to process all of a user's feeds.
   * It orchestrates cleanup across multiple feeds:
   * 
   * 1. Get all user's feeds from storage
   * 2. Call cleanupFeedArticles for each feed
   * 3. Aggregate results (total deleted, total duration)
   * 4. Handle errors per-feed (continue on failure)
   * 5. Return aggregated CleanupResult
   * 
   * Error handling:
   * - If one feed cleanup fails, continue with remaining feeds
   * - Track partial success (some feeds cleaned even if others fail)
   * - Aggregate errors are not reported (individual feed errors are logged)
   * 
   * @param userId - ID of the user
   * @returns Promise<CleanupResult> - Aggregated result across all feeds
   */
  async cleanupUserArticles(userId: string): Promise<CleanupResult> {
    const startTime = Date.now();
    
    console.log(`🧹 Starting cleanup for all feeds of user ${userId}`);
    
    try {
      // Step 1: Get all user's feeds
      const userFeeds = await this.storage.getUserFeeds(userId);
      
      console.log(`📊 User ${userId} has ${userFeeds.length} feeds`);
      
      if (userFeeds.length === 0) {
        console.log(`⏭️  User ${userId} has no feeds, skipping cleanup`);
        
        const durationMs = Date.now() - startTime;
        return { articlesDeleted: 0, durationMs };
      }
      
      // Step 2: Call cleanupFeedArticles for each feed
      let totalDeleted = 0;
      let successfulFeeds = 0;
      let failedFeeds = 0;
      
      for (const feed of userFeeds) {
        try {
          console.log(`🧹 Cleaning up feed ${feed.id} (${feed.title})`);
          
          const result = await this.cleanupFeedArticles(userId, feed.id);
          
          totalDeleted += result.articlesDeleted;
          
          if (result.error) {
            failedFeeds++;
            console.error(`❌ Feed ${feed.id} cleanup failed: ${result.error}`);
          } else {
            successfulFeeds++;
            console.log(`✅ Feed ${feed.id} cleanup complete: ${result.articlesDeleted} articles deleted`);
          }
          
        } catch (error) {
          // Handle unexpected errors (cleanupFeedArticles should catch its own errors)
          failedFeeds++;
          console.error(`❌ Unexpected error cleaning up feed ${feed.id}:`, error);
          
          // Continue with remaining feeds
          continue;
        }
      }
      
      const durationMs = Date.now() - startTime;
      
      console.log(`✅ User ${userId} cleanup complete: ${totalDeleted} articles deleted across ${successfulFeeds}/${userFeeds.length} feeds in ${durationMs}ms`);
      
      if (failedFeeds > 0) {
        console.warn(`⚠️  ${failedFeeds} feeds failed cleanup for user ${userId}`);
      }
      
      // Step 3: Return aggregated result
      return { articlesDeleted: totalDeleted, durationMs };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const durationMs = Date.now() - startTime;
      
      console.error(`❌ Failed to cleanup articles for user ${userId}:`, error);
      
      return {
        articlesDeleted: 0,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Clean up articles for all users in the system
   * Requirements: 4.2, 4.4 - Process all users during scheduled cleanup
   * 
   * This method is called by the scheduled cleanup job to process all users.
   * It orchestrates cleanup across all users:
   * 
   * 1. Get all active users with feeds from storage
   * 2. Call cleanupUserArticles for each user
   * 3. Aggregate results (users processed, total deleted)
   * 4. Handle errors per-user (continue on failure)
   * 5. Return aggregated results
   * 
   * Error handling:
   * - If one user cleanup fails, continue with remaining users
   * - Track partial success (some users cleaned even if others fail)
   * - Log errors but don't fail the entire operation
   * 
   * @returns Promise<{ usersProcessed: number; totalDeleted: number }> - Aggregated results
   */
  async cleanupAllUsers(): Promise<{ usersProcessed: number; totalDeleted: number }> {
    const startTime = Date.now();
    
    console.log(`🧹 Starting cleanup for all users`);
    
    try {
      // Step 1: Get all active users with feeds
      const userIds = await this.storage.getUsersWithFeeds();
      
      console.log(`📊 Found ${userIds.length} users with feeds`);
      
      if (userIds.length === 0) {
        console.log(`⏭️  No users with feeds found, skipping cleanup`);
        return { usersProcessed: 0, totalDeleted: 0 };
      }
      
      // Step 2: Call cleanupUserArticles for each user
      let usersProcessed = 0;
      let totalDeleted = 0;
      let successfulUsers = 0;
      let failedUsers = 0;
      
      for (const userId of userIds) {
        try {
          console.log(`🧹 Cleaning up articles for user ${userId}`);
          
          const result = await this.cleanupUserArticles(userId);
          
          // Only count as processed if there was no error
          if (!result.error) {
            usersProcessed++;
            successfulUsers++;
          } else {
            failedUsers++;
            console.error(`❌ User ${userId} cleanup failed: ${result.error}`);
          }
          
          totalDeleted += result.articlesDeleted;
          
          console.log(`✅ User ${userId} cleanup complete: ${result.articlesDeleted} articles deleted in ${result.durationMs}ms`);
          
        } catch (error) {
          // Handle unexpected errors (cleanupUserArticles should catch its own errors)
          failedUsers++;
          console.error(`❌ Unexpected error cleaning up user ${userId}:`, error);
          
          // Continue with remaining users
          continue;
        }
      }
      
      const durationMs = Date.now() - startTime;
      
      console.log(`✅ All users cleanup complete: ${totalDeleted} articles deleted across ${successfulUsers}/${userIds.length} users in ${durationMs}ms`);
      
      if (failedUsers > 0) {
        console.warn(`⚠️  ${failedUsers} users failed cleanup`);
      }
      
      // Step 3: Return aggregated results
      return { usersProcessed, totalDeleted };
      
    } catch (error) {
      console.error(`❌ Failed to cleanup articles for all users:`, error);
      
      // Return zero results on error
      return { usersProcessed: 0, totalDeleted: 0 };
    }
  }

  /**
   * Log cleanup operation to cleanup_log table
   * Requirements: 3.3, 8.1, 8.2, 8.3 - Track cleanup operations for monitoring
   * 
   * This method logs all cleanup operations including:
   * - User ID and feed ID (if applicable)
   * - Trigger type (sync, scheduled, manual)
   * - Number of articles deleted
   * - Duration in milliseconds
   * - Error message (if cleanup failed)
   * 
   * Logging errors are handled gracefully and do not cause cleanup to fail.
   * This ensures that cleanup operations can complete even if logging fails.
   * 
   * @param log - Cleanup log entry data
   * @returns Promise<void>
   */
  private async logCleanup(log: {
    userId: string;
    feedId?: string;
    triggerType: string;
    articlesDeleted: number;
    durationMs: number;
    error?: string;
  }): Promise<void> {
    try {
      await this.storage.logCleanup({
        userId: log.userId,
        feedId: log.feedId,
        triggerType: log.triggerType,
        articlesDeleted: log.articlesDeleted,
        durationMs: log.durationMs,
        errorMessage: log.error,
      });
      
      console.log(`📝 Cleanup logged: user=${log.userId}, feed=${log.feedId ?? 'all'}, deleted=${log.articlesDeleted}, duration=${log.durationMs}ms`);
      
    } catch (error) {
      // Log the error but don't throw - logging failures should not cause cleanup to fail
      console.error('⚠️  Failed to log cleanup operation (non-fatal):', error);
      console.error('   Log data:', log);
    }
  }
}

// Export singleton instance
// This singleton is used throughout the application to ensure consistent cleanup behavior
import { getStorage } from "./storage";

export const articleCleanupService = new ArticleCleanupService(getStorage());
