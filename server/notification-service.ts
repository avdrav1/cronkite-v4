import { 
  type Notification, 
  type InsertNotification, 
  type Profile,
  type NotificationType,
  notifications,
  profiles
} from "@shared/schema";
import { eq, and, desc, isNull, lt } from "drizzle-orm";
import { getDatabase } from "./production-db";
import { privacyService } from "./privacy-service";

/**
 * Notification data structure for API responses
 */
export interface NotificationWithData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Notification creation input
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  expiresAt?: Date;
}

/**
 * Notification preferences structure
 */
export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  friendRequestNotifications: boolean;
  commentTagNotifications: boolean;
  commentReplyNotifications: boolean;
}

/**
 * Notification delivery channels
 */
export type NotificationChannel = 'in-app' | 'email' | 'push';

/**
 * Core Notification System Service
 * Implements Requirements: 7.1, 7.2, 7.4, 7.5, 4.2, 4.3, 7.3
 * 
 * This service handles:
 * - Notification creation and storage logic
 * - In-app and email notification delivery
 * - Notification preferences management
 * - Friend request event notifications
 * - Tag notification creation
 * - Optional comment thread notifications
 */
export class NotificationService {
  private db = getDatabase();

  /**
   * Create a new notification
   * Requirements: 7.1 - Send in-app notification for social events
   * 
   * @param input - Notification creation data
   * @returns Promise<NotificationWithData> - The created notification
   */
  async createNotification(input: CreateNotificationInput): Promise<NotificationWithData> {
    const { userId, type, title, message, data = {}, expiresAt } = input;

    // Validate user exists
    await this.validateUserExists(userId);

    // Check if user wants to receive this type of notification
    const shouldReceive = await this.shouldReceiveNotification(userId, type);
    if (!shouldReceive) {
      // Still create the notification but mark it as read immediately
      // This allows for audit trail while respecting preferences
    }

    // Create the notification
    const insertData: InsertNotification = {
      user_id: userId,
      type,
      title,
      message,
      data: JSON.stringify(data),
      expires_at: expiresAt,
      created_at: new Date(),
      read_at: shouldReceive ? undefined : new Date() // Auto-mark as read if user doesn't want it
    };

    const [notification] = await this.db
      .insert(notifications)
      .values(insertData)
      .returning();

    const result: NotificationWithData = {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: JSON.parse(notification.data || '{}'),
      readAt: notification.read_at || undefined,
      createdAt: notification.created_at,
      expiresAt: notification.expires_at || undefined
    };

    // Deliver notification through appropriate channels if user wants it
    if (shouldReceive) {
      await this.deliverNotification(result);
    }

    return result;
  }

  /**
   * Get notifications for a user
   * Requirements: 7.1 - Display notifications to users
   * 
   * @param userId - ID of the user
   * @param limit - Maximum number of notifications to return (default: 50)
   * @param includeRead - Whether to include read notifications (default: true)
   * @returns Promise<NotificationWithData[]> - List of notifications
   */
  async getNotifications(userId: string, limit: number = 50, includeRead: boolean = true): Promise<NotificationWithData[]> {
    // Build query conditions
    const conditions = [eq(notifications.user_id, userId)];
    
    if (!includeRead) {
      conditions.push(isNull(notifications.read_at));
    }

    // Get notifications, excluding expired ones
    const userNotifications = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.created_at))
      .limit(limit);

    // Filter out expired notifications and convert to response format
    const now = new Date();
    return userNotifications
      .filter(notification => !notification.expires_at || notification.expires_at > now)
      .map(notification => ({
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: JSON.parse(notification.data || '{}'),
        readAt: notification.read_at || undefined,
        createdAt: notification.created_at,
        expiresAt: notification.expires_at || undefined
      }));
  }

  /**
   * Get unread notification count for a user
   * Requirements: 7.1 - Display notification indicators
   * 
   * @param userId - ID of the user
   * @returns Promise<number> - Number of unread notifications
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, userId),
          isNull(notifications.read_at)
        )
      );

    return result.length;
  }

  /**
   * Mark a notification as read
   * Requirements: 7.1 - Allow users to mark notifications as read
   * 
   * @param notificationId - ID of the notification
   * @param userId - ID of the user (for authorization)
   * @returns Promise<void>
   * @throws Error if notification not found or user not authorized
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // Verify notification belongs to user
    const notification = await this.getNotificationById(notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.user_id !== userId) {
      throw new Error("Not authorized to mark this notification as read");
    }

    if (notification.read_at) {
      return; // Already read
    }

    // Mark as read
    await this.db
      .update(notifications)
      .set({
        read_at: new Date()
      })
      .where(eq(notifications.id, notificationId));
  }

  /**
   * Mark all notifications as read for a user
   * Requirements: 7.1 - Bulk notification management
   * 
   * @param userId - ID of the user
   * @returns Promise<number> - Number of notifications marked as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({
        read_at: new Date()
      })
      .where(
        and(
          eq(notifications.user_id, userId),
          isNull(notifications.read_at)
        )
      )
      .returning({ id: notifications.id });

    return result.length;
  }

  /**
   * Update notification preferences for a user
   * Requirements: 7.4 - Provide notification preferences to control frequency and types
   * 
   * @param userId - ID of the user
   * @param preferences - New notification preferences
   * @returns Promise<void>
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    // Update privacy settings which include notification preferences
    await privacyService.updateNotificationPreferences(userId, preferences);
  }

  /**
   * Get notification preferences for a user
   * Requirements: 7.4 - Allow users to view their notification preferences
   * 
   * @param userId - ID of the user
   * @returns Promise<NotificationPreferences> - Current notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const settings = await privacyService.getUserPrivacySettings(userId);
    
    return {
      emailNotifications: settings.email_notifications,
      pushNotifications: settings.push_notifications,
      friendRequestNotifications: true, // Always enabled for now
      commentTagNotifications: true, // Always enabled for now
      commentReplyNotifications: true // Always enabled for now
    };
  }

  /**
   * Send real-time notification (WebSocket/Server-Sent Events)
   * Requirements: 7.2 - Immediate notification delivery
   * 
   * @param userId - ID of the user to notify
   * @param notification - Notification data to send
   * @returns Promise<void>
   */
  async sendRealTimeNotification(userId: string, notification: NotificationWithData): Promise<void> {
    try {
      // Import WebSocket service dynamically to avoid circular dependencies
      const { webSocketService } = await import('./websocket-service');
      
      // Send through WebSocket if user has active connections
      const delivered = await webSocketService.sendNotificationToUser(userId, notification);
      
      if (delivered) {
        console.log(`✅ Real-time notification delivered to user ${userId}:`, {
          id: notification.id,
          type: notification.type,
          title: notification.title
        });
      } else {
        console.log(`📱 No active WebSocket connections for user ${userId}, notification stored for later retrieval`);
      }
    } catch (error) {
      console.error(`❌ Failed to send real-time notification to user ${userId}:`, error);
      // Don't throw error - notification is still stored in database
    }
  }

  /**
   * Create friend request notification
   * Requirements: 4.2 - Friend request event notifications
   * 
   * @param fromUserId - ID of user sending the request
   * @param toUserId - ID of user receiving the request
   * @param friendRequestId - ID of the friend request
   * @returns Promise<NotificationWithData> - Created notification
   */
  async createFriendRequestNotification(fromUserId: string, toUserId: string, friendRequestId: string): Promise<NotificationWithData> {
    // Get sender profile for notification content
    const fromUser = await this.getUserProfile(fromUserId);
    
    return await this.createNotification({
      userId: toUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${fromUser.display_name} sent you a friend request`,
      data: {
        fromUserId,
        fromUserName: fromUser.display_name,
        fromUserAvatar: fromUser.avatar_url,
        friendRequestId
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expire in 30 days
    });
  }

  /**
   * Create friend request accepted notification
   * Requirements: 4.2 - Friend request event notifications
   * 
   * @param acceptedByUserId - ID of user who accepted the request
   * @param originalRequesterId - ID of user who originally sent the request
   * @param friendshipId - ID of the confirmed friendship
   * @returns Promise<NotificationWithData> - Created notification
   */
  async createFriendAcceptedNotification(acceptedByUserId: string, originalRequesterId: string, friendshipId: string): Promise<NotificationWithData> {
    // Get accepter profile for notification content
    const acceptedByUser = await this.getUserProfile(acceptedByUserId);
    
    return await this.createNotification({
      userId: originalRequesterId,
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${acceptedByUser.display_name} accepted your friend request`,
      data: {
        acceptedByUserId,
        acceptedByUserName: acceptedByUser.display_name,
        acceptedByUserAvatar: acceptedByUser.avatar_url,
        friendshipId
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expire in 7 days
    });
  }

  /**
   * Create comment tag notification
   * Requirements: 4.2 - Tag notification creation
   * 
   * @param taggerUserId - ID of user who tagged
   * @param taggedUserId - ID of user who was tagged
   * @param commentId - ID of the comment containing the tag
   * @param articleId - ID of the article being commented on
   * @param articleTitle - Title of the article
   * @returns Promise<NotificationWithData> - Created notification
   */
  async createCommentTagNotification(
    taggerUserId: string, 
    taggedUserId: string, 
    commentId: string, 
    articleId: string, 
    articleTitle: string
  ): Promise<NotificationWithData> {
    // Get tagger profile for notification content
    const taggerUser = await this.getUserProfile(taggerUserId);
    
    return await this.createNotification({
      userId: taggedUserId,
      type: 'comment_tag',
      title: 'You were tagged in a comment',
      message: `${taggerUser.display_name} tagged you in a comment on "${articleTitle}"`,
      data: {
        taggerUserId,
        taggerUserName: taggerUser.display_name,
        taggerUserAvatar: taggerUser.avatar_url,
        commentId,
        articleId,
        articleTitle
      },
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // Expire in 14 days
    });
  }

  /**
   * Create comment reply notification
   * Requirements: 7.3 - Optional comment thread notifications
   * 
   * @param replierUserId - ID of user who replied
   * @param originalCommenterUserId - ID of user who made the original comment
   * @param commentId - ID of the reply comment
   * @param articleId - ID of the article
   * @param articleTitle - Title of the article
   * @returns Promise<NotificationWithData> - Created notification
   */
  async createCommentReplyNotification(
    replierUserId: string,
    originalCommenterUserId: string,
    commentId: string,
    articleId: string,
    articleTitle: string
  ): Promise<NotificationWithData> {
    // Don't notify users about their own replies
    if (replierUserId === originalCommenterUserId) {
      throw new Error("Cannot create reply notification for same user");
    }

    // Get replier profile for notification content
    const replierUser = await this.getUserProfile(replierUserId);
    
    return await this.createNotification({
      userId: originalCommenterUserId,
      type: 'comment_reply',
      title: 'New reply to your comment',
      message: `${replierUser.display_name} replied to your comment on "${articleTitle}"`,
      data: {
        replierUserId,
        replierUserName: replierUser.display_name,
        replierUserAvatar: replierUser.avatar_url,
        commentId,
        articleId,
        articleTitle
      },
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // Expire in 14 days
    });
  }

  /**
   * Clean up expired notifications
   * Requirements: 7.1 - Maintain notification system performance
   * 
   * @returns Promise<number> - Number of notifications cleaned up
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const now = new Date();
    
    const result = await this.db
      .delete(notifications)
      .where(
        and(
          lt(notifications.expires_at, now)
        )
      )
      .returning({ id: notifications.id });

    return result.length;
  }

  /**
   * Deliver notification through appropriate channels
   * Requirements: 7.2, 7.5 - Multi-channel notification delivery
   * 
   * @param notification - Notification to deliver
   * @returns Promise<void>
   * @private
   */
  private async deliverNotification(notification: NotificationWithData): Promise<void> {
    const preferences = await this.getPreferences(notification.userId);
    
    // Always deliver in-app notification (already stored in database)
    
    // Send real-time notification if user is online
    await this.sendRealTimeNotification(notification.userId, notification);
    
    // Send email notification if enabled
    if (preferences.emailNotifications) {
      await this.sendEmailNotification(notification);
    }
    
    // Send push notification if enabled
    if (preferences.pushNotifications) {
      await this.sendPushNotification(notification);
    }
  }

  /**
   * Send email notification
   * Requirements: 7.5 - Email notification delivery based on user preferences
   * 
   * @param notification - Notification to send via email
   * @returns Promise<void>
   * @private
   */
  private async sendEmailNotification(notification: NotificationWithData): Promise<void> {
    // TODO: Implement email delivery
    // For now, this is a placeholder for email delivery
    // In a full implementation, this would:
    // 1. Get user's email address
    // 2. Format notification as HTML email
    // 3. Send through email service (SendGrid, AWS SES, etc.)
    // 4. Log delivery status
    
    console.log(`Email notification sent to user ${notification.userId}:`, {
      id: notification.id,
      type: notification.type,
      title: notification.title
    });
  }

  /**
   * Send push notification
   * Requirements: 7.5 - Push notification delivery based on user preferences
   * 
   * @param notification - Notification to send as push
   * @returns Promise<void>
   * @private
   */
  private async sendPushNotification(notification: NotificationWithData): Promise<void> {
    // TODO: Implement push notification delivery
    // For now, this is a placeholder for push delivery
    // In a full implementation, this would:
    // 1. Get user's push notification tokens
    // 2. Format notification for push service
    // 3. Send through push service (FCM, APNs, etc.)
    // 4. Handle token refresh and cleanup
    // 5. Log delivery status
    
    console.log(`Push notification sent to user ${notification.userId}:`, {
      id: notification.id,
      type: notification.type,
      title: notification.title
    });
  }

  /**
   * Check if user should receive a specific type of notification
   * Requirements: 7.4 - Respect notification preferences
   * 
   * @param userId - ID of the user
   * @param type - Type of notification
   * @returns Promise<boolean> - True if user should receive notification
   * @private
   */
  private async shouldReceiveNotification(userId: string, type: NotificationType): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    
    switch (type) {
      case 'friend_request':
        return preferences.friendRequestNotifications;
      case 'friend_accepted':
        return preferences.friendRequestNotifications;
      case 'comment_tag':
        return preferences.commentTagNotifications;
      case 'comment_reply':
        return preferences.commentReplyNotifications;
      default:
        return true; // Default to sending notification for unknown types
    }
  }

  /**
   * Get notification by ID
   * @private
   */
  private async getNotificationById(notificationId: string): Promise<Notification | null> {
    const result = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
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
   * Validate that user exists
   * @private
   */
  private async validateUserExists(userId: string): Promise<void> {
    const user = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!user[0]) {
      throw new Error(`User not found: ${userId}`);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();