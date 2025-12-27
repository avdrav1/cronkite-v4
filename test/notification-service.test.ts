import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { notificationService } from '../server/notification-service';
import { getDatabase } from '../server/production-db';
import { profiles, notifications, userPrivacySettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('NotificationService', () => {
  const db = getDatabase();
  let testUserId: string;
  let testUser2Id: string;

  beforeEach(async () => {
    // Create test users
    const [user1, user2] = await db
      .insert(profiles)
      .values([
        {
          email: 'test1@example.com',
          display_name: 'Test User 1',
          timezone: 'America/New_York',
          is_admin: false
        },
        {
          email: 'test2@example.com',
          display_name: 'Test User 2',
          timezone: 'America/New_York',
          is_admin: false
        }
      ])
      .returning();

    testUserId = user1.id;
    testUser2Id = user2.id;

    // Create privacy settings for test users
    await db
      .insert(userPrivacySettings)
      .values([
        {
          user_id: testUserId,
          discoverable: true,
          allow_friend_requests_from: 'everyone',
          show_activity_to: 'friends',
          email_notifications: true,
          push_notifications: true
        },
        {
          user_id: testUser2Id,
          discoverable: true,
          allow_friend_requests_from: 'everyone',
          show_activity_to: 'friends',
          email_notifications: true,
          push_notifications: true
        }
      ]);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(notifications);
    await db.delete(userPrivacySettings);
    await db.delete(profiles);
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      const notification = await notificationService.createNotification({
        userId: testUserId,
        type: 'friend_request',
        title: 'Test Notification',
        message: 'This is a test notification',
        data: { testData: 'value' }
      });

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(testUserId);
      expect(notification.type).toBe('friend_request');
      expect(notification.title).toBe('Test Notification');
      expect(notification.message).toBe('This is a test notification');
      expect(notification.data).toEqual({ testData: 'value' });
      expect(notification.readAt).toBeUndefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        notificationService.createNotification({
          userId: '00000000-0000-0000-0000-000000000000', // Valid UUID format but non-existent
          type: 'friend_request',
          title: 'Test',
          message: 'Test'
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('getNotifications', () => {
    it('should return user notifications', async () => {
      // Create test notifications
      await notificationService.createNotification({
        userId: testUserId,
        type: 'friend_request',
        title: 'Notification 1',
        message: 'Message 1'
      });

      await notificationService.createNotification({
        userId: testUserId,
        type: 'comment_tag',
        title: 'Notification 2',
        message: 'Message 2'
      });

      const notifications = await notificationService.getNotifications(testUserId);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toBe('Notification 2'); // Most recent first
      expect(notifications[1].title).toBe('Notification 1');
    });

    it('should only return notifications for the specified user', async () => {
      // Create notifications for both users
      await notificationService.createNotification({
        userId: testUserId,
        type: 'friend_request',
        title: 'User 1 Notification',
        message: 'Message for user 1'
      });

      await notificationService.createNotification({
        userId: testUser2Id,
        type: 'friend_request',
        title: 'User 2 Notification',
        message: 'Message for user 2'
      });

      const user1Notifications = await notificationService.getNotifications(testUserId);
      const user2Notifications = await notificationService.getNotifications(testUser2Id);

      expect(user1Notifications).toHaveLength(1);
      expect(user1Notifications[0].title).toBe('User 1 Notification');

      expect(user2Notifications).toHaveLength(1);
      expect(user2Notifications[0].title).toBe('User 2 Notification');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = await notificationService.createNotification({
        userId: testUserId,
        type: 'friend_request',
        title: 'Test Notification',
        message: 'Test message'
      });

      expect(notification.readAt).toBeUndefined();

      await notificationService.markAsRead(notification.id, testUserId);

      const updatedNotifications = await notificationService.getNotifications(testUserId);
      expect(updatedNotifications[0].readAt).toBeDefined();
    });

    it('should throw error when user tries to mark another users notification as read', async () => {
      const notification = await notificationService.createNotification({
        userId: testUserId,
        type: 'friend_request',
        title: 'Test Notification',
        message: 'Test message'
      });

      await expect(
        notificationService.markAsRead(notification.id, testUser2Id)
      ).rejects.toThrow('Not authorized to mark this notification as read');
    });
  });

  describe('createFriendRequestNotification', () => {
    it('should create friend request notification with correct data', async () => {
      const notification = await notificationService.createFriendRequestNotification(
        testUser2Id,
        testUserId,
        'friend-request-id'
      );

      expect(notification.userId).toBe(testUserId);
      expect(notification.type).toBe('friend_request');
      expect(notification.title).toBe('New Friend Request');
      expect(notification.message).toBe('Test User 2 sent you a friend request');
      expect(notification.data.fromUserId).toBe(testUser2Id);
      expect(notification.data.fromUserName).toBe('Test User 2');
      expect(notification.data.friendRequestId).toBe('friend-request-id');
    });
  });

  describe('createCommentTagNotification', () => {
    it('should create comment tag notification with correct data', async () => {
      const notification = await notificationService.createCommentTagNotification(
        testUser2Id,
        testUserId,
        'comment-id',
        'article-id',
        'Test Article Title'
      );

      expect(notification.userId).toBe(testUserId);
      expect(notification.type).toBe('comment_tag');
      expect(notification.title).toBe('You were tagged in a comment');
      expect(notification.message).toBe('Test User 2 tagged you in a comment on "Test Article Title"');
      expect(notification.data.taggerUserId).toBe(testUser2Id);
      expect(notification.data.taggerUserName).toBe('Test User 2');
      expect(notification.data.commentId).toBe('comment-id');
      expect(notification.data.articleId).toBe('article-id');
      expect(notification.data.articleTitle).toBe('Test Article Title');
    });
  });

  describe('getUnreadCount', () => {
    it('should return correct unread count', async () => {
      // Initially no notifications
      let count = await notificationService.getUnreadCount(testUserId);
      expect(count).toBe(0);

      // Create two notifications
      const notification1 = await notificationService.createNotification({
        userId: testUserId,
        type: 'friend_request',
        title: 'Notification 1',
        message: 'Message 1'
      });

      await notificationService.createNotification({
        userId: testUserId,
        type: 'comment_tag',
        title: 'Notification 2',
        message: 'Message 2'
      });

      count = await notificationService.getUnreadCount(testUserId);
      expect(count).toBe(2);

      // Mark one as read
      await notificationService.markAsRead(notification1.id, testUserId);

      count = await notificationService.getUnreadCount(testUserId);
      expect(count).toBe(1);
    });
  });
});