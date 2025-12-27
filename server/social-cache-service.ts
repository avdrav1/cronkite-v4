import { createClient, RedisClientType } from 'redis';
import { log, logError } from './app-setup';

/**
 * Social Cache Service for Performance Optimization
 * Requirements: Performance and scalability - Redis caching for frequently accessed social data
 * 
 * This service provides caching for:
 * - Friend lists and relationships
 * - Comment counts and recent comments
 * - Social feed data
 * - User privacy settings
 * - Notification preferences
 */
export class SocialCacheService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private hasLoggedError = false;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   * @private
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Check if Redis is explicitly disabled
      if (process.env.DISABLE_REDIS === 'true') {
        log('📦 Redis cache disabled by environment variable');
        return;
      }

      // Use Redis URL from environment or default to localhost
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            // Limit reconnection attempts to avoid spam
            if (retries > 5) {
              log('📦 Redis cache connection failed after 5 attempts, disabling cache');
              return false; // Stop reconnecting
            }
            return Math.min(retries * 50, 1000);
          }
        }
      });

      this.client.on('error', (err) => {
        // Only log the first few errors to avoid spam
        if (!this.hasLoggedError) {
          logError('Redis Client Error - cache will be disabled', err);
          this.hasLoggedError = true;
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        log('📦 Redis cache connected');
        this.isConnected = true;
        this.hasLoggedError = false;
      });

      this.client.on('disconnect', () => {
        log('📦 Redis cache disconnected');
        this.isConnected = false;
      });

      // Set a timeout for connection attempt
      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          log('📦 Redis connection timeout - continuing without cache');
          this.client?.disconnect().catch(() => {});
          this.client = null;
        }
      }, 2000); // 2 second timeout

      await this.client.connect();
      clearTimeout(connectionTimeout);
    } catch (error) {
      if (!this.hasLoggedError) {
        log('📦 Redis cache not available - continuing without cache');
        this.hasLoggedError = true;
      }
      // Continue without cache if Redis is not available
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Cache friend list for a user
   * @param userId - User ID
   * @param friends - Array of friend profiles
   * @param ttl - Time to live in seconds (default: 5 minutes)
   */
  async cacheFriendsList(userId: string, friends: any[], ttl: number = 300): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `friends:${userId}`;
      await this.client!.setEx(key, ttl, JSON.stringify(friends));
    } catch (error) {
      logError('Failed to cache friends list', error as Error);
    }
  }

  /**
   * Get cached friend list for a user
   * @param userId - User ID
   * @returns Cached friends array or null if not found
   */
  async getCachedFriendsList(userId: string): Promise<any[] | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `friends:${userId}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logError('Failed to get cached friends list', error as Error);
      return null;
    }
  }

  /**
   * Cache friendship status between two users
   * @param user1Id - First user ID
   * @param user2Id - Second user ID
   * @param areFriends - Whether users are friends
   * @param ttl - Time to live in seconds (default: 10 minutes)
   */
  async cacheFriendshipStatus(user1Id: string, user2Id: string, areFriends: boolean, ttl: number = 600): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // Create consistent key regardless of user order
      const key = user1Id < user2Id ? `friendship:${user1Id}:${user2Id}` : `friendship:${user2Id}:${user1Id}`;
      await this.client!.setEx(key, ttl, areFriends.toString());
    } catch (error) {
      logError('Failed to cache friendship status', error as Error);
    }
  }

  /**
   * Get cached friendship status between two users
   * @param user1Id - First user ID
   * @param user2Id - Second user ID
   * @returns Friendship status or null if not cached
   */
  async getCachedFriendshipStatus(user1Id: string, user2Id: string): Promise<boolean | null> {
    if (!this.isAvailable()) return null;

    try {
      // Create consistent key regardless of user order
      const key = user1Id < user2Id ? `friendship:${user1Id}:${user2Id}` : `friendship:${user2Id}:${user1Id}`;
      const cached = await this.client!.get(key);
      return cached !== null ? cached === 'true' : null;
    } catch (error) {
      logError('Failed to get cached friendship status', error as Error);
      return null;
    }
  }

  /**
   * Cache comment count for an article
   * @param articleId - Article ID
   * @param count - Comment count
   * @param ttl - Time to live in seconds (default: 2 minutes)
   */
  async cacheCommentCount(articleId: string, count: number, ttl: number = 120): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `comments:count:${articleId}`;
      await this.client!.setEx(key, ttl, count.toString());
    } catch (error) {
      logError('Failed to cache comment count', error as Error);
    }
  }

  /**
   * Get cached comment count for an article
   * @param articleId - Article ID
   * @returns Cached comment count or null if not found
   */
  async getCachedCommentCount(articleId: string): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `comments:count:${articleId}`;
      const cached = await this.client!.get(key);
      return cached !== null ? parseInt(cached, 10) : null;
    } catch (error) {
      logError('Failed to get cached comment count', error as Error);
      return null;
    }
  }

  /**
   * Cache recent comments for an article
   * @param articleId - Article ID
   * @param comments - Array of recent comments
   * @param ttl - Time to live in seconds (default: 2 minutes)
   */
  async cacheRecentComments(articleId: string, comments: any[], ttl: number = 120): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `comments:recent:${articleId}`;
      await this.client!.setEx(key, ttl, JSON.stringify(comments));
    } catch (error) {
      logError('Failed to cache recent comments', error as Error);
    }
  }

  /**
   * Get cached recent comments for an article
   * @param articleId - Article ID
   * @returns Cached comments array or null if not found
   */
  async getCachedRecentComments(articleId: string): Promise<any[] | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `comments:recent:${articleId}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logError('Failed to get cached recent comments', error as Error);
      return null;
    }
  }

  /**
   * Cache user privacy settings
   * @param userId - User ID
   * @param settings - Privacy settings object
   * @param ttl - Time to live in seconds (default: 15 minutes)
   */
  async cachePrivacySettings(userId: string, settings: any, ttl: number = 900): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `privacy:${userId}`;
      await this.client!.setEx(key, ttl, JSON.stringify(settings));
    } catch (error) {
      logError('Failed to cache privacy settings', error as Error);
    }
  }

  /**
   * Get cached privacy settings for a user
   * @param userId - User ID
   * @returns Cached privacy settings or null if not found
   */
  async getCachedPrivacySettings(userId: string): Promise<any | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `privacy:${userId}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logError('Failed to get cached privacy settings', error as Error);
      return null;
    }
  }

  /**
   * Cache social feed for a user
   * @param userId - User ID
   * @param feedItems - Array of social feed items
   * @param options - Feed options used to generate the cache key
   * @param ttl - Time to live in seconds (default: 3 minutes)
   */
  async cacheSocialFeed(userId: string, feedItems: any[], options: any, ttl: number = 180): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // Create cache key based on user and options
      const optionsKey = JSON.stringify(options);
      const key = `social_feed:${userId}:${Buffer.from(optionsKey).toString('base64')}`;
      await this.client!.setEx(key, ttl, JSON.stringify(feedItems));
    } catch (error) {
      logError('Failed to cache social feed', error as Error);
    }
  }

  /**
   * Get cached social feed for a user
   * @param userId - User ID
   * @param options - Feed options used to generate the cache key
   * @returns Cached feed items or null if not found
   */
  async getCachedSocialFeed(userId: string, options: any): Promise<any[] | null> {
    if (!this.isAvailable()) return null;

    try {
      // Create cache key based on user and options
      const optionsKey = JSON.stringify(options);
      const key = `social_feed:${userId}:${Buffer.from(optionsKey).toString('base64')}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logError('Failed to get cached social feed', error as Error);
      return null;
    }
  }

  /**
   * Invalidate cache entries related to a user
   * @param userId - User ID
   */
  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      // Get all keys related to this user
      const patterns = [
        `friends:${userId}`,
        `friendship:${userId}:*`,
        `friendship:*:${userId}`,
        `privacy:${userId}`,
        `social_feed:${userId}:*`
      ];

      for (const pattern of patterns) {
        const keys = await this.client!.keys(pattern);
        if (keys.length > 0) {
          await this.client!.del(keys);
        }
      }
    } catch (error) {
      logError('Failed to invalidate user cache', error as Error);
    }
  }

  /**
   * Invalidate cache entries related to an article
   * @param articleId - Article ID
   */
  async invalidateArticleCache(articleId: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const patterns = [
        `comments:count:${articleId}`,
        `comments:recent:${articleId}`
      ];

      for (const pattern of patterns) {
        await this.client!.del(pattern);
      }
    } catch (error) {
      logError('Failed to invalidate article cache', error as Error);
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  async getCacheStats(): Promise<any> {
    if (!this.isAvailable()) {
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: 0
      };
    }

    try {
      const info = await this.client!.info('memory');
      const keyCount = await this.client!.dbSize();
      
      // Parse memory usage from info string
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

      return {
        connected: true,
        keyCount,
        memoryUsage,
        memoryUsageHuman: this.formatBytes(memoryUsage)
      };
    } catch (error) {
      logError('Failed to get cache stats', error as Error);
      return {
        connected: false,
        keyCount: 0,
        memoryUsage: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Format bytes to human readable string
   * @private
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const socialCacheService = new SocialCacheService();