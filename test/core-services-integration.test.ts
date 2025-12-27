import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { friendService } from '../server/friend-service';
import { commentService } from '../server/comment-service';
import { privacyService } from '../server/privacy-service';
import { notificationService } from '../server/notification-service';
import { getDatabase } from '../server/production-db';
import { 
  profiles, 
  friendships, 
  articleComments, 
  notifications, 
  userPrivacySettings, 
  userBlocks,
  articles,
  feeds
} from '@shared/schema';

/**
 * Core Services Integration Test
 * 
 * This test suite verifies that all core social services work together correctly:
 * - Friend management integrates with privacy controls
 * - Comment system respects friendship requirements
 * - Notification system triggers for social events
 * - Privacy enforcement works across all services
 * - Database operations maintain consistency
 */
describe('Core Services Integration', () => {
  const db = getDatabase();
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;
  let testFeedId: string;
  let testArticleId: string;

  beforeEach(async () => {
    // Create test users
    const [user1, user2, user3] = await db
      .insert(profiles)
      .values([
        {
          email: 'user1@test.com',
          display_name: 'Alice',
          timezone: 'America/New_York'
        },
        {
          email: 'user2@test.com',
          display_name: 'Bob',
          timezone: 'America/New_York'
        },
        {
          email: 'user3@test.com',
          display_name: 'Charlie',
          timezone: 'America/New_York'
        }
      ])
      .returning();

    user1Id = user1.id;
    user2Id = user2.id;
    user3Id = user3.id;

    // Create a test feed and article for comment testing
    const [feed] = await db
      .insert(feeds)
      .values({
        user_id: user1Id,
        url: 'https://example.com/feed.xml',
        name: 'Test Feed',
        description: 'A test feed',
        folder_name: 'Test',
        last_fetched_at: new Date(),
        status: 'active'
      })
      .returning();

    testFeedId = feed.id;

    const [article] = await db
      .insert(articles)
      .values({
        feed_id: testFeedId,
        title: 'Test Article',
        url: 'https://example.com/article1',
        content: 'This is a test article content',
        published_at: new Date(),
        guid: 'test-article-1'
      })
      .returning();

    testArticleId = article.id;
  });

  afterEach(async () => {
    // Clean up test data in correct order (respecting foreign key constraints)
    await db.delete(notifications);
    await db.delete(articleComments);
    await db.delete(articles);
    await db.delete(feeds);
    await db.delete(userBlocks);
    await db.delete(friendships);
    await db.delete(userPrivacySettings);
    await db.delete(profiles);
  });

  describe('Friend Request to Comment Flow', () => {
    it('should complete full social interaction flow', async () => {
      // Step 1: User1 sends friend request to User2
      const friendRequest = await friendService.sendFriendRequest(user1Id, user2Id);
      
      expect(friendRequest.fromUser.id).toBe(user1Id);
      expect(friendRequest.toUser.id).toBe(user2Id);
      expect(friendRequest.status).toBe('pending');

      // Verify notification was created for friend request
      const user2Notifications = await notificationService.getNotifications(user2Id);
      expect(user2Notifications).toHaveLength(1);
      expect(user2Notifications[0].type).toBe('friend_request');
      expect(user2Notifications[0].data.fromUserId).toBe(user1Id);

      // Step 2: User2 accepts friend request
      const acceptedFriendship = await friendService.acceptFriendRequest(friendRequest.id, user2Id);
      
      expect(acceptedFriendship.status).toBe('confirmed');

      // Verify notification was created for friend acceptance
      const user1Notifications = await notificationService.getNotifications(user1Id);
      expect(user1Notifications).toHaveLength(1);
      expect(user1Notifications[0].type).toBe('friend_accepted');
      expect(user1Notifications[0].data.acceptedByUserId).toBe(user2Id);

      // Step 3: Verify users are now friends
      const areFriends = await friendService.areUsersFriends(user1Id, user2Id);
      expect(areFriends).toBe(true);

      // Step 4: User2 can now comment on User1's article
      const canComment = await privacyService.canComment(user2Id, testArticleId);
      expect(canComment).toBe(true);

      // Step 5: User2 adds comment with tag to User1
      const comment = await commentService.addCommentWithMentions(
        testArticleId,
        user2Id,
        'Great article @Alice! Thanks for sharing.'
      );

      expect(comment.content).toBe('Great article @Alice! Thanks for sharing.');
      expect(comment.author.id).toBe(user2Id);
      expect(comment.taggedUsers).toHaveLength(1);
      expect(comment.taggedUsers[0].id).toBe(user1Id);

      // Verify tag notification was created
      const updatedUser1Notifications = await notificationService.getNotifications(user1Id);
      const tagNotification = updatedUser1Notifications.find(n => n.type === 'comment_tag');
      expect(tagNotification).toBeDefined();
      expect(tagNotification!.data.taggerUserId).toBe(user2Id);
      expect(tagNotification!.data.commentId).toBe(comment.id);

      // Step 6: User1 can see User2's comment
      const comments = await commentService.getComments(testArticleId, user1Id);
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(comment.id);
      expect(comments[0].author.id).toBe(user2Id);
    });

    it('should prevent non-friends from commenting', async () => {
      // User3 (not a friend) should not be able to comment on User1's article
      const canComment = await privacyService.canComment(user3Id, testArticleId);
      expect(canComment).toBe(false);

      // Attempting to add comment should fail
      await expect(
        commentService.addComment({
          articleId: testArticleId,
          userId: user3Id,
          content: 'This should fail'
        })
      ).rejects.toThrow('You do not have permission to comment on this article');
    });

    it('should prevent tagging non-friends', async () => {
      // User1 and User3 are not friends, so User1 cannot tag User3
      const canTag = await privacyService.canTagUser(user1Id, user3Id);
      expect(canTag).toBe(false);

      // Attempting to add comment with invalid tag should fail
      await expect(
        commentService.addComment({
          articleId: testArticleId,
          userId: user1Id,
          content: 'Hello @Charlie',
          taggedUserIds: [user3Id]
        })
      ).rejects.toThrow('You cannot tag user');
    });
  });

  describe('Privacy Enforcement Integration', () => {
    it('should enforce privacy settings across all services', async () => {
      // Set User2 to not allow friend requests from anyone
      await privacyService.updatePrivacySettings(user2Id, {
        allow_friend_requests_from: 'nobody',
        discoverable: false
      });

      // User1 should not be able to send friend request
      const canSendRequest = await privacyService.canSendFriendRequest(user1Id, user2Id);
      expect(canSendRequest).toBe(false);

      await expect(
        friendService.sendFriendRequest(user1Id, user2Id)
      ).rejects.toThrow('Cannot send friend request due to privacy settings');

      // User2 should not appear in search results
      const canIncludeInSearch = await privacyService.canIncludeInSearch(user1Id, user2Id);
      expect(canIncludeInSearch).toBe(false);

      const searchResults = await friendService.searchUsers('Bob', user1Id);
      expect(searchResults).toHaveLength(0);
    });

    it('should respect notification preferences', async () => {
      // Create friendship first
      const friendRequest = await friendService.sendFriendRequest(user1Id, user2Id);
      await friendService.acceptFriendRequest(friendRequest.id, user2Id);

      // Disable email notifications for User2 AFTER friendship is established
      await privacyService.updateNotificationPreferences(user2Id, {
        emailNotifications: false
      });

      // Check notification preferences
      const preferences = await notificationService.getPreferences(user2Id);
      expect(preferences.emailNotifications).toBe(false);
      expect(preferences.pushNotifications).toBe(true);
    });
  });

  describe('Blocking Integration', () => {
    it('should prevent all social interactions when users are blocked', async () => {
      // First establish friendship
      const friendRequest = await friendService.sendFriendRequest(user1Id, user2Id);
      await friendService.acceptFriendRequest(friendRequest.id, user2Id);

      // Verify they are friends
      expect(await friendService.areUsersFriends(user1Id, user2Id)).toBe(true);

      // User1 blocks User2
      await friendService.blockUser(user1Id, user2Id);

      // Verify friendship is removed
      expect(await friendService.areUsersFriends(user1Id, user2Id)).toBe(false);

      // Verify all social interactions are blocked
      expect(await privacyService.canSendFriendRequest(user1Id, user2Id)).toBe(false);
      expect(await privacyService.canSendFriendRequest(user2Id, user1Id)).toBe(false);
      expect(await privacyService.canTagUser(user1Id, user2Id)).toBe(false);
      expect(await privacyService.canTagUser(user2Id, user1Id)).toBe(false);
      expect(await privacyService.canViewProfile(user1Id, user2Id)).toBe(false);
      expect(await privacyService.canViewProfile(user2Id, user1Id)).toBe(false);

      // Verify blocked users don't appear in search
      expect(await privacyService.canIncludeInSearch(user1Id, user2Id)).toBe(false);
      expect(await privacyService.canIncludeInSearch(user2Id, user1Id)).toBe(false);
    });
  });

  describe('Comment Visibility and Privacy', () => {
    it('should only show comments from friends', async () => {
      // Create friendship between User1 and User2
      const friendRequest = await friendService.sendFriendRequest(user1Id, user2Id);
      await friendService.acceptFriendRequest(friendRequest.id, user2Id);

      // User2 (friend) adds comment
      const friendComment = await commentService.addComment({
        articleId: testArticleId,
        userId: user2Id,
        content: 'Comment from friend'
      });

      // User1 can see friend's comment
      const user1Comments = await commentService.getComments(testArticleId, user1Id);
      expect(user1Comments).toHaveLength(1);
      expect(user1Comments[0].id).toBe(friendComment.id);

      // User3 (not a friend) cannot see the comment
      const user3Comments = await commentService.getComments(testArticleId, user3Id);
      expect(user3Comments).toHaveLength(0);
    });

    it('should allow users to see their own comments', async () => {
      // User1 adds comment to their own article
      const ownComment = await commentService.addComment({
        articleId: testArticleId,
        userId: user1Id,
        content: 'My own comment'
      });

      // User1 can see their own comment
      const comments = await commentService.getComments(testArticleId, user1Id);
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(ownComment.id);
    });
  });

  describe('Tag Autocomplete Integration', () => {
    it('should only suggest friends for tagging', async () => {
      // Create friendship between User1 and User2
      const friendRequest = await friendService.sendFriendRequest(user1Id, user2Id);
      await friendService.acceptFriendRequest(friendRequest.id, user2Id);

      // User1 should get User2 as suggestion (they are friends)
      const suggestions = await commentService.getTagSuggestions('Bob', user1Id);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].userId).toBe(user2Id);
      expect(suggestions[0].displayName).toBe('Bob');

      // User1 should not get User3 as suggestion (they are not friends)
      const suggestions2 = await commentService.getTagSuggestions('Charlie', user1Id);
      expect(suggestions2).toHaveLength(0);
    });
  });

  describe('Database Consistency', () => {
    it('should maintain referential integrity during complex operations', async () => {
      // Create friendship
      const friendRequest = await friendService.sendFriendRequest(user1Id, user2Id);
      await friendService.acceptFriendRequest(friendRequest.id, user2Id);

      // Add comment with tag
      const comment = await commentService.addCommentWithMentions(
        testArticleId,
        user2Id,
        'Hello @Alice!'
      );

      // Verify all related records exist
      const friendship = await db
        .select()
        .from(friendships)
        .where(friendships => friendships.status === 'confirmed');
      expect(friendship).toHaveLength(1);

      const comments = await db
        .select()
        .from(articleComments)
        .where(articleComments => articleComments.id === comment.id);
      expect(comments).toHaveLength(1);
      expect(comments[0].tagged_users).toContain(user1Id);

      const notifs = await db
        .select()
        .from(notifications);
      expect(notifs.length).toBeGreaterThan(0);

      // Unfriend users
      await friendService.unfriend(user1Id, user2Id);

      // Verify friendship is removed but comments remain
      const remainingFriendships = await db
        .select()
        .from(friendships)
        .where(friendships => friendships.status === 'confirmed');
      expect(remainingFriendships).toHaveLength(0);

      const remainingComments = await db
        .select()
        .from(articleComments)
        .where(articleComments => articleComments.id === comment.id);
      expect(remainingComments).toHaveLength(1); // Comments persist after unfriending
    });

    it('should handle concurrent operations safely', async () => {
      // Simulate concurrent friend requests (should prevent duplicates)
      const promises = [
        friendService.sendFriendRequest(user1Id, user2Id),
        friendService.sendFriendRequest(user1Id, user2Id)
      ];

      // One should succeed, one should fail
      const results = await Promise.allSettled(promises);
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      
      if (failures[0].status === 'rejected') {
        // Could fail with either our application error or database constraint error
        const errorMessage = failures[0].reason.message;
        const isExpectedError = errorMessage.includes('Friend request already exists') ||
                               errorMessage.includes('duplicate key value') ||
                               errorMessage.includes('unique constraint');
        expect(isExpectedError).toBe(true);
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle cascading errors gracefully', async () => {
      // Try to comment on non-existent article
      await expect(
        commentService.addComment({
          articleId: '00000000-0000-0000-0000-000000000000',
          userId: user1Id,
          content: 'This should fail'
        })
      ).rejects.toThrow();

      // Try to send friend request to non-existent user
      await expect(
        friendService.sendFriendRequest(user1Id, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow();

      // Try to create notification for non-existent user
      await expect(
        notificationService.createNotification({
          userId: '00000000-0000-0000-0000-000000000000',
          type: 'friend_request',
          title: 'Test',
          message: 'Test'
        })
      ).rejects.toThrow('User not found');
    });
  });
});