import { 
  type Article, 
  type Profile,
  type ArticleComment,
  type UserArticle,
  articles,
  articleComments,
  userArticles,
  profiles,
  friendships,
  feeds
} from "@shared/schema";
import { eq, and, or, desc, inArray, sql, isNull } from "drizzle-orm";
import { getDatabase } from "./production-db";
import { friendService } from "./friend-service";
import { socialFeedPreferencesService } from "./social-feed-preferences-service";
import { socialQueryOptimizer } from "./social-query-optimizer";
import { socialCacheService } from "./social-cache-service";

/**
 * Social feed item representing an article with social activity
 */
export interface SocialFeedItem {
  article: Article & {
    feed_name: string;
    feed_url?: string;
    feed_icon?: string;
    feed_category: string;
    source: string;
    is_read: boolean;
    is_starred: boolean;
    engagement_signal: string | null;
  };
  socialActivity: {
    friendsWhoCommented: Profile[];
    commentCount: number;
    latestCommentAt?: Date;
    hasUserCommented: boolean;
  };
}

/**
 * Social feed filtering options
 */
export interface SocialFeedOptions {
  userId: string;
  socialOnly?: boolean; // If true, only show articles with friend activity
  limit?: number;
  offset?: number;
  includeRegularFeed?: boolean; // If true, mix social and regular feed
}

/**
 * Social Feed Service
 * Implements Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * This service handles:
 * - Social activity aggregation logic
 * - Filtering options for social vs regular feed
 * - Friend activity surfacing in feeds
 * - Privacy controls for activity sharing
 * - Feed customization options
 */
export class SocialFeedService {
  private db = getDatabase();

  /**
   * Get social feed with friend activity
   * Requirements: 5.1 - Display articles that friends have commented on or shared
   * Requirements: 5.2 - Surface articles with friend activity in social feed
   * Requirements: 5.4 - Respect privacy settings and only show activity from confirmed friends
   * Requirements: 5.5 - Allow users to disable social feed features while maintaining friendships
   * 
   * @param options - Social feed filtering options
   * @returns Promise<SocialFeedItem[]> - Articles with social activity information
   */
  async getSocialFeed(options: SocialFeedOptions): Promise<SocialFeedItem[]> {
    // Use optimized query service with caching
    return await socialQueryOptimizer.getOptimizedSocialFeed(options.userId, options);
  }

  /**
   * Legacy implementation for reference - now using optimized query service
   * @private
   */
  private async getSocialFeedLegacy(options: SocialFeedOptions): Promise<SocialFeedItem[]> {
    const { userId, socialOnly = false, limit = 50, offset = 0, includeRegularFeed = true } = options;
    
    // Apply defaults based on user preferences
    const effectiveSocialOnly = socialOnly;
    const effectiveIncludeRegularFeed = includeRegularFeed;

    // Get user's confirmed friends
    const friends = await friendService.getFriends(userId);
    const friendIds = friends.map(f => f.profile.id);

    if (friendIds.length === 0) {
      // No friends, return empty social feed or regular feed based on options
      if (effectiveSocialOnly) {
        return [];
      }
      // Fall back to regular feed if includeRegularFeed is true
      return effectiveIncludeRegularFeed ? await this.getRegularFeedAsSocial(userId, limit, offset) : [];
    }

    // Filter friends based on their privacy settings (only show activity from friends who allow sharing)
    const friendsWhoShareActivity = await this.filterFriendsWhoShareActivity(friendIds);

    if (friendsWhoShareActivity.length === 0) {
      // No friends share activity, return regular feed if allowed
      if (effectiveSocialOnly) {
        return [];
      }
      return effectiveIncludeRegularFeed ? await this.getRegularFeedAsSocial(userId, limit, offset) : [];
    }

    // Get articles with friend comments (only from friends who share activity)
    const articlesWithComments = await this.db
      .select({
        article: articles,
        feed: feeds,
        comment: articleComments,
        commenter: profiles
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feed_id, feeds.id))
      .innerJoin(articleComments, eq(articles.id, articleComments.article_id))
      .innerJoin(profiles, eq(articleComments.user_id, profiles.id))
      .where(
        and(
          eq(feeds.user_id, userId), // Only from user's subscribed feeds
          inArray(articleComments.user_id, friendsWhoShareActivity), // Only comments from friends who share activity
          isNull(articleComments.deleted_at) // Exclude deleted comments
        )
      )
      .orderBy(desc(articleComments.created_at))
      .limit(limit * 2) // Get more to account for grouping
      .offset(offset);

    // Group by article and aggregate social activity
    const articleMap = new Map<string, {
      article: Article & { feed_name: string; feed_url?: string; feed_icon?: string; feed_category: string; source: string };
      friendsWhoCommented: Set<string>;
      commentCount: number;
      latestCommentAt: Date;
      friendProfiles: Map<string, Profile>;
    }>();

    for (const row of articlesWithComments) {
      const articleId = row.article.id;
      
      if (!articleMap.has(articleId)) {
        articleMap.set(articleId, {
          article: {
            ...row.article,
            feed_name: row.feed.name,
            feed_url: row.feed.site_url || row.feed.url,
            feed_icon: row.feed.icon_url,
            feed_category: row.feed.folder_name || 'General',
            source: row.feed.name
          },
          friendsWhoCommented: new Set(),
          commentCount: 0,
          latestCommentAt: new Date(row.comment.created_at),
          friendProfiles: new Map()
        });
      }

      const articleData = articleMap.get(articleId)!;
      articleData.friendsWhoCommented.add(row.commenter.id);
      articleData.commentCount++;
      articleData.friendProfiles.set(row.commenter.id, row.commenter);
      
      // Update latest comment time
      const commentTime = new Date(row.comment.created_at);
      if (commentTime > articleData.latestCommentAt) {
        articleData.latestCommentAt = commentTime;
      }
    }

    // Convert to array and sort by latest social activity
    const socialArticles = Array.from(articleMap.values())
      .sort((a, b) => b.latestCommentAt.getTime() - a.latestCommentAt.getTime())
      .slice(0, limit);

    // Get article IDs for user state lookup
    const articleIds = socialArticles.map(item => item.article.id);
    
    // Get user article states and check if user has commented
    const [userStates, userComments] = await Promise.all([
      this.getUserArticleStates(userId, articleIds),
      this.getUserCommentStatus(userId, articleIds)
    ]);

    // Build final social feed items
    const socialFeedItems: SocialFeedItem[] = socialArticles.map(item => {
      const userState = userStates.get(item.article.id);
      const hasUserCommented = userComments.has(item.article.id);

      return {
        article: {
          ...item.article,
          is_read: userState?.is_read || false,
          is_starred: userState?.is_starred || false,
          engagement_signal: userState?.engagement_signal || null
        },
        socialActivity: {
          friendsWhoCommented: Array.from(item.friendProfiles.values()),
          commentCount: item.commentCount,
          latestCommentAt: item.latestCommentAt,
          hasUserCommented
        }
      };
    });

    // If not social-only and we need more items, mix with regular feed
    if (!effectiveSocialOnly && effectiveIncludeRegularFeed && socialFeedItems.length < limit) {
      const remainingLimit = limit - socialFeedItems.length;
      const regularFeedItems = await this.getRegularFeedAsSocial(
        userId, 
        remainingLimit, 
        offset,
        socialFeedItems.map(item => item.article.id) // Exclude already included articles
      );
      
      // Mix social and regular items, maintaining chronological order
      const allItems = [...socialFeedItems, ...regularFeedItems];
      allItems.sort((a, b) => {
        const timeA = a.socialActivity.latestCommentAt || new Date(a.article.published_at || 0);
        const timeB = b.socialActivity.latestCommentAt || new Date(b.article.published_at || 0);
        return timeB.getTime() - timeA.getTime();
      });
      
      return allItems.slice(0, limit);
    }

    return socialFeedItems;
  }

  /**
   * Filter friends who allow sharing their reading activity
   * Requirements: 5.4 - Respect privacy settings for activity sharing
   * 
   * @param friendIds - Array of friend user IDs
   * @returns Promise<string[]> - Array of friend IDs who allow sharing activity
   */
  private async filterFriendsWhoShareActivity(friendIds: string[]): Promise<string[]> {
    if (friendIds.length === 0) {
      return [];
    }

    const friendsWhoShare: string[] = [];
    
    // Check each friend's privacy settings
    for (const friendId of friendIds) {
      const canShare = await socialFeedPreferencesService.canShareReadingActivity(friendId);
      if (canShare) {
        friendsWhoShare.push(friendId);
      }
    }

    return friendsWhoShare;
  }

  /**
   * Get regular feed items formatted as social feed items (no social activity)
   * Used as fallback when user has no friends or to mix with social feed
   * 
   * @param userId - User ID
   * @param limit - Number of items to return
   * @param offset - Offset for pagination
   * @param excludeIds - Article IDs to exclude
   * @returns Promise<SocialFeedItem[]> - Regular articles formatted as social items
   */
  private async getRegularFeedAsSocial(
    userId: string, 
    limit: number, 
    offset: number,
    excludeIds: string[] = []
  ): Promise<SocialFeedItem[]> {
    // Get user's subscribed feeds
    const userFeeds = await this.db
      .select()
      .from(feeds)
      .where(eq(feeds.user_id, userId));

    if (userFeeds.length === 0) {
      return [];
    }

    const feedIds = userFeeds.map(f => f.id);

    // Get recent articles from user's feeds
    let query = this.db
      .select({
        article: articles,
        feed: feeds
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feed_id, feeds.id))
      .where(
        and(
          inArray(articles.feed_id, feedIds),
          excludeIds.length > 0 ? sql`${articles.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})` : sql`1=1`
        )
      )
      .orderBy(desc(articles.published_at))
      .limit(limit)
      .offset(offset);

    const regularArticles = await query;

    // Get user article states
    const articleIds = regularArticles.map(row => row.article.id);
    const userStates = await this.getUserArticleStates(userId, articleIds);

    // Format as social feed items with no social activity
    return regularArticles.map(row => ({
      article: {
        ...row.article,
        feed_name: row.feed.name,
        feed_url: row.feed.site_url || row.feed.url,
        feed_icon: row.feed.icon_url,
        feed_category: row.feed.folder_name || 'General',
        source: row.feed.name,
        is_read: userStates.get(row.article.id)?.is_read || false,
        is_starred: userStates.get(row.article.id)?.is_starred || false,
        engagement_signal: userStates.get(row.article.id)?.engagement_signal || null
      },
      socialActivity: {
        friendsWhoCommented: [],
        commentCount: 0,
        latestCommentAt: undefined,
        hasUserCommented: false
      }
    }));
  }

  /**
   * Get user article states for multiple articles
   * 
   * @param userId - User ID
   * @param articleIds - Array of article IDs
   * @returns Promise<Map<string, UserArticle>> - Map of article ID to user state
   */
  private async getUserArticleStates(userId: string, articleIds: string[]): Promise<Map<string, UserArticle>> {
    if (articleIds.length === 0) {
      return new Map();
    }

    const states = await this.db
      .select()
      .from(userArticles)
      .where(
        and(
          eq(userArticles.user_id, userId),
          inArray(userArticles.article_id, articleIds)
        )
      );

    const stateMap = new Map<string, UserArticle>();
    for (const state of states) {
      stateMap.set(state.article_id, state);
    }

    return stateMap;
  }

  /**
   * Check which articles the user has commented on
   * 
   * @param userId - User ID
   * @param articleIds - Array of article IDs
   * @returns Promise<Set<string>> - Set of article IDs the user has commented on
   */
  private async getUserCommentStatus(userId: string, articleIds: string[]): Promise<Set<string>> {
    if (articleIds.length === 0) {
      return new Set();
    }

    const userComments = await this.db
      .select({ article_id: articleComments.article_id })
      .from(articleComments)
      .where(
        and(
          eq(articleComments.user_id, userId),
          inArray(articleComments.article_id, articleIds),
          isNull(articleComments.deleted_at)
        )
      );

    return new Set(userComments.map(c => c.article_id));
  }

  /**
   * Get social activity summary for a specific article
   * Requirements: 5.2 - Surface friend activity for specific articles
   * 
   * @param articleId - Article ID
   * @param userId - Current user ID
   * @returns Promise<SocialFeedItem['socialActivity']> - Social activity for the article
   */
  async getArticleSocialActivity(articleId: string, userId: string): Promise<SocialFeedItem['socialActivity']> {
    // Get user's confirmed friends
    const friends = await friendService.getFriends(userId);
    const friendIds = friends.map(f => f.profile.id);

    if (friendIds.length === 0) {
      return {
        friendsWhoCommented: [],
        commentCount: 0,
        latestCommentAt: undefined,
        hasUserCommented: false
      };
    }

    // Get friend comments on this article
    const friendComments = await this.db
      .select({
        comment: articleComments,
        commenter: profiles
      })
      .from(articleComments)
      .innerJoin(profiles, eq(articleComments.user_id, profiles.id))
      .where(
        and(
          eq(articleComments.article_id, articleId),
          inArray(articleComments.user_id, friendIds),
          isNull(articleComments.deleted_at)
        )
      )
      .orderBy(desc(articleComments.created_at));

    // Check if user has commented
    const userCommentExists = await this.db
      .select({ id: articleComments.id })
      .from(articleComments)
      .where(
        and(
          eq(articleComments.article_id, articleId),
          eq(articleComments.user_id, userId),
          isNull(articleComments.deleted_at)
        )
      )
      .limit(1);

    // Aggregate friend activity
    const friendsWhoCommented = new Map<string, Profile>();
    let latestCommentAt: Date | undefined;

    for (const row of friendComments) {
      friendsWhoCommented.set(row.commenter.id, row.commenter);
      
      const commentTime = new Date(row.comment.created_at);
      if (!latestCommentAt || commentTime > latestCommentAt) {
        latestCommentAt = commentTime;
      }
    }

    return {
      friendsWhoCommented: Array.from(friendsWhoCommented.values()),
      commentCount: friendComments.length,
      latestCommentAt,
      hasUserCommented: userCommentExists.length > 0
    };
  }
}

// Export singleton instance
export const socialFeedService = new SocialFeedService();