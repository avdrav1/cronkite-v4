import { 
  type Profile,
  type ArticleComment,
  articles,
  articleComments,
  profiles,
  friendships,
  feeds
} from "@shared/schema";
import { eq, and, or, desc, inArray, sql, isNull, count, exists } from "drizzle-orm";
import { getDatabase } from "./production-db";
import { socialCacheService } from "./social-cache-service";

/**
 * Pagination options for social queries
 */
export interface PaginationOptions {
  limit: number;
  offset: number;
  cursor?: string; // For cursor-based pagination
}

/**
 * Friend list pagination result
 */
export interface PaginatedFriends {
  friends: Profile[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Comment pagination result
 */
export interface PaginatedComments {
  comments: (ArticleComment & { author: Profile; taggedUsers: Profile[] })[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Social Query Optimizer
 * Requirements: Performance and scalability - Optimize database queries for social feeds
 * 
 * This service provides optimized queries for:
 * - Paginated friend lists
 * - Paginated comment threads
 * - Efficient social feed generation
 * - Bulk friendship status checks
 */
export class SocialQueryOptimizer {
  private db = getDatabase();

  /**
   * Get paginated friends list with caching
   * Requirements: Performance and scalability - Implement pagination for large friend lists
   * 
   * @param userId - User ID
   * @param pagination - Pagination options
   * @returns Promise<PaginatedFriends>
   */
  async getPaginatedFriends(userId: string, pagination: PaginationOptions): Promise<PaginatedFriends> {
    const { limit, offset } = pagination;
    
    // Try to get from cache first (for first page only)
    if (offset === 0) {
      const cached = await socialCacheService.getCachedFriendsList(userId);
      if (cached && cached.length >= limit) {
        return {
          friends: cached.slice(0, limit),
          totalCount: cached.length,
          hasMore: cached.length > limit,
          nextCursor: cached.length > limit ? cached[limit - 1].id : undefined
        };
      }
    }

    // Optimized query using a single JOIN instead of multiple queries
    const friendsQuery = this.db
      .select({
        profile: profiles,
        friendship_created: friendships.created_at
      })
      .from(friendships)
      .innerJoin(
        profiles,
        or(
          and(eq(friendships.user1_id, userId), eq(profiles.id, friendships.user2_id)),
          and(eq(friendships.user2_id, userId), eq(profiles.id, friendships.user1_id))
        )
      )
      .where(eq(friendships.status, 'confirmed'))
      .orderBy(desc(friendships.created_at))
      .limit(limit + 1) // Get one extra to check if there are more
      .offset(offset);

    // Get total count in parallel
    const totalCountQuery = this.db
      .select({ count: count() })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'confirmed'),
          or(
            eq(friendships.user1_id, userId),
            eq(friendships.user2_id, userId)
          )
        )
      );

    const [friendsResult, totalCountResult] = await Promise.all([
      friendsQuery,
      totalCountQuery
    ]);

    const hasMore = friendsResult.length > limit;
    const friends = friendsResult.slice(0, limit).map(row => row.profile);
    const totalCount = totalCountResult[0]?.count || 0;

    // Cache the first page
    if (offset === 0 && friends.length > 0) {
      await socialCacheService.cacheFriendsList(userId, friends, 300); // 5 minutes
    }

    return {
      friends,
      totalCount,
      hasMore,
      nextCursor: hasMore ? friends[friends.length - 1].id : undefined
    };
  }

  /**
   * Get paginated comments for an article with caching
   * Requirements: Performance and scalability - Implement pagination for comment threads
   * 
   * @param articleId - Article ID
   * @param viewerId - ID of user viewing comments (for privacy filtering)
   * @param pagination - Pagination options
   * @returns Promise<PaginatedComments>
   */
  async getPaginatedComments(
    articleId: string, 
    viewerId: string, 
    pagination: PaginationOptions
  ): Promise<PaginatedComments> {
    const { limit, offset } = pagination;

    // Try to get from cache first (for first page only)
    if (offset === 0) {
      const cached = await socialCacheService.getCachedRecentComments(articleId);
      if (cached && cached.length >= limit) {
        // Filter cached comments based on viewer's friendships
        const filteredComments = await this.filterCommentsByFriendship(cached, viewerId);
        return {
          comments: filteredComments.slice(0, limit),
          totalCount: filteredComments.length,
          hasMore: filteredComments.length > limit,
          nextCursor: filteredComments.length > limit ? filteredComments[limit - 1].id : undefined
        };
      }
    }

    // Get viewer's friends for privacy filtering
    const viewerFriends = await this.getFriendIds(viewerId);
    const allowedUserIds = [viewerId, ...viewerFriends]; // User can see their own comments + friends' comments

    // Optimized query with all necessary JOINs
    const commentsQuery = this.db
      .select({
        comment: articleComments,
        author: profiles,
        taggedUsers: sql<Profile[]>`
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', p.id,
                  'display_name', p.display_name,
                  'email', p.email,
                  'avatar_url', p.avatar_url
                )
              )
              FROM unnest(${articleComments.tagged_users}) AS tagged_id
              JOIN ${profiles} p ON p.id = tagged_id::uuid
            ),
            '[]'::json
          )
        `.as('tagged_users')
      })
      .from(articleComments)
      .innerJoin(profiles, eq(articleComments.user_id, profiles.id))
      .where(
        and(
          eq(articleComments.article_id, articleId),
          isNull(articleComments.deleted_at),
          inArray(articleComments.user_id, allowedUserIds)
        )
      )
      .orderBy(desc(articleComments.created_at))
      .limit(limit + 1)
      .offset(offset);

    // Get total count in parallel
    const totalCountQuery = this.db
      .select({ count: count() })
      .from(articleComments)
      .where(
        and(
          eq(articleComments.article_id, articleId),
          isNull(articleComments.deleted_at),
          inArray(articleComments.user_id, allowedUserIds)
        )
      );

    const [commentsResult, totalCountResult] = await Promise.all([
      commentsQuery,
      totalCountQuery
    ]);

    const hasMore = commentsResult.length > limit;
    const comments = commentsResult.slice(0, limit).map(row => ({
      ...row.comment,
      author: row.author,
      taggedUsers: Array.isArray(row.taggedUsers) ? row.taggedUsers : []
    }));
    const totalCount = totalCountResult[0]?.count || 0;

    // Cache the first page
    if (offset === 0 && comments.length > 0) {
      await socialCacheService.cacheRecentComments(articleId, comments, 120); // 2 minutes
    }

    return {
      comments,
      totalCount,
      hasMore,
      nextCursor: hasMore ? comments[comments.length - 1].id : undefined
    };
  }

  /**
   * Bulk check friendship status for multiple user pairs
   * Requirements: Performance and scalability - Efficient bulk operations
   * 
   * @param userId - Base user ID
   * @param otherUserIds - Array of other user IDs to check friendship with
   * @returns Promise<Map<string, boolean>> - Map of user ID to friendship status
   */
  async bulkCheckFriendshipStatus(userId: string, otherUserIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    
    if (otherUserIds.length === 0) {
      return result;
    }
    
    const uncachedUserIds: string[] = [];

    // Check cache first
    for (const otherUserId of otherUserIds) {
      const cached = await socialCacheService.getCachedFriendshipStatus(userId, otherUserId);
      if (cached !== null) {
        result.set(otherUserId, cached);
      } else {
        uncachedUserIds.push(otherUserId);
      }
    }

    // Query database for uncached relationships
    if (uncachedUserIds.length > 0) {
      const friendshipRecords = await this.db
        .select({
          user1_id: friendships.user1_id,
          user2_id: friendships.user2_id
        })
        .from(friendships)
        .where(
          and(
            eq(friendships.status, 'confirmed'),
            or(
              and(
                eq(friendships.user1_id, userId),
                inArray(friendships.user2_id, uncachedUserIds)
              ),
              and(
                eq(friendships.user2_id, userId),
                inArray(friendships.user1_id, uncachedUserIds)
              )
            )
          )
        );

      // Process results and cache them
      const friendIds = new Set<string>();
      for (const friendship of friendshipRecords) {
        const friendId = friendship.user1_id === userId ? friendship.user2_id : friendship.user1_id;
        friendIds.add(friendId);
      }

      for (const otherUserId of uncachedUserIds) {
        const areFriends = friendIds.has(otherUserId);
        result.set(otherUserId, areFriends);
        
        // Cache the result
        await socialCacheService.cacheFriendshipStatus(userId, otherUserId, areFriends, 600); // 10 minutes
      }
    }

    return result;
  }

  /**
   * Get optimized social feed with efficient queries
   * Requirements: Performance and scalability - Optimize database queries for social feeds
   * 
   * @param userId - User ID
   * @param options - Feed options
   * @returns Promise<any[]> - Social feed items
   */
  async getOptimizedSocialFeed(userId: string, options: any): Promise<any[]> {
    const { limit = 50, offset = 0, socialOnly = false } = options;

    // Try cache first
    const cached = await socialCacheService.getCachedSocialFeed(userId, options);
    if (cached && offset === 0) {
      return cached;
    }

    // Get user's friends efficiently
    const friendIds = await this.getFriendIds(userId);
    
    if (friendIds.length === 0 && socialOnly) {
      return []; // No friends, no social feed
    }

    // For social feeds, we want to prioritize articles with friend activity
    // Use a different approach: get articles that have friend comments first
    let articlesWithComments;
    
    if (socialOnly && friendIds.length > 0) {
      // Social-only mode: only articles with friend comments
      articlesWithComments = await this.db
        .select({
          article: articles,
          feed: feeds,
          comment_count: sql<number>`COUNT(DISTINCT ${articleComments.id})::integer`.as('comment_count'),
          latest_comment_at: sql<Date>`MAX(${articleComments.created_at})`.as('latest_comment_at'),
          friends_who_commented: sql<string[]>`
            ARRAY_AGG(DISTINCT ${profiles.display_name}) FILTER (WHERE ${profiles.display_name} IS NOT NULL)
          `.as('friends_who_commented')
        })
        .from(articles)
        .innerJoin(feeds, eq(articles.feed_id, feeds.id))
        .innerJoin(articleComments, 
          and(
            eq(articleComments.article_id, articles.id),
            isNull(articleComments.deleted_at),
            inArray(articleComments.user_id, friendIds)
          )
        )
        .innerJoin(profiles, eq(articleComments.user_id, profiles.id))
        .groupBy(articles.id, feeds.id, feeds.name)
        .orderBy(desc(sql`MAX(${articleComments.created_at})`), desc(articles.published_at))
        .limit(limit)
        .offset(offset);
    } else {
      // Regular mode: get articles with friend comments first, then others
      // Use a simpler approach: get articles that have any friend comments
      if (friendIds.length > 0) {
        // Create PostgreSQL array literal for friend IDs
        const friendIdsArray = `{${friendIds.join(',')}}`;
        
        // Get articles that have friend comments, and count ALL comments on those articles
        articlesWithComments = await this.db
          .select({
            article: articles,
            feed: feeds,
            comment_count: sql<number>`(
              SELECT COUNT(*)::integer 
              FROM ${articleComments} ac 
              WHERE ac.article_id = ${articles.id} 
              AND ac.deleted_at IS NULL
            )`.as('comment_count'),
            latest_comment_at: sql<Date>`(
              SELECT MAX(created_at) 
              FROM ${articleComments} ac 
              WHERE ac.article_id = ${articles.id} 
              AND ac.deleted_at IS NULL
            )`.as('latest_comment_at'),
            friends_who_commented: sql<string[]>`(
              SELECT ARRAY_AGG(DISTINCT p.display_name) 
              FROM ${articleComments} ac 
              JOIN ${profiles} p ON ac.user_id = p.id 
              WHERE ac.article_id = ${articles.id} 
              AND ac.deleted_at IS NULL 
              AND ac.user_id = ANY(${sql.raw(`'${friendIdsArray}'::uuid[]`)})
            )`.as('friends_who_commented')
          })
          .from(articles)
          .innerJoin(feeds, eq(articles.feed_id, feeds.id))
          .where(
            exists(
              this.db
                .select()
                .from(articleComments)
                .where(
                  and(
                    eq(articleComments.article_id, articles.id),
                    isNull(articleComments.deleted_at),
                    inArray(articleComments.user_id, friendIds)
                  )
                )
            )
          )
          .orderBy(desc(articles.published_at))
          .limit(limit)
          .offset(offset);
      } else {
        // Fallback: get recent articles without friend comments
        articlesWithComments = await this.db
          .select({
            article: articles,
            feed: feeds,
            comment_count: sql<number>`0`.as('comment_count'),
            latest_comment_at: sql<Date>`NULL`.as('latest_comment_at'),
            friends_who_commented: sql<string[]>`ARRAY[]::text[]`.as('friends_who_commented')
          })
          .from(articles)
          .innerJoin(feeds, eq(articles.feed_id, feeds.id))
          .orderBy(desc(articles.published_at))
          .limit(limit)
          .offset(offset);
      }
    }

    // Transform results to expected format
    const feedItems = articlesWithComments.map((row: any) => ({
      article: {
        ...row.article,
        feed_name: row.feed.name,
        feed_category: 'General', // Default category since feeds table doesn't have category
        source: row.feed.name,
        is_read: false, // TODO: Get from user_articles
        is_starred: false, // TODO: Get from user_articles
        engagement_signal: null
      },
      socialActivity: {
        friendsWhoCommented: row.friends_who_commented || [],
        commentCount: row.comment_count || 0,
        latestCommentAt: row.latest_comment_at,
        hasUserCommented: false // TODO: Check if user has commented
      }
    }));

    // Cache results for first page
    if (offset === 0) {
      await socialCacheService.cacheSocialFeed(userId, feedItems, options, 180); // 3 minutes
    }

    return feedItems;
  }

  /**
   * Get friend IDs for a user with caching
   * @private
   */
  private async getFriendIds(userId: string): Promise<string[]> {
    // Try cache first
    const cached = await socialCacheService.getCachedFriendsList(userId);
    if (cached) {
      return cached.map((friend: any) => friend.id);
    }

    // Query database
    const friendshipRecords = await this.db
      .select({
        user1_id: friendships.user1_id,
        user2_id: friendships.user2_id
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'confirmed'),
          or(
            eq(friendships.user1_id, userId),
            eq(friendships.user2_id, userId)
          )
        )
      );

    const friendIds = friendshipRecords.map(f => 
      f.user1_id === userId ? f.user2_id : f.user1_id
    );

    return friendIds;
  }

  /**
   * Filter comments based on friendship status
   * @private
   */
  private async filterCommentsByFriendship(comments: any[], viewerId: string): Promise<any[]> {
    const authorIds = Array.from(new Set(comments.map(c => c.author.id)));
    const friendshipMap = await this.bulkCheckFriendshipStatus(viewerId, authorIds);

    return comments.filter(comment => {
      // User can always see their own comments
      if (comment.author.id === viewerId) return true;
      
      // User can see friends' comments
      return friendshipMap.get(comment.author.id) === true;
    });
  }

  /**
   * Get query performance statistics
   * @returns Performance statistics
   */
  async getQueryStats(): Promise<any> {
    try {
      // Get database statistics
      const stats = await this.db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        WHERE tablename IN ('friendships', 'article_comments', 'profiles')
        ORDER BY tablename
      `);

      return {
        tableStats: stats,
        cacheStats: await socialCacheService.getCacheStats()
      };
    } catch (error) {
      return {
        error: (error as Error).message,
        cacheStats: await socialCacheService.getCacheStats()
      };
    }
  }
}

// Export singleton instance
export const socialQueryOptimizer = new SocialQueryOptimizer();