import { 
  type Profile,
  type UserPrivacySettings,
  type Friendship,
  type ArticleComment,
  type UserBlock,
  type Notification,
  profiles,
  userPrivacySettings,
  friendships,
  articleComments,
  userBlocks,
  notifications,
  userSettings,
  userInterests,
  feeds,
  userArticles
} from "@shared/schema";
import { eq, or, and, sql } from "drizzle-orm";
import { getDatabase } from "./production-db";

/**
 * Data Export Service
 * Implements Requirements: 6.5 - Allow users to export or delete all their social data
 * 
 * This service handles:
 * - Complete user data export in JSON format
 * - Complete user data deletion with cascade cleanup
 * - Privacy-compliant data portability
 */
export class DataExportService {
  private db = getDatabase();

  /**
   * Export all user data in a structured JSON format
   * Requirements: 6.5 - Data portability completeness
   * 
   * @param userId - ID of the user requesting data export
   * @returns Promise<UserDataExport> - Complete user data export
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    // Get user profile
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) {
      throw new Error("User not found");
    }

    // Get privacy settings
    const [privacySettings] = await this.db
      .select()
      .from(userPrivacySettings)
      .where(eq(userPrivacySettings.user_id, userId))
      .limit(1);

    // Get user settings
    const [settings] = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .limit(1);

    // Get user interests
    const interests = await this.db
      .select()
      .from(userInterests)
      .where(eq(userInterests.user_id, userId));

    // Get friendships (both directions)
    const friendshipData = await this.db
      .select()
      .from(friendships)
      .where(
        or(
          eq(friendships.user1_id, userId),
          eq(friendships.user2_id, userId)
        )
      );

    // Get comments made by user
    const comments = await this.db
      .select()
      .from(articleComments)
      .where(eq(articleComments.user_id, userId));

    // Get blocks (both directions)
    const blocksGiven = await this.db
      .select()
      .from(userBlocks)
      .where(eq(userBlocks.blocker_id, userId));

    const blocksReceived = await this.db
      .select()
      .from(userBlocks)
      .where(eq(userBlocks.blocked_id, userId));

    // Get notifications
    const userNotifications = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, userId));

    // Get feeds
    const userFeeds = await this.db
      .select()
      .from(feeds)
      .where(eq(feeds.user_id, userId));

    // Get article interactions
    const articleInteractions = await this.db
      .select()
      .from(userArticles)
      .where(eq(userArticles.user_id, userId));

    // Build export data structure
    const exportData: UserDataExport = {
      exportedAt: new Date().toISOString(),
      userId: userId,
      profile: {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        timezone: profile.timezone,
        region_code: profile.region_code,
        onboarding_completed: profile.onboarding_completed,
        created_at: profile.created_at.toISOString(),
        updated_at: profile.updated_at.toISOString()
      },
      settings: settings ? {
        default_polling_interval: settings.default_polling_interval,
        adaptive_polling_enabled: settings.adaptive_polling_enabled,
        digest_enabled: settings.digest_enabled,
        digest_frequency: settings.digest_frequency,
        digest_time: settings.digest_time,
        digest_timezone: settings.digest_timezone,
        digest_max_articles: settings.digest_max_articles,
        ai_summaries_enabled: settings.ai_summaries_enabled,
        ai_clustering_enabled: settings.ai_clustering_enabled,
        ai_daily_limit: settings.ai_daily_limit,
        theme: settings.theme,
        accent_color: settings.accent_color,
        compact_view: settings.compact_view,
        show_images: settings.show_images,
        social_feed_enabled: settings.social_feed_enabled,
        show_friend_activity: settings.show_friend_activity,
        social_feed_priority: settings.social_feed_priority,
        share_reading_activity: settings.share_reading_activity,
        created_at: settings.created_at.toISOString(),
        updated_at: settings.updated_at.toISOString()
      } : null,
      interests: interests.map(interest => ({
        category: interest.category,
        selected_at: interest.selected_at.toISOString(),
        created_at: interest.created_at.toISOString()
      })),
      privacySettings: privacySettings ? {
        discoverable: privacySettings.discoverable,
        allow_friend_requests_from: privacySettings.allow_friend_requests_from,
        show_activity_to: privacySettings.show_activity_to,
        email_notifications: privacySettings.email_notifications,
        push_notifications: privacySettings.push_notifications,
        created_at: privacySettings.created_at.toISOString(),
        updated_at: privacySettings.updated_at.toISOString()
      } : null,
      socialData: {
        friendships: friendshipData.map(friendship => ({
          id: friendship.id,
          user1_id: friendship.user1_id,
          user2_id: friendship.user2_id,
          status: friendship.status,
          requested_by: friendship.requested_by,
          requested_at: friendship.requested_at.toISOString(),
          confirmed_at: friendship.confirmed_at?.toISOString() || null,
          created_at: friendship.created_at.toISOString(),
          updated_at: friendship.updated_at.toISOString(),
          // Add context for user
          role: friendship.user1_id === userId ? 'user1' : 'user2',
          friend_id: friendship.user1_id === userId ? friendship.user2_id : friendship.user1_id
        })),
        comments: comments.map(comment => ({
          id: comment.id,
          article_id: comment.article_id,
          content: comment.content,
          tagged_users: comment.tagged_users || [],
          created_at: comment.created_at.toISOString(),
          updated_at: comment.updated_at.toISOString(),
          deleted_at: comment.deleted_at?.toISOString() || null
        })),
        blocksGiven: blocksGiven.map(block => ({
          id: block.id,
          blocked_user_id: block.blocked_id,
          created_at: block.created_at.toISOString()
        })),
        blocksReceived: blocksReceived.map(block => ({
          id: block.id,
          blocker_user_id: block.blocker_id,
          created_at: block.created_at.toISOString()
        })),
        notifications: userNotifications.map(notification => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data || "{}",
          read_at: notification.read_at?.toISOString() || null,
          created_at: notification.created_at.toISOString(),
          expires_at: notification.expires_at?.toISOString() || null
        }))
      },
      feedData: {
        feeds: userFeeds.map(feed => ({
          id: feed.id,
          name: feed.name,
          url: feed.url,
          site_url: feed.site_url,
          description: feed.description,
          icon_url: feed.icon_url,
          status: feed.status,
          priority: feed.priority,
          article_count: feed.article_count,
          created_at: feed.created_at.toISOString(),
          updated_at: feed.updated_at.toISOString()
        })),
        articleInteractions: articleInteractions.map(interaction => ({
          id: interaction.id,
          article_id: interaction.article_id,
          is_read: interaction.is_read,
          read_at: interaction.read_at?.toISOString() || null,
          is_starred: interaction.is_starred,
          starred_at: interaction.starred_at?.toISOString() || null,
          clicked_at: interaction.clicked_at?.toISOString() || null,
          time_spent_seconds: interaction.time_spent_seconds,
          engagement_signal: interaction.engagement_signal,
          engagement_signal_at: interaction.engagement_signal_at?.toISOString() || null,
          created_at: interaction.created_at.toISOString(),
          updated_at: interaction.updated_at.toISOString()
        }))
      }
    };

    return exportData;
  }

  /**
   * Delete all user data completely and permanently
   * Requirements: 6.5 - Complete data deletion functionality
   * 
   * @param userId - ID of the user requesting data deletion
   * @returns Promise<DataDeletionResult> - Summary of deleted data
   */
  async deleteUserData(userId: string): Promise<DataDeletionResult> {
    const deletionResult: DataDeletionResult = {
      deletedAt: new Date().toISOString(),
      userId: userId,
      deletedCounts: {
        profile: 0,
        settings: 0,
        interests: 0,
        privacySettings: 0,
        friendships: 0,
        comments: 0,
        blocks: 0,
        notifications: 0,
        feeds: 0,
        articleInteractions: 0
      }
    };

    // Delete in reverse dependency order to avoid foreign key constraints

    // 1. Delete article interactions
    const deletedArticleInteractions = await this.db
      .delete(userArticles)
      .where(eq(userArticles.user_id, userId))
      .returning({ id: userArticles.id });
    deletionResult.deletedCounts.articleInteractions = deletedArticleInteractions.length;

    // 2. Delete feeds (will cascade to articles and related data)
    const deletedFeeds = await this.db
      .delete(feeds)
      .where(eq(feeds.user_id, userId))
      .returning({ id: feeds.id });
    deletionResult.deletedCounts.feeds = deletedFeeds.length;

    // 3. Delete notifications
    const deletedNotifications = await this.db
      .delete(notifications)
      .where(eq(notifications.user_id, userId))
      .returning({ id: notifications.id });
    deletionResult.deletedCounts.notifications = deletedNotifications.length;

    // 4. Delete blocks (both directions)
    const deletedBlocks = await this.db
      .delete(userBlocks)
      .where(
        or(
          eq(userBlocks.blocker_id, userId),
          eq(userBlocks.blocked_id, userId)
        )
      )
      .returning({ id: userBlocks.id });
    deletionResult.deletedCounts.blocks = deletedBlocks.length;

    // 5. Delete comments
    const deletedComments = await this.db
      .delete(articleComments)
      .where(eq(articleComments.user_id, userId))
      .returning({ id: articleComments.id });
    deletionResult.deletedCounts.comments = deletedComments.length;

    // 6. Delete friendships (both directions)
    const deletedFriendships = await this.db
      .delete(friendships)
      .where(
        or(
          eq(friendships.user1_id, userId),
          eq(friendships.user2_id, userId)
        )
      )
      .returning({ id: friendships.id });
    deletionResult.deletedCounts.friendships = deletedFriendships.length;

    // 7. Delete privacy settings
    const deletedPrivacySettings = await this.db
      .delete(userPrivacySettings)
      .where(eq(userPrivacySettings.user_id, userId))
      .returning({ user_id: userPrivacySettings.user_id });
    deletionResult.deletedCounts.privacySettings = deletedPrivacySettings.length;

    // 8. Delete interests
    const deletedInterests = await this.db
      .delete(userInterests)
      .where(eq(userInterests.user_id, userId))
      .returning({ id: userInterests.id });
    deletionResult.deletedCounts.interests = deletedInterests.length;

    // 9. Delete settings
    const deletedSettings = await this.db
      .delete(userSettings)
      .where(eq(userSettings.user_id, userId))
      .returning({ id: userSettings.id });
    deletionResult.deletedCounts.settings = deletedSettings.length;

    // 10. Finally delete profile (this should cascade to any remaining references)
    const deletedProfiles = await this.db
      .delete(profiles)
      .where(eq(profiles.id, userId))
      .returning({ id: profiles.id });
    deletionResult.deletedCounts.profile = deletedProfiles.length;

    return deletionResult;
  }

  /**
   * Get summary of user data for deletion preview
   * Requirements: 6.5 - Allow users to understand what data will be deleted
   * 
   * @param userId - ID of the user
   * @returns Promise<DataSummary> - Summary of user's data
   */
  async getUserDataSummary(userId: string): Promise<DataSummary> {
    // Count friendships
    const friendshipCount = await this.db
      .select({ count: sql`count(*)` })
      .from(friendships)
      .where(
        or(
          eq(friendships.user1_id, userId),
          eq(friendships.user2_id, userId)
        )
      );

    // Count comments
    const commentCount = await this.db
      .select({ count: sql`count(*)` })
      .from(articleComments)
      .where(eq(articleComments.user_id, userId));

    // Count blocks
    const blockCount = await this.db
      .select({ count: sql`count(*)` })
      .from(userBlocks)
      .where(
        or(
          eq(userBlocks.blocker_id, userId),
          eq(userBlocks.blocked_id, userId)
        )
      );

    // Count notifications
    const notificationCount = await this.db
      .select({ count: sql`count(*)` })
      .from(notifications)
      .where(eq(notifications.user_id, userId));

    // Count feeds
    const feedCount = await this.db
      .select({ count: sql`count(*)` })
      .from(feeds)
      .where(eq(feeds.user_id, userId));

    // Count article interactions
    const articleInteractionCount = await this.db
      .select({ count: sql`count(*)` })
      .from(userArticles)
      .where(eq(userArticles.user_id, userId));

    return {
      userId,
      friendships: Number(friendshipCount[0]?.count || 0),
      comments: Number(commentCount[0]?.count || 0),
      blocks: Number(blockCount[0]?.count || 0),
      notifications: Number(notificationCount[0]?.count || 0),
      feeds: Number(feedCount[0]?.count || 0),
      articleInteractions: Number(articleInteractionCount[0]?.count || 0)
    };
  }
}

// Type definitions for data export

export interface UserDataExport {
  exportedAt: string;
  userId: string;
  profile: {
    id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    timezone: string;
    region_code: string | null;
    onboarding_completed: boolean;
    created_at: string;
    updated_at: string;
  };
  settings: {
    default_polling_interval: string;
    adaptive_polling_enabled: boolean;
    digest_enabled: boolean;
    digest_frequency: string;
    digest_time: string;
    digest_timezone: string;
    digest_max_articles: string;
    ai_summaries_enabled: boolean;
    ai_clustering_enabled: boolean;
    ai_daily_limit: string;
    theme: string;
    accent_color: string;
    compact_view: boolean;
    show_images: boolean;
    social_feed_enabled: boolean;
    show_friend_activity: boolean;
    social_feed_priority: string;
    share_reading_activity: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  interests: Array<{
    category: string;
    selected_at: string;
    created_at: string;
  }>;
  privacySettings: {
    discoverable: boolean;
    allow_friend_requests_from: string;
    show_activity_to: string;
    email_notifications: boolean;
    push_notifications: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  socialData: {
    friendships: Array<{
      id: string;
      user1_id: string;
      user2_id: string;
      status: string;
      requested_by: string;
      requested_at: string;
      confirmed_at: string | null;
      created_at: string;
      updated_at: string;
      role: 'user1' | 'user2';
      friend_id: string;
    }>;
    comments: Array<{
      id: string;
      article_id: string;
      content: string;
      tagged_users: string[];
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>;
    blocksGiven: Array<{
      id: string;
      blocked_user_id: string;
      created_at: string;
    }>;
    blocksReceived: Array<{
      id: string;
      blocker_user_id: string;
      created_at: string;
    }>;
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      data: string;
      read_at: string | null;
      created_at: string;
      expires_at: string | null;
    }>;
  };
  feedData: {
    feeds: Array<{
      id: string;
      name: string;
      url: string;
      site_url: string | null;
      description: string | null;
      icon_url: string | null;
      status: string;
      priority: string;
      article_count: number;
      created_at: string;
      updated_at: string;
    }>;
    articleInteractions: Array<{
      id: string;
      article_id: string;
      is_read: boolean;
      read_at: string | null;
      is_starred: boolean;
      starred_at: string | null;
      clicked_at: string | null;
      time_spent_seconds: number | null;
      engagement_signal: string | null;
      engagement_signal_at: string | null;
      created_at: string;
      updated_at: string;
    }>;
  };
}

export interface DataDeletionResult {
  deletedAt: string;
  userId: string;
  deletedCounts: {
    profile: number;
    settings: number;
    interests: number;
    privacySettings: number;
    friendships: number;
    comments: number;
    blocks: number;
    notifications: number;
    feeds: number;
    articleInteractions: number;
  };
}

export interface DataSummary {
  userId: string;
  friendships: number;
  comments: number;
  blocks: number;
  notifications: number;
  feeds: number;
  articleInteractions: number;
}

// Export singleton instance
export const dataExportService = new DataExportService();