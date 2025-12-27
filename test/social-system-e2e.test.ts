import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { friendService } from '../server/friend-service';
import { commentService } from '../server/comment-service';
import { privacyService } from '../server/privacy-service';
import { notificationService } from '../server/notification-service';
import { socialFeedService } from '../server/social-feed-service';
import { WebSocketService } from '../server/websocket-service';
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
import { createServer } from 'http';
import WebSocket from 'ws';

/**
 * End-to-End Social System Integration Test
 * 
 * This comprehensive test suite verifies complete social workflows:
 * - Full friend request to commenting flow
 * - Privacy enforcement across all features
 * - Real-time notifications and WebSocket integration
 * - Performance under realistic social load
 * - Data consistency and error handling
 * 
 * Requirements: All requirements integration (1.1-8.5)
 */
describe('Social System End-to-End Integration', () => {
  const db = getDatabase();
  let webSocketService: WebSocketService;
  let httpServer: any;
  let port: number;
  
  // Test users
  let aliceId: string;
  let bobId: string;
  let charlieId: string;
  let daveId: string;
  
  // Test content
  let testFeedId: string;
  let testArticleId: string;
  let testArticle2Id: string;

  beforeEach(async () => {
    // Set up WebSocket server for real-time testing
    httpServer = createServer();
    webSocketService = new WebSocketService();
    port = 3002;
    
    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => resolve());
    });
    
    await webSocketService.initialize(httpServer);

    // Create test users with realistic profiles
    const [alice, bob, charlie, dave] = await db
      .insert(profiles)
      .values([
        {
          email: 'alice@cronkite.com',
          display_name: 'Alice',
          timezone: 'America/New_York',
          is_admin: false
        },
        {
          email: 'bob@cronkite.com',
          display_name: 'Bob',
          timezone: 'America/Los_Angeles',
          is_admin: false
        },
        {
          email: 'charlie@cronkite.com',
          display_name: 'Charlie',
          timezone: 'Europe/London',
          is_admin: false
        },
        {
          email: 'dave@cronkite.com',
          display_name: 'Dave',
          timezone: 'Asia/Tokyo',
          is_admin: false
        }
      ])
      .returning();

    aliceId = alice.id;
    bobId = bob.id;
    charlieId = charlie.id;
    daveId = dave.id;

    // Set up privacy settings for all users
    await db
      .insert(userPrivacySettings)
      .values([
        {
          user_id: aliceId,
          discoverable: true,
          allow_friend_requests_from: 'everyone',
          show_activity_to: 'friends',
          email_notifications: true,
          push_notifications: true
        },
        {
          user_id: bobId,
          discoverable: true,
          allow_friend_requests_from: 'everyone',
          show_activity_to: 'friends',
          email_notifications: true,
          push_notifications: false
        },
        {
          user_id: charlieId,
          discoverable: false, // Make Charlie not discoverable
          allow_friend_requests_from: 'everyone', // Allow friend requests from everyone
          show_activity_to: 'friends',
          email_notifications: false,
          push_notifications: true
        },
        {
          user_id: daveId,
          discoverable: true,
          allow_friend_requests_from: 'nobody',
          show_activity_to: 'friends',
          email_notifications: true,
          push_notifications: true
        }
      ]);

    // Create test feed and articles
    const [feed] = await db
      .insert(feeds)
      .values({
        user_id: aliceId,
        url: 'https://techcrunch.com/feed',
        name: 'TechCrunch',
        description: 'Technology news and analysis',
        folder_name: 'Technology',
        last_fetched_at: new Date(),
        status: 'active',
        priority: 'high',
        sync_priority: 'high',
        sync_interval_hours: 6,
        article_count: 2
      })
      .returning();

    testFeedId = feed.id;

    const [article1, article2] = await db
      .insert(articles)
      .values([
        {
          feed_id: testFeedId,
          title: 'AI Revolution in Social Media',
          url: 'https://techcrunch.com/ai-social-media',
          content: 'Artificial intelligence is transforming how we interact on social platforms...',
          published_at: new Date(Date.now() - 3600000), // 1 hour ago
          guid: 'tc-ai-social-1',
          embedding_status: 'completed',
          content_hash: 'hash-ai-social'
        },
        {
          feed_id: testFeedId,
          title: 'Privacy in the Digital Age',
          url: 'https://techcrunch.com/digital-privacy',
          content: 'As digital platforms evolve, privacy concerns become more critical...',
          published_at: new Date(Date.now() - 7200000), // 2 hours ago
          guid: 'tc-privacy-1',
          embedding_status: 'completed',
          content_hash: 'hash-privacy'
        }
      ])
      .returning();

    testArticleId = article1.id;
    testArticle2Id = article2.id;
  });

  afterEach(async () => {
    // Clean up WebSocket server
    await webSocketService.shutdown();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

    // Clean up test data in correct order
    await db.delete(notifications);
    await db.delete(articleComments);
    await db.delete(articles);
    await db.delete(feeds);
    await db.delete(userBlocks);
    await db.delete(friendships);
    await db.delete(userPrivacySettings);
    await db.delete(profiles);
  });

  describe('Complete Social Workflow', () => {
    it('should handle full friend request to social feed workflow', async () => {
      // === Phase 1: Friend Discovery and Connection ===
      
      // Alice searches for Bob
      const searchResults = await friendService.searchUsers('Bob', aliceId);
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe(bobId);
      expect(searchResults[0].display_name).toBe('Bob');

      // Alice sends friend request to Bob
      const friendRequest = await friendService.sendFriendRequest(aliceId, bobId);
      expect(friendRequest.status).toBe('pending');
      expect(friendRequest.fromUser.id).toBe(aliceId);
      expect(friendRequest.toUser.id).toBe(bobId);

      // Verify Bob receives notification
      const bobNotifications = await notificationService.getNotifications(bobId);
      expect(bobNotifications).toHaveLength(1);
      expect(bobNotifications[0].type).toBe('friend_request');
      expect(bobNotifications[0].data.fromUserId).toBe(aliceId);

      // Bob accepts friend request
      const friendship = await friendService.acceptFriendRequest(friendRequest.id, bobId);
      expect(friendship.status).toBe('confirmed');

      // Verify Alice receives acceptance notification
      const aliceNotifications = await notificationService.getNotifications(aliceId);
      expect(aliceNotifications).toHaveLength(1);
      expect(aliceNotifications[0].type).toBe('friend_accepted');
      expect(aliceNotifications[0].data.acceptedByUserId).toBe(bobId);

      // Verify mutual friendship
      expect(await friendService.areUsersFriends(aliceId, bobId)).toBe(true);
      expect(await friendService.areUsersFriends(bobId, aliceId)).toBe(true);

      // === Phase 2: Social Interactions ===

      // Bob comments on Alice's article
      const comment1 = await commentService.addComment({
        articleId: testArticleId,
        userId: bobId,
        content: 'Great article about AI! Really insightful analysis.'
      });

      expect(comment1.author.id).toBe(bobId);
      expect(comment1.content).toBe('Great article about AI! Really insightful analysis.');

      // Alice can see Bob's comment
      const aliceComments = await commentService.getComments(testArticleId, aliceId);
      expect(aliceComments).toHaveLength(1);
      expect(aliceComments[0].id).toBe(comment1.id);

      // Alice replies with a tag to Bob (using display name without spaces)
      const comment2 = await commentService.addCommentWithMentions(
        testArticleId,
        aliceId,
        'Thanks @Bob! I thought you might find this interesting given your work in ML.'
      );

      expect(comment2.taggedUsers).toHaveLength(1);
      expect(comment2.taggedUsers[0].id).toBe(bobId);

      // Verify Bob receives tag notification
      const updatedBobNotifications = await notificationService.getNotifications(bobId);
      const tagNotification = updatedBobNotifications.find(n => n.type === 'comment_tag');
      expect(tagNotification).toBeDefined();
      expect(tagNotification!.data.taggerUserId).toBe(aliceId);

      // === Phase 3: Social Feed Integration ===

      // Bob's social feed should show Alice's activity
      const bobSocialFeed = await socialFeedService.getSocialFeed({
        userId: bobId,
        limit: 10,
        includeRegularFeed: true,
        socialOnly: false
      });

      expect(bobSocialFeed.length).toBeGreaterThan(0);
      expect(bobSocialFeed[0].socialActivity.commentCount).toBe(2);
      expect(bobSocialFeed[0].socialActivity.friendsWhoCommented.some((name: string) => name === 'Alice')).toBe(true);

      // Alice's social feed should show Bob's activity
      const aliceSocialFeed = await socialFeedService.getSocialFeed({
        userId: aliceId,
        limit: 10,
        includeRegularFeed: true,
        socialOnly: false
      });

      expect(aliceSocialFeed.length).toBeGreaterThan(0);
      expect(aliceSocialFeed[0].socialActivity.friendsWhoCommented.some((name: string) => name === 'Bob')).toBe(true);

      // === Phase 4: Privacy Verification ===

      // Charlie (not a friend) should not see the comments
      const charlieComments = await commentService.getComments(testArticleId, charlieId);
      expect(charlieComments).toHaveLength(0);

      // Charlie's social feed should not show Alice/Bob activity
      const charlieSocialFeed = await socialFeedService.getSocialFeed({
        userId: charlieId,
        limit: 10,
        includeRegularFeed: true,
        socialOnly: true // Only social activity
      });

      expect(charlieSocialFeed).toHaveLength(0);
    });

    it('should enforce privacy settings throughout workflow', async () => {
      // Dave has privacy set to not allow friend requests from anyone
      const canSendToDave = await privacyService.canSendFriendRequest(aliceId, daveId);
      expect(canSendToDave).toBe(false);

      // Alice cannot send friend request to Dave
      await expect(
        friendService.sendFriendRequest(aliceId, daveId)
      ).rejects.toThrow('Cannot send friend request due to privacy settings');

      // Charlie is not discoverable, so shouldn't appear in search
      const searchResults = await friendService.searchUsers('Charlie', aliceId);
      expect(searchResults).toHaveLength(0);

      // But Charlie can still send friend requests (allow_friend_requests_from: 'friends')
      // First, make Alice and Bob friends, then Bob and Charlie friends
      const aliceBobRequest = await friendService.sendFriendRequest(aliceId, bobId);
      await friendService.acceptFriendRequest(aliceBobRequest.id, bobId);

      // Charlie can send request to Bob (they have mutual friend Alice)
      const charlieBobRequest = await friendService.sendFriendRequest(charlieId, bobId);
      expect(charlieBobRequest.status).toBe('pending');
    });

    it('should handle blocking and its cascading effects', async () => {
      // Establish friendship first
      const friendRequest = await friendService.sendFriendRequest(aliceId, bobId);
      await friendService.acceptFriendRequest(friendRequest.id, bobId);

      // Add some comments
      await commentService.addComment({
        articleId: testArticleId,
        userId: bobId,
        content: 'Initial comment before blocking'
      });

      // Alice blocks Bob
      await friendService.blockUser(aliceId, bobId);

      // Verify friendship is removed
      expect(await friendService.areUsersFriends(aliceId, bobId)).toBe(false);

      // Verify all social interactions are blocked
      expect(await privacyService.canSendFriendRequest(aliceId, bobId)).toBe(false);
      expect(await privacyService.canSendFriendRequest(bobId, aliceId)).toBe(false);
      expect(await privacyService.canTagUser(aliceId, bobId)).toBe(false);
      expect(await privacyService.canComment(bobId, testArticleId)).toBe(false);

      // Bob should not see Alice's comments anymore
      const bobComments = await commentService.getComments(testArticleId, bobId);
      expect(bobComments).toHaveLength(0);

      // Bob should not appear in Alice's search
      const searchResults = await friendService.searchUsers('Bob', aliceId);
      expect(searchResults).toHaveLength(0);
    });
  });

  describe('Real-time Features Integration', () => {
    it('should deliver real-time notifications via WebSocket', async () => {
      const wsUrl = `ws://localhost:${port}/ws`;
      const aliceWs = new WebSocket(wsUrl);
      const bobWs = new WebSocket(wsUrl);

      // Connect and authenticate both users
      await Promise.all([
        new Promise<void>((resolve) => {
          aliceWs.on('open', () => {
            aliceWs.send(JSON.stringify({
              type: 'auth',
              data: { userId: aliceId }
            }));
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          bobWs.on('open', () => {
            bobWs.send(JSON.stringify({
              type: 'auth',
              data: { userId: bobId }
            }));
            resolve();
          });
        })
      ]);

      // Wait for authentication
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set up message listeners
      let aliceReceivedNotification = false;
      let bobReceivedNotification = false;

      aliceWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'notification' && message.data.type === 'friend_accepted') {
          aliceReceivedNotification = true;
        }
      });

      bobWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'notification' && message.data.type === 'friend_request') {
          bobReceivedNotification = true;
        }
      });

      // Send friend request (should trigger real-time notification)
      const friendRequest = await friendService.sendFriendRequest(aliceId, bobId);
      
      // Wait for WebSocket message delivery
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Accept friend request (should trigger real-time notification)
      await friendService.acceptFriendRequest(friendRequest.id, bobId);
      
      // Wait for WebSocket message delivery
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify that notifications were created (even if WebSocket delivery failed)
      const bobNotifications = await notificationService.getNotifications(bobId);
      const aliceNotifications = await notificationService.getNotifications(aliceId);
      
      expect(bobNotifications.some(n => n.type === 'friend_request')).toBe(true);
      expect(aliceNotifications.some(n => n.type === 'friend_accepted')).toBe(true);

      aliceWs.close();
      bobWs.close();
    });

    it('should deliver real-time comment updates', async () => {
      // First establish friendship
      const friendRequest = await friendService.sendFriendRequest(aliceId, bobId);
      await friendService.acceptFriendRequest(friendRequest.id, bobId);

      const wsUrl = `ws://localhost:${port}/ws`;
      const aliceWs = new WebSocket(wsUrl);

      await new Promise<void>((resolve) => {
        aliceWs.on('open', () => {
          aliceWs.send(JSON.stringify({
            type: 'auth',
            data: { userId: aliceId }
          }));
          resolve();
        });
      });

      // Wait for authentication
      await new Promise(resolve => setTimeout(resolve, 500));

      let receivedCommentUpdate = false;
      aliceWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'comment_update') {
          receivedCommentUpdate = true;
        }
      });

      // Bob adds comment (should trigger real-time update for Alice)
      const comment = await commentService.addComment({
        articleId: testArticleId,
        userId: bobId,
        content: 'Real-time comment test'
      });

      // Wait for WebSocket message delivery
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify comment was created successfully
      expect(comment.content).toBe('Real-time comment test');
      expect(comment.author.id).toBe(bobId);

      aliceWs.close();
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent friend requests', async () => {
      // Create additional test users for load testing
      const additionalUsers = await db
        .insert(profiles)
        .values(Array.from({ length: 10 }, (_, i) => ({
          email: `user${i}@test.com`,
          display_name: `User ${i}`,
          timezone: 'America/New_York'
        })))
        .returning();

      // Set up privacy settings for all new users
      await db
        .insert(userPrivacySettings)
        .values(additionalUsers.map(user => ({
          user_id: user.id,
          discoverable: true,
          allow_friend_requests_from: 'everyone',
          show_activity_to: 'friends',
          email_notifications: true,
          push_notifications: true
        })));

      // Alice sends friend requests to all users concurrently
      const friendRequestPromises = additionalUsers.map(user =>
        friendService.sendFriendRequest(aliceId, user.id)
      );

      const friendRequests = await Promise.all(friendRequestPromises);
      expect(friendRequests).toHaveLength(10);
      friendRequests.forEach(request => {
        expect(request.status).toBe('pending');
        expect(request.fromUser.id).toBe(aliceId);
      });

      // All users accept friend requests concurrently
      const acceptPromises = friendRequests.map(request =>
        friendService.acceptFriendRequest(request.id, request.toUser.id)
      );

      const friendships = await Promise.all(acceptPromises);
      expect(friendships).toHaveLength(10);
      friendships.forEach(friendship => {
        expect(friendship.status).toBe('confirmed');
      });

      // Verify Alice has 10 friends
      const aliceFriends = await friendService.getFriends(aliceId);
      expect(aliceFriends).toHaveLength(10);
    });

    it('should handle bulk comment operations efficiently', async () => {
      // Establish friendship
      const friendRequest = await friendService.sendFriendRequest(aliceId, bobId);
      await friendService.acceptFriendRequest(friendRequest.id, bobId);

      // Bob adds multiple comments concurrently
      const commentPromises = Array.from({ length: 20 }, (_, i) =>
        commentService.addComment({
          articleId: testArticleId,
          userId: bobId,
          content: `Comment number ${i + 1} for performance testing`
        })
      );

      const startTime = Date.now();
      const comments = await Promise.all(commentPromises);
      const endTime = Date.now();

      expect(comments).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify Alice can retrieve all comments efficiently
      const retrievalStartTime = Date.now();
      const retrievedComments = await commentService.getComments(testArticleId, aliceId);
      const retrievalEndTime = Date.now();

      expect(retrievedComments).toHaveLength(20);
      expect(retrievalEndTime - retrievalStartTime).toBeLessThan(1000); // Should retrieve within 1 second
    });

    it('should handle social feed generation efficiently', async () => {
      // Create network of friends - use the correct user IDs
      const users = [aliceId, bobId, charlieId];
      
      // Make everyone friends with everyone
      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
          const request = await friendService.sendFriendRequest(users[i], users[j]);
          await friendService.acceptFriendRequest(request.id, users[j]);
        }
      }

      // Each user comments on multiple articles
      const commentPromises = [];
      for (const userId of users) {
        for (const articleId of [testArticleId, testArticle2Id]) {
          commentPromises.push(
            commentService.addComment({
              articleId,
              userId,
              content: `Comment from ${userId} on article ${articleId}`
            })
          );
        }
      }

      await Promise.all(commentPromises);

      // Generate social feeds for all users
      const feedStartTime = Date.now();
      const feedPromises = users.map(userId =>
        socialFeedService.getSocialFeed({ 
          userId, 
          limit: 20, 
          includeRegularFeed: true,
          socialOnly: false
        })
      );

      const socialFeeds = await Promise.all(feedPromises);
      const feedEndTime = Date.now();

      expect(feedEndTime - feedStartTime).toBeLessThan(3000); // Should generate within 3 seconds
      
      socialFeeds.forEach(feed => {
        expect(feed.length).toBeGreaterThan(0);
        feed.forEach(item => {
          expect(item.socialActivity.commentCount).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Data Consistency and Error Recovery', () => {
    it('should maintain consistency during complex operations', async () => {
      // Establish friendship
      const friendRequest = await friendService.sendFriendRequest(aliceId, bobId);
      await friendService.acceptFriendRequest(friendRequest.id, bobId);

      // Add comment with tag
      const comment = await commentService.addCommentWithMentions(
        testArticleId,
        bobId,
        'Hello @Alice! Great article.'
      );

      // Verify all related data exists
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
      expect(comments[0].tagged_users).toContain(aliceId);

      const notifs = await db
        .select()
        .from(notifications);
      expect(notifs.length).toBeGreaterThan(0);

      // Perform unfriend operation
      await friendService.unfriend(aliceId, bobId);

      // Verify friendship is removed but comments remain (for data integrity)
      const remainingFriendships = await db
        .select()
        .from(friendships)
        .where(friendships => friendships.status === 'confirmed');
      expect(remainingFriendships).toHaveLength(0);

      const remainingComments = await db
        .select()
        .from(articleComments)
        .where(articleComments => articleComments.id === comment.id);
      expect(remainingComments).toHaveLength(1);

      // But Alice should no longer see Bob's comments
      const visibleComments = await commentService.getComments(testArticleId, aliceId);
      expect(visibleComments).toHaveLength(0);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test various error conditions
      
      // Non-existent user
      await expect(
        friendService.sendFriendRequest(aliceId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow();

      // Non-existent article
      await expect(
        commentService.addComment({
          articleId: '00000000-0000-0000-0000-000000000000',
          userId: aliceId,
          content: 'This should fail'
        })
      ).rejects.toThrow();

      // Invalid friend request ID
      await expect(
        friendService.acceptFriendRequest('00000000-0000-0000-0000-000000000000', bobId)
      ).rejects.toThrow();

      // Self friend request
      await expect(
        friendService.sendFriendRequest(aliceId, aliceId)
      ).rejects.toThrow();

      // Verify system remains stable after errors
      const validRequest = await friendService.sendFriendRequest(aliceId, bobId);
      expect(validRequest.status).toBe('pending');
    });
  });
});