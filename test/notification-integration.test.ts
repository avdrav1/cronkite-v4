import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { friendService } from '../server/friend-service';
import { commentService } from '../server/comment-service';
import { notificationService } from '../server/notification-service';
import { getDatabase } from '../server/production-db';
import { profiles, userPrivacySettings, notifications as notificationsTable, feeds, articles } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('Notification Integration', () => {
  const db = getDatabase();
  let testUserId: string;
  let testUser2Id: string;
  let testFeedId: string;
  let testArticleId: string;

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

    // Create test feed and article for comment testing
    const [feed] = await db
      .insert(feeds)
      .values({
        user_id: testUserId,
        name: 'Test Feed',
        url: 'https://example.com/feed.xml',
        status: 'active',
        priority: 'medium',
        sync_priority: 'medium',
        sync_interval_hours: 24,
        article_count: 0
      })
      .returning();

    testFeedId = feed.id;

    const [article] = await db
      .insert(articles)
      .values({
        feed_id: testFeedId,
        guid: 'test-article-1',
        title: 'Test Article',
        url: 'https://example.com/article1',
        published_at: new Date(),
        embedding_status: 'pending',
        content_hash: 'test-hash'
      })
      .returning();

    testArticleId = article.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(notificationsTable);
    await db.delete(articles);
    await db.delete(feeds);
    await db.delete(userPrivacySettings);
    await db.delete(profiles);
  });

  describe('Friend Request Notifications', () => {
    it('should create notification when friend request is sent', async () => {
      // Send friend request
      await friendService.sendFriendRequest(testUser2Id, testUserId);

      // Check that notification was created
      const notifications = await notificationService.getNotifications(testUserId);
      
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('friend_request');
      expect(notifications[0].title).toBe('New Friend Request');
      expect(notifications[0].message).toBe('Test User 2 sent you a friend request');
      expect(notifications[0].data.fromUserId).toBe(testUser2Id);
      expect(notifications[0].data.fromUserName).toBe('Test User 2');
    });

    it('should create notification when friend request is accepted', async () => {
      // Send and accept friend request
      const friendRequest = await friendService.sendFriendRequest(testUser2Id, testUserId);
      await friendService.acceptFriendRequest(friendRequest.id, testUserId);

      // Check that acceptance notification was created for the original requester
      const notifications = await notificationService.getNotifications(testUser2Id);
      
      // Should have the acceptance notification (the request notification goes to the other user)
      const acceptanceNotification = notifications.find(n => n.type === 'friend_accepted');
      expect(acceptanceNotification).toBeDefined();
      expect(acceptanceNotification!.title).toBe('Friend Request Accepted');
      expect(acceptanceNotification!.message).toBe('Test User 1 accepted your friend request');
      expect(acceptanceNotification!.data.acceptedByUserId).toBe(testUserId);
      expect(acceptanceNotification!.data.acceptedByUserName).toBe('Test User 1');
    });
  });

  describe('Comment Tag Notifications', () => {
    it('should create notification when user is tagged in comment', async () => {
      // First make users friends so they can tag each other
      const friendRequest = await friendService.sendFriendRequest(testUser2Id, testUserId);
      await friendService.acceptFriendRequest(friendRequest.id, testUserId);

      // Clear existing notifications
      await db.delete(notificationsTable);

      // Create comment with tag
      await commentService.addComment({
        articleId: testArticleId,
        userId: testUser2Id,
        content: 'Great article!',
        taggedUserIds: [testUserId]
      });

      // Check that tag notification was created
      const notifications = await notificationService.getNotifications(testUserId);
      
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('comment_tag');
      expect(notifications[0].title).toBe('You were tagged in a comment');
      expect(notifications[0].message).toBe('Test User 2 tagged you in a comment on "Test Article"');
      expect(notifications[0].data.taggerUserId).toBe(testUser2Id);
      expect(notifications[0].data.taggerUserName).toBe('Test User 2');
      expect(notifications[0].data.articleTitle).toBe('Test Article');
    });
  });

  describe('Comment Reply Notifications', () => {
    it('should create notification when user replies to comment', async () => {
      // First make users friends so they can comment
      const friendRequest = await friendService.sendFriendRequest(testUser2Id, testUserId);
      await friendService.acceptFriendRequest(friendRequest.id, testUserId);

      // Clear existing notifications
      await db.delete(notificationsTable);

      // User 1 creates original comment
      const originalComment = await commentService.addComment({
        articleId: testArticleId,
        userId: testUserId,
        content: 'Original comment'
      });

      // User 2 replies to the comment
      await commentService.addCommentReply(
        testArticleId,
        testUser2Id,
        'Reply to your comment',
        originalComment.id
      );

      // Check that reply notification was created for original commenter
      const notifications = await notificationService.getNotifications(testUserId);
      
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('comment_reply');
      expect(notifications[0].title).toBe('New reply to your comment');
      expect(notifications[0].message).toBe('Test User 2 replied to your comment on "Test Article"');
      expect(notifications[0].data.replierUserId).toBe(testUser2Id);
      expect(notifications[0].data.replierUserName).toBe('Test User 2');
      expect(notifications[0].data.articleTitle).toBe('Test Article');
    });
  });
});