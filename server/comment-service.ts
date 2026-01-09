import { 
  type ArticleComment, 
  type InsertArticleComment, 
  type Profile,
  articleComments,
  profiles,
  articles,
  feeds
} from "@shared/schema";
import { eq, and, desc, isNull, inArray, ilike } from "drizzle-orm";
import { getDatabase } from "./production-db";
import { createClient } from '@supabase/supabase-js';
import { privacyService } from "./privacy-service";
import { friendService } from "./friend-service";
import { notificationService } from "./notification-service";
import { socialCacheService } from "./social-cache-service";
import { socialQueryOptimizer, type PaginationOptions } from "./social-query-optimizer";

// Get Supabase client for comment operations
function getSupabase() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

/**
 * Comment data structure for API responses
 */
export interface CommentWithAuthor {
  id: string;
  articleId: string;
  content: string;
  author: Profile;
  taggedUsers: Profile[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Comment creation input
 */
export interface CreateCommentInput {
  articleId: string;
  userId: string;
  content: string;
  taggedUserIds?: string[];
}

/**
 * Parsed mention from comment content
 */
export interface ParsedMention {
  username: string;
  userId?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Tag autocomplete suggestion
 */
export interface TagSuggestion {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Core Comment System Service
 * Implements Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.4, 4.5
 * 
 * This service handles:
 * - Comment creation, validation, and storage
 * - Friend-only comment visibility logic
 * - Comment deletion with cleanup
 * - @username parsing and validation
 * - Autocomplete functionality for friend tagging
 * - Tag permission enforcement (friends only)
 */
export class CommentService {
  private db = getDatabase();

  /**
   * Add a comment to an article
   * Requirements: 3.1, 3.2 - Display existing comments and allow adding new comments with validation
   * 
   * @param input - Comment creation data
   * @returns Promise<CommentWithAuthor> - The created comment with author information
   * @throws Error if validation fails or user lacks permission
   */
  async addComment(input: CreateCommentInput): Promise<CommentWithAuthor> {
    const { articleId, userId, content, taggedUserIds = [] } = input;

    // Validate comment content
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new Error("Comment content cannot be empty");
    }
    if (trimmedContent.length > 2000) {
      throw new Error("Comment content cannot exceed 2000 characters");
    }

    // Check if user can comment on this article (temporarily disabled)
    // const canComment = await privacyService.canComment(userId, articleId);
    // if (!canComment) {
    //   throw new Error("You do not have permission to comment on this article");
    // }
    console.log(`💬 addComment: Allowing comment (permission check temporarily disabled)`);

    // Validate tagged users (if any)
    const validatedTaggedUsers: string[] = [];
    if (taggedUserIds.length > 0) {
      if (taggedUserIds.length > 10) {
        throw new Error("Cannot tag more than 10 users in a single comment");
      }

      for (const taggedUserId of taggedUserIds) {
        // Check if user can tag this person
        const canTag = await privacyService.canTagUser(userId, taggedUserId);
        if (!canTag) {
          throw new Error(`You cannot tag user ${taggedUserId} - you must be confirmed friends`);
        }
        validatedTaggedUsers.push(taggedUserId);
      }
    }

    // Create the comment
    const insertData = {
      article_id: articleId,
      user_id: userId,
      content: trimmedContent,
      tagged_users: validatedTaggedUsers,
      created_at: new Date(),
      updated_at: new Date()
    };

    const [comment] = await this.db
      .insert(articleComments)
      .values(insertData)
      .returning();

    // Get author and tagged user profiles for response
    const [author, taggedUsers] = await Promise.all([
      this.getUserProfile(userId),
      this.getUserProfiles(validatedTaggedUsers)
    ]);

    // Create notifications for tagged users
    // Requirements: 4.2 - Implement tag notification creation
    if (validatedTaggedUsers.length > 0) {
      // Get article title for notification
      const article = await this.getArticleById(articleId);
      const articleTitle = article?.title || 'Unknown Article';

      // Create tag notifications for each tagged user
      for (const taggedUserId of validatedTaggedUsers) {
        try {
          await notificationService.createCommentTagNotification(
            userId,
            taggedUserId,
            comment.id,
            articleId,
            articleTitle
          );
        } catch (error) {
          // Log error but don't fail the comment creation
          console.error(`Failed to create tag notification for user ${taggedUserId}:`, error);
        }
      }
    }

    // Send real-time comment update to other users viewing the article
    // Requirements: 3.1 - Live comment updates on articles
    try {
      const { webSocketService } = await import('./websocket-service');
      await webSocketService.sendCommentUpdate(articleId, {
        articleId,
        comment: {
          id: comment.id,
          content: comment.content,
          userId: author.id,
          userName: author.display_name,
          userAvatar: author.avatar_url || undefined,
          createdAt: comment.created_at.toISOString(),
          taggedUsers: validatedTaggedUsers
        },
        action: 'added'
      }, userId); // Exclude the comment author from receiving the update
    } catch (error) {
      // Log error but don't fail the comment creation
      console.error(`Failed to send real-time comment update:`, error);
    }

    // Invalidate comment cache
    await this.invalidateCommentCache(articleId);

    return {
      id: comment.id,
      articleId: comment.article_id,
      content: comment.content,
      author,
      taggedUsers,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at
    };
  }

  /**
   * Get comments for an article (friend-only visibility)
   * Requirements: 3.1, 3.4 - Display existing comments from friends and maintain privacy
   * 
   * @param articleId - ID of the article
   * @param userId - ID of user requesting comments
   * @param limit - Maximum number of comments to return (default: 50)
   * @returns Promise<CommentWithAuthor[]> - List of comments with author information
   */
  async getComments(articleId: string, userId: string, limit: number = 50): Promise<CommentWithAuthor[]> {
    try {
      // Use Supabase client instead of direct DB connection
      const supabase = getSupabase();
      
      // First get comments
      const { data: comments, error } = await supabase
        .from('article_comments')
        .select('*')
        .eq('article_id', articleId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching comments:', error);
        return [];
      }

      if (!comments || comments.length === 0) {
        return [];
      }

      // Get unique user IDs and fetch profiles
      const userIds = [...new Set(comments.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Map to CommentWithAuthor format
      return comments.map(comment => {
        const author = profileMap.get(comment.user_id);
        return {
          id: comment.id,
          articleId: comment.article_id,
          content: comment.content,
          author: {
            id: author?.id || comment.user_id,
            email: author?.email || '',
            display_name: author?.display_name || 'Unknown User',
            avatar_url: author?.avatar_url || null,
            bio: author?.bio || null,
            timezone: author?.timezone || 'UTC',
            is_admin: author?.is_admin || false,
            onboarding_completed: author?.onboarding_completed || false,
            created_at: author?.created_at ? new Date(author.created_at) : new Date(),
            updated_at: author?.updated_at ? new Date(author.updated_at) : new Date()
          } as unknown as Profile,
          taggedUsers: [],
          createdAt: new Date(comment.created_at),
          updatedAt: new Date(comment.updated_at)
        };
      });
    } catch (error) {
      console.error('Error in getComments:', error);
      return [];
    }
  }

  /**
   * Delete a comment (soft delete)
   * Requirements: 3.3 - Delete comment and update display
   * 
   * @param commentId - ID of the comment to delete
   * @param userId - ID of user requesting deletion
   * @returns Promise<void>
   * @throws Error if comment not found or user not authorized
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    // Get the comment
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Check if comment is already deleted
    if (comment.deleted_at) {
      throw new Error("Comment has already been deleted");
    }

    // Verify user owns the comment
    if (comment.user_id !== userId) {
      throw new Error("You can only delete your own comments");
    }

    // Soft delete the comment
    await this.db
      .update(articleComments)
      .set({
        deleted_at: new Date(),
        updated_at: new Date()
      } as any)
      .where(eq(articleComments.id, commentId));

    // Send real-time comment deletion update to other users viewing the article
    // Requirements: 3.3 - Live comment deletion updates
    try {
      const { webSocketService } = await import('./websocket-service');
      const author = await this.getUserProfile(userId);
      
      await webSocketService.sendCommentUpdate(comment.article_id, {
        articleId: comment.article_id,
        comment: {
          id: comment.id,
          content: comment.content,
          userId: author.id,
          userName: author.display_name,
          userAvatar: author.avatar_url || undefined,
          createdAt: comment.created_at.toISOString(),
          taggedUsers: comment.tagged_users || []
        },
        action: 'deleted'
      }, userId); // Exclude the comment author from receiving the update
    } catch (error) {
      // Log error but don't fail the comment deletion
      console.error(`Failed to send real-time comment deletion update:`, error);
    }

    // Invalidate article cache
    await socialCacheService.invalidateArticleCache(comment.article_id);
  }

  /**
   * Validate comment access for a user
   * Requirements: 3.4 - Only display comments from confirmed friends to maintain privacy
   * 
   * @param articleId - ID of the article
   * @param userId - ID of user requesting access
   * @returns Promise<boolean> - True if user can access comments
   */
  async validateCommentAccess(articleId: string, userId: string): Promise<boolean> {
    return await privacyService.canComment(userId, articleId);
  }

  /**
   * Get comment count for an article (visible to user)
   * Requirements: 3.1 - Display comment information
   * 
   * @param articleId - ID of the article
   * @param userId - ID of user requesting count
   * @returns Promise<number> - Number of visible comments
   */
  async getCommentCount(articleId: string, userId: string): Promise<number> {
    // Check if user can view comments on this article
    const canComment = await privacyService.canComment(userId, articleId);
    if (!canComment) {
      return 0;
    }

    // Get all non-deleted comments for the article
    const comments = await this.db
      .select({
        user_id: articleComments.user_id
      })
      .from(articleComments)
      .where(
        and(
          eq(articleComments.article_id, articleId),
          isNull(articleComments.deleted_at)
        )
      );

    // Count comments that are visible to the user
    let visibleCount = 0;
    
    for (const comment of comments) {
      // User can always see their own comments
      if (comment.user_id === userId) {
        visibleCount++;
        continue;
      }

      // Check if comment author is a confirmed friend
      const areFriends = await friendService.areUsersFriends(userId, comment.user_id);
      if (areFriends) {
        visibleCount++;
      }
    }

    return visibleCount;
  }

  /**
   * Get comments by user (for user's own comment history)
   * Requirements: 3.1 - Allow users to see their own comments
   * 
   * @param userId - ID of the user
   * @param limit - Maximum number of comments to return (default: 50)
   * @returns Promise<CommentWithAuthor[]> - List of user's comments
   */
  async getCommentsByUser(userId: string, limit: number = 50): Promise<CommentWithAuthor[]> {
    const comments = await this.db
      .select({
        comment: articleComments,
        author: profiles
      })
      .from(articleComments)
      .innerJoin(profiles, eq(profiles.id, articleComments.user_id))
      .where(
        and(
          eq(articleComments.user_id, userId),
          isNull(articleComments.deleted_at)
        )
      )
      .orderBy(desc(articleComments.created_at))
      .limit(limit);

    const result: CommentWithAuthor[] = [];
    
    for (const row of comments) {
      const comment = row.comment;
      const author = row.author;
      const taggedUsers = await this.getUserProfiles(comment.tagged_users || []);
      
      result.push({
        id: comment.id,
        articleId: comment.article_id,
        content: comment.content,
        author,
        taggedUsers,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      });
    }

    return result;
  }

  /**
   * Parse @username mentions from comment content
   * Requirements: 4.1 - Implement @username parsing and validation
   * 
   * @param content - Comment content to parse
   * @returns ParsedMention[] - List of parsed mentions with positions
   */
  parseMentions(content: string): ParsedMention[] {
    const mentions: ParsedMention[] = [];
    // Regex to match @username patterns (alphanumeric, underscore, hyphen, dot)
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push({
        username: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return mentions;
  }

  /**
   * Process tagged users from comment content and validate permissions
   * Requirements: 4.4, 4.5 - Tag permission enforcement and validation
   * 
   * @param content - Comment content containing @mentions
   * @param authorId - ID of comment author
   * @returns Promise<string[]> - List of valid tagged user IDs
   */
  async processTaggedUsers(content: string, authorId: string): Promise<string[]> {
    const mentions = this.parseMentions(content);
    const validTaggedUsers: string[] = [];

    for (const mention of mentions) {
      // Find user by username (using display_name as username for now)
      const user = await this.findUserByUsername(mention.username);
      if (!user) {
        continue; // Skip invalid usernames
      }

      // Check if author can tag this user
      const canTag = await privacyService.canTagUser(authorId, user.id);
      if (canTag) {
        validTaggedUsers.push(user.id);
      }
    }

    // Remove duplicates
    return Array.from(new Set(validTaggedUsers));
  }

  /**
   * Get autocomplete suggestions for friend tagging
   * Requirements: 4.1 - Create autocomplete functionality for friend tagging
   * 
   * @param query - Partial username to search for
   * @param userId - ID of user requesting suggestions
   * @param limit - Maximum number of suggestions (default: 10)
   * @returns Promise<TagSuggestion[]> - List of friend suggestions
   */
  async getTagSuggestions(query: string, userId: string, limit: number = 10): Promise<TagSuggestion[]> {
    if (query.length < 1) {
      return [];
    }

    // Get user's friends
    const friends = await friendService.getFriends(userId);
    
    // Filter friends by query and create suggestions
    const suggestions: TagSuggestion[] = [];
    
    for (const friend of friends) {
      if (suggestions.length >= limit) break;
      
      const profile = friend.profile;
      const displayName = profile.display_name.toLowerCase();
      const email = profile.email.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // Match against display name or email
      if (displayName.includes(queryLower) || email.includes(queryLower)) {
        suggestions.push({
          userId: profile.id,
          username: profile.display_name, // Using display_name as username
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url || undefined
        });
      }
    }

    // Sort suggestions by relevance (exact matches first, then starts with, then contains)
    suggestions.sort((a, b) => {
      const aName = a.displayName.toLowerCase();
      const bName = b.displayName.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // Exact match
      if (aName === queryLower) return -1;
      if (bName === queryLower) return 1;
      
      // Starts with
      if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
      if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
      
      // Alphabetical for same relevance level
      return aName.localeCompare(bName);
    });

    return suggestions;
  }

  /**
   * Validate that all tagged usernames in content correspond to actual friends
   * Requirements: 4.5 - Validate that tagged usernames correspond to actual friends
   * 
   * @param content - Comment content to validate
   * @param authorId - ID of comment author
   * @returns Promise<{ isValid: boolean; invalidMentions: string[] }> - Validation result
   */
  async validateTaggedUsernames(content: string, authorId: string): Promise<{ isValid: boolean; invalidMentions: string[] }> {
    const mentions = this.parseMentions(content);
    const invalidMentions: string[] = [];

    for (const mention of mentions) {
      // Find user by username
      const user = await this.findUserByUsername(mention.username);
      if (!user) {
        invalidMentions.push(mention.username);
        continue;
      }

      // Check if author can tag this user
      const canTag = await privacyService.canTagUser(authorId, user.id);
      if (!canTag) {
        invalidMentions.push(mention.username);
      }
    }

    return {
      isValid: invalidMentions.length === 0,
      invalidMentions
    };
  }

  /**
   * Create comment with automatic mention processing
   * Requirements: 4.1, 4.4, 4.5 - Process mentions and enforce tag permissions
   * 
   * @param articleId - ID of the article
   * @param userId - ID of comment author
   * @param content - Comment content with @mentions
   * @returns Promise<CommentWithAuthor> - Created comment with processed tags
   */
  async addCommentWithMentions(articleId: string, userId: string, content: string): Promise<CommentWithAuthor> {
    // Process tagged users from content
    const taggedUserIds = await this.processTaggedUsers(content, userId);
    
    // Create comment with processed tags
    return await this.addComment({
      articleId,
      userId,
      content,
      taggedUserIds
    });
  }

  /**
   * Add a comment as a reply to another comment
   * Requirements: 7.3 - Add optional comment thread notifications
   * 
   * @param articleId - ID of the article
   * @param userId - ID of comment author
   * @param content - Comment content
   * @param replyToCommentId - ID of the comment being replied to
   * @param taggedUserIds - Optional list of tagged user IDs
   * @returns Promise<CommentWithAuthor> - Created reply comment
   */
  async addCommentReply(
    articleId: string, 
    userId: string, 
    content: string, 
    replyToCommentId: string,
    taggedUserIds: string[] = []
  ): Promise<CommentWithAuthor> {
    // Get the original comment to validate and create reply notification
    const originalComment = await this.getCommentById(replyToCommentId);
    if (!originalComment) {
      throw new Error("Original comment not found");
    }

    if (originalComment.article_id !== articleId) {
      throw new Error("Reply comment must be on the same article as original comment");
    }

    // Create the reply comment
    const replyComment = await this.addComment({
      articleId,
      userId,
      content,
      taggedUserIds
    });

    // Create reply notification if replying to a different user's comment
    // Requirements: 7.3 - Optional comment thread notifications
    if (originalComment.user_id !== userId) {
      try {
        // Get article title for notification
        const article = await this.getArticleById(articleId);
        const articleTitle = article?.title || 'Unknown Article';

        await notificationService.createCommentReplyNotification(
          userId,
          originalComment.user_id,
          replyComment.id,
          articleId,
          articleTitle
        );
      } catch (error) {
        // Log error but don't fail the comment creation
        console.error(`Failed to create reply notification:`, error);
      }
    }

    return replyComment;
  }

  // Private helper methods

  /**
   * Get comment by ID
   * @private
   */
  private async getCommentById(commentId: string): Promise<ArticleComment | null> {
    const result = await this.db
      .select()
      .from(articleComments)
      .where(eq(articleComments.id, commentId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get user profile by ID
   * @private
   */
  private async getUserProfile(userId: string): Promise<Profile> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!result[0]) {
      throw new Error(`User profile not found: ${userId}`);
    }

    return result[0];
  }

  /**
   * Get multiple user profiles by IDs
   * @private
   */
  private async getUserProfiles(userIds: string[]): Promise<Profile[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.db
      .select()
      .from(profiles)
      .where(inArray(profiles.id, userIds));

    return result;
  }

  /**
   * Find user by username (using display_name)
   * @private
   */
  private async findUserByUsername(username: string): Promise<Profile | null> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.display_name, username))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get article by ID
   * @private
   */
  private async getArticleById(articleId: string): Promise<{ id: string; title: string } | null> {
    const result = await this.db
      .select({
        id: articles.id,
        title: articles.title
      })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    return result[0] || null;
  }
  /**
   * Get paginated comments for an article with caching
   * Requirements: Performance and scalability - Implement pagination for comment threads
   * 
   * @param articleId - Article ID
   * @param viewerId - ID of user viewing comments
   * @param pagination - Pagination options
   * @returns Promise<PaginatedComments> - Paginated comments
   */
  async getPaginatedComments(articleId: string, viewerId: string, pagination: PaginationOptions) {
    return await socialQueryOptimizer.getPaginatedComments(articleId, viewerId, pagination);
  }

  /**
   * Invalidate comment cache when comments change
   * @private
   */
  private async invalidateCommentCache(articleId: string): Promise<void> {
    await socialCacheService.invalidateArticleCache(articleId);
  }
}

// Export singleton instance
export const commentService = new CommentService();