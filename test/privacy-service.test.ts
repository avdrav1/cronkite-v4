import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { privacyService } from '../server/privacy-service';
import { friendService } from '../server/friend-service';
import { getDatabase } from '../server/production-db';
import { profiles, userPrivacySettings, friendships, userBlocks } from '@shared/schema';

describe('PrivacyService', () => {
  const db = getDatabase();
  let testUser1Id: string;
  let testUser2Id: string;

  beforeEach(async () => {
    // Create test users
    const [user1, user2] = await db
      .insert(profiles)
      .values([
        {
          email: 'user1@test.com',
          display_name: 'Test User 1',
          timezone: 'America/New_York'
        },
        {
          email: 'user2@test.com',
          display_name: 'Test User 2',
          timezone: 'America/New_York'
        }
      ])
      .returning();

    testUser1Id = user1.id;
    testUser2Id = user2.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(userBlocks);
    await db.delete(friendships);
    await db.delete(userPrivacySettings);
    await db.delete(profiles);
  });

  describe('canSendFriendRequest', () => {
    it('should allow friend requests by default', async () => {
      const canSend = await privacyService.canSendFriendRequest(testUser1Id, testUser2Id);
      expect(canSend).toBe(true);
    });

    it('should prevent friend requests to self', async () => {
      const canSend = await privacyService.canSendFriendRequest(testUser1Id, testUser1Id);
      expect(canSend).toBe(false);
    });

    it('should prevent friend requests when blocked', async () => {
      // Block user2 by user1
      await friendService.blockUser(testUser1Id, testUser2Id);
      
      const canSend = await privacyService.canSendFriendRequest(testUser1Id, testUser2Id);
      expect(canSend).toBe(false);
    });

    it('should respect privacy settings for friend requests', async () => {
      // Set user2 to not allow friend requests from anyone
      await privacyService.updatePrivacySettings(testUser2Id, {
        allow_friend_requests_from: 'nobody'
      });

      const canSend = await privacyService.canSendFriendRequest(testUser1Id, testUser2Id);
      expect(canSend).toBe(false);
    });
  });

  describe('canViewProfile', () => {
    it('should allow viewing own profile', async () => {
      const canView = await privacyService.canViewProfile(testUser1Id, testUser1Id);
      expect(canView).toBe(true);
    });

    it('should allow viewing discoverable profiles by default', async () => {
      const canView = await privacyService.canViewProfile(testUser1Id, testUser2Id);
      expect(canView).toBe(true);
    });

    it('should prevent viewing non-discoverable profiles from non-friends', async () => {
      // Set user2 as non-discoverable
      await privacyService.updatePrivacySettings(testUser2Id, {
        discoverable: false
      });

      const canView = await privacyService.canViewProfile(testUser1Id, testUser2Id);
      expect(canView).toBe(false);
    });
  });

  describe('getUserPrivacySettings', () => {
    it('should create default privacy settings if none exist', async () => {
      const settings = await privacyService.getUserPrivacySettings(testUser1Id);
      
      expect(settings.user_id).toBe(testUser1Id);
      expect(settings.discoverable).toBe(true);
      expect(settings.allow_friend_requests_from).toBe('everyone');
      expect(settings.show_activity_to).toBe('friends');
      expect(settings.email_notifications).toBe(true);
      expect(settings.push_notifications).toBe(true);
    });

    it('should return existing privacy settings', async () => {
      // Create custom settings
      await privacyService.updatePrivacySettings(testUser1Id, {
        discoverable: false,
        allow_friend_requests_from: 'friends'
      });

      const settings = await privacyService.getUserPrivacySettings(testUser1Id);
      expect(settings.discoverable).toBe(false);
      expect(settings.allow_friend_requests_from).toBe('friends');
    });
  });

  describe('canIncludeInSearch', () => {
    it('should include discoverable users in search', async () => {
      const canInclude = await privacyService.canIncludeInSearch(testUser1Id, testUser2Id);
      expect(canInclude).toBe(true);
    });

    it('should exclude non-discoverable users from search', async () => {
      await privacyService.updatePrivacySettings(testUser2Id, {
        discoverable: false
      });

      const canInclude = await privacyService.canIncludeInSearch(testUser1Id, testUser2Id);
      expect(canInclude).toBe(false);
    });

    it('should always include self in search', async () => {
      const canInclude = await privacyService.canIncludeInSearch(testUser1Id, testUser1Id);
      expect(canInclude).toBe(true);
    });
  });
});