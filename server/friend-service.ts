import { 
  type Friendship, 
  type InsertFriendship, 
  type Profile,
  type InsertUserBlock,
  type FriendshipStatus,
  friendships,
  userBlocks,
  profiles
} from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDatabase } from "./production-db";
import { privacyService } from "./privacy-service";
import { notificationService } from "./notification-service";
import { socialCacheService } from "./social-cache-service";
import { socialQueryOptimizer, type PaginationOptions } from "./social-query-optimizer";

/**
 * Friend request data structure for API responses
 */
export interface FriendRequest {
  id: string;
  fromUser: Profile;
  toUser: Profile;
  status: FriendshipStatus;
  requestedAt: Date;
  confirmedAt?: Date;
}

/**
 * Friend data structure for API responses
 */
export interface Friend {
  id: string;
  profile: Profile;
  friendshipId: string;
  confirmedAt: Date;
}

/**
 * Core Friend Management Service
 * Implements Requirements: 1.2, 1.4, 1.5, 2.1, 1.6, 2.3, 2.5
 * 
 * This service handles:
 * - Friend request sending and receiving logic
 * - Accept/decline friend request workflows
 * - Friendship status validation and mutual confirmation logic
 * - Duplicate request prevention logic
 * - User blocking functionality with bidirectional enforcement
 * - Unfriend operation with permission cleanup
 */
export class FriendService {
  private db = getDatabase();

  /**
   * Send a friend request from one user to another
   * Requirements: 1.2 - Friend request creation and notification
   * 
   * @param fromUserId - ID of user sending the request
   * @param toUserId - ID of user receiving the request
   * @returns Promise<FriendRequest> - The created friend request
   * @throws Error if users are blocked, request already exists, or users are the same
   */
  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<FriendRequest> {
    // Check privacy permissions first
    const canSendRequest = await privacyService.canSendFriendRequest(fromUserId, toUserId);
    if (!canSendRequest) {
      throw new Error("Cannot send friend request due to privacy settings");
    }

    // Check for existing friendship or pending request
    const existingFriendship = await this.getFriendshipBetweenUsers(fromUserId, toUserId);
    if (existingFriendship) {
      if (existingFriendship.status === 'confirmed') {
        throw new Error("Users are already friends");
      }
      if (existingFriendship.status === 'pending') {
        throw new Error("Friend request already exists");
      }
    }

    // Ensure proper ordering (user1_id < user2_id)
    const [user1Id, user2Id] = fromUserId < toUserId ? [fromUserId, toUserId] : [toUserId, fromUserId];

    // Create the friendship record
    const insertData: InsertFriendship = {
      user1_id: user1Id,
      user2_id: user2Id,
      status: 'pending',
      requested_by: fromUserId,
      requested_at: new Date()
    };

    const [friendship] = await this.db
      .insert(friendships)
      .values(insertData)
      .returning();

    // Get user profiles for response
    const [fromUser, toUser] = await Promise.all([
      this.getUserProfile(fromUserId),
      this.getUserProfile(toUserId)
    ]);

    // Create notification for friend request
    // Requirements: 4.2 - Connect friend request events to notifications
    await notificationService.createFriendRequestNotification(fromUserId, toUserId, friendship.id);

    return {
      id: friendship.id,
      fromUser,
      toUser,
      status: friendship.status,
      requestedAt: friendship.requested_at,
      confirmedAt: friendship.confirmed_at || undefined
    };
  }

  /**
   * Accept a friend request
   * Requirements: 1.4, 2.1 - Accept friend request and establish mutual confirmation
   * 
   * @param requestId - ID of the friendship record
   * @param userId - ID of user accepting the request
   * @returns Promise<FriendRequest> - The updated friendship
   * @throws Error if request not found or user not authorized
   */
  async acceptFriendRequest(requestId: string, userId: string): Promise<FriendRequest> {
    // Get the friendship record
    const friendship = await this.getFriendshipById(requestId);
    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Verify the user is authorized to accept (must be the recipient)
    if (friendship.requested_by === userId) {
      throw new Error("Cannot accept your own friend request");
    }

    if (friendship.user1_id !== userId && friendship.user2_id !== userId) {
      throw new Error("Not authorized to accept this friend request");
    }

    // Verify request is still pending
    if (friendship.status !== 'pending') {
      throw new Error("Friend request is no longer pending");
    }

    // Update to confirmed status
    const [updatedFriendship] = await this.db
      .update(friendships)
      .set({
        status: 'confirmed',
        confirmed_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(friendships.id, requestId))
      .returning();

    // Get user profiles for response
    const [fromUser, toUser] = await Promise.all([
      this.getUserProfile(friendship.requested_by),
      this.getUserProfile(friendship.requested_by === friendship.user1_id ? friendship.user2_id : friendship.user1_id)
    ]);

    // Create notification for friend request acceptance
    // Requirements: 4.2 - Connect friend request events to notifications
    await notificationService.createFriendAcceptedNotification(userId, friendship.requested_by, updatedFriendship.id);

    // Send real-time friend status update to both users
    // Requirements: 2.2 - Live friend status updates
    try {
      const { webSocketService } = await import('./websocket-service');
      
      // Notify the original requester that their request was accepted
      await webSocketService.sendFriendStatusUpdate(
        userId, // User who accepted
        [friendship.requested_by], // Original requester
        {
          friendId: userId,
          friendName: toUser.display_name,
          friendAvatar: toUser.avatar_url || undefined,
          status: 'friend_request_accepted',
          timestamp: Date.now()
        }
      );

      // Notify the accepter about the new friendship
      await webSocketService.sendFriendStatusUpdate(
        friendship.requested_by, // Original requester
        [userId], // User who accepted
        {
          friendId: friendship.requested_by,
          friendName: fromUser.display_name,
          friendAvatar: fromUser.avatar_url || undefined,
          status: 'friend_request_accepted',
          timestamp: Date.now()
        }
      );
    } catch (error) {
      // Log error but don't fail the friend request acceptance
      console.error(`Failed to send real-time friend status update:`, error);
    }

    // Invalidate cache for both users
    await this.invalidateFriendshipCache(friendship.user1_id, friendship.user2_id);

    return {
      id: updatedFriendship.id,
      fromUser,
      toUser,
      status: updatedFriendship.status,
      requestedAt: updatedFriendship.requested_at,
      confirmedAt: updatedFriendship.confirmed_at || undefined
    };
  }

  /**
   * Decline a friend request
   * Requirements: 1.5 - Decline friend request and remove from system
   * 
   * @param requestId - ID of the friendship record
   * @param userId - ID of user declining the request
   * @returns Promise<void>
   * @throws Error if request not found or user not authorized
   */
  async declineFriendRequest(requestId: string, userId: string): Promise<void> {
    // Get the friendship record
    const friendship = await this.getFriendshipById(requestId);
    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Verify the user is authorized to decline (must be the recipient)
    if (friendship.requested_by === userId) {
      throw new Error("Cannot decline your own friend request");
    }

    if (friendship.user1_id !== userId && friendship.user2_id !== userId) {
      throw new Error("Not authorized to decline this friend request");
    }

    // Verify request is still pending
    if (friendship.status !== 'pending') {
      throw new Error("Friend request is no longer pending");
    }

    // Delete the friendship record (decline removes it entirely)
    await this.db
      .delete(friendships)
      .where(eq(friendships.id, requestId));
  }

  /**
   * Get all friends for a user
   * Requirements: 2.4 - Provide friends list showing all confirmed friendships
   * 
   * @param userId - ID of the user
   * @returns Promise<Friend[]> - List of confirmed friends
   */
  async getFriends(userId: string): Promise<Friend[]> {
    const user1Profile = alias(profiles, 'user1Profile');
    const user2Profile = alias(profiles, 'user2Profile');

    const userFriendships = await this.db
      .select({
        friendship: friendships,
        user1Profile: user1Profile,
        user2Profile: user2Profile
      })
      .from(friendships)
      .leftJoin(user1Profile, eq(user1Profile.id, friendships.user1_id))
      .leftJoin(user2Profile, eq(user2Profile.id, friendships.user2_id))
      .where(
        and(
          or(
            eq(friendships.user1_id, userId),
            eq(friendships.user2_id, userId)
          ),
          eq(friendships.status, 'confirmed')
        )
      );

    return userFriendships.map(row => {
      // Determine which profile is the friend (not the current user)
      const friendProfile = row.friendship.user1_id === userId 
        ? row.user2Profile! 
        : row.user1Profile!;

      return {
        id: friendProfile.id,
        profile: friendProfile,
        friendshipId: row.friendship.id,
        confirmedAt: row.friendship.confirmed_at!
      };
    });
  }

  /**
   * Get pending friend requests for a user (both sent and received)
   * Requirements: 1.3 - Display friend requests with options to accept or decline
   * 
   * @param userId - ID of the user
   * @returns Promise<{ sent: FriendRequest[], received: FriendRequest[] }>
   */
  async getFriendRequests(userId: string): Promise<{ sent: FriendRequest[], received: FriendRequest[] }> {
    const user1Profile = alias(profiles, 'user1Profile');
    const user2Profile = alias(profiles, 'user2Profile');

    const pendingRequests = await this.db
      .select({
        friendship: friendships,
        user1Profile: user1Profile,
        user2Profile: user2Profile
      })
      .from(friendships)
      .leftJoin(user1Profile, eq(user1Profile.id, friendships.user1_id))
      .leftJoin(user2Profile, eq(user2Profile.id, friendships.user2_id))
      .where(
        and(
          or(
            eq(friendships.user1_id, userId),
            eq(friendships.user2_id, userId)
          ),
          eq(friendships.status, 'pending')
        )
      );

    const sent: FriendRequest[] = [];
    const received: FriendRequest[] = [];

    for (const row of pendingRequests) {
      const fromUser = row.friendship.requested_by === row.friendship.user1_id 
        ? row.user1Profile! 
        : row.user2Profile!;
      const toUser = row.friendship.requested_by === row.friendship.user1_id 
        ? row.user2Profile! 
        : row.user1Profile!;

      const request: FriendRequest = {
        id: row.friendship.id,
        fromUser,
        toUser,
        status: row.friendship.status,
        requestedAt: row.friendship.requested_at,
        confirmedAt: row.friendship.confirmed_at || undefined
      };

      if (row.friendship.requested_by === userId) {
        sent.push(request);
      } else {
        received.push(request);
      }
    }

    return { sent, received };
  }

  /**
   * Unfriend a user (remove confirmed friendship)
   * Requirements: 2.3 - Unfriend operation with permission cleanup
   * 
   * @param userId - ID of the user initiating unfriend
   * @param friendId - ID of the friend to remove
   * @returns Promise<void>
   * @throws Error if friendship not found
   */
  async unfriend(userId: string, friendId: string): Promise<void> {
    // Find the friendship
    const friendship = await this.getFriendshipBetweenUsers(userId, friendId);
    if (!friendship || friendship.status !== 'confirmed') {
      throw new Error("Friendship not found");
    }

    // Get user profiles for real-time updates
    const [user, friend] = await Promise.all([
      this.getUserProfile(userId),
      this.getUserProfile(friendId)
    ]);

    // Delete the friendship record
    await this.db
      .delete(friendships)
      .where(eq(friendships.id, friendship.id));

    // Send real-time friend status update to both users
    // Requirements: 2.2 - Live friend status updates
    try {
      const { webSocketService } = await import('./websocket-service');
      
      // Notify the friend that they were unfriended
      await webSocketService.sendFriendStatusUpdate(
        userId, // User who initiated unfriend
        [friendId], // Friend being unfriended
        {
          friendId: userId,
          friendName: user.display_name,
          friendAvatar: user.avatar_url || undefined,
          status: 'unfriended',
          timestamp: Date.now()
        }
      );

      // Notify the user who initiated unfriend (for UI updates)
      await webSocketService.sendFriendStatusUpdate(
        friendId, // Friend who was unfriended
        [userId], // User who initiated unfriend
        {
          friendId: friendId,
          friendName: friend.display_name,
          friendAvatar: friend.avatar_url || undefined,
          status: 'unfriended',
          timestamp: Date.now()
        }
      );
    } catch (error) {
      // Log error but don't fail the unfriend operation
      console.error(`Failed to send real-time unfriend status update:`, error);
    }

    // Invalidate cache for both users
    await this.invalidateFriendshipCache(userId, friendId);
  }

  /**
   * Block a user (prevents all social interactions)
   * Requirements: 2.5 - User blocking functionality with bidirectional enforcement
   * 
   * @param blockerId - ID of user doing the blocking
   * @param blockedId - ID of user being blocked
   * @returns Promise<void>
   * @throws Error if trying to block self or already blocked
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new Error("Cannot block yourself");
    }

    // Check if already blocked
    const existingBlock = await this.db
      .select()
      .from(userBlocks)
      .where(
        and(
          eq(userBlocks.blocker_id, blockerId),
          eq(userBlocks.blocked_id, blockedId)
        )
      )
      .limit(1);

    if (existingBlock.length > 0) {
      throw new Error("User is already blocked");
    }

    // Create block record
    const insertData: InsertUserBlock = {
      blocker_id: blockerId,
      blocked_id: blockedId,
      created_at: new Date()
    };

    await this.db
      .insert(userBlocks)
      .values(insertData);

    // Remove any existing friendship
    await this.db
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.user1_id, blockerId < blockedId ? blockerId : blockedId),
            eq(friendships.user2_id, blockerId < blockedId ? blockedId : blockerId)
          )
        )
      );

    // Invalidate cache for both users
    await this.invalidateFriendshipCache(blockerId, blockedId);
  }

  /**
   * Unblock a user
   * Requirements: 2.5 - Allow users to manage blocked users
   * 
   * @param blockerId - ID of user doing the unblocking
   * @param blockedId - ID of user being unblocked
   * @returns Promise<void>
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.db
      .delete(userBlocks)
      .where(
        and(
          eq(userBlocks.blocker_id, blockerId),
          eq(userBlocks.blocked_id, blockedId)
        )
      );

    // Invalidate cache for both users
    await this.invalidateFriendshipCache(blockerId, blockedId);
  }

  /**
   * Get list of blocked users for a user
   * Requirements: 2.5 - Allow users to manage blocked users
   * 
   * @param userId - ID of the user
   * @returns Promise<Profile[]> - List of blocked user profiles
   */
  async getBlockedUsers(userId: string): Promise<Profile[]> {
    const blockedUsers = await this.db
      .select({
        profile: profiles
      })
      .from(userBlocks)
      .innerJoin(profiles, eq(profiles.id, userBlocks.blocked_id))
      .where(eq(userBlocks.blocker_id, userId));

    return blockedUsers.map(row => row.profile);
  }

  /**
   * Check if two users are blocked in either direction
   * Requirements: 2.5 - Bidirectional block enforcement
   * 
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Promise<boolean> - True if blocked in either direction
   */
  async areUsersBlocked(userId1: string, userId2: string): Promise<boolean> {
    const blocks = await this.db
      .select()
      .from(userBlocks)
      .where(
        or(
          and(
            eq(userBlocks.blocker_id, userId1),
            eq(userBlocks.blocked_id, userId2)
          ),
          and(
            eq(userBlocks.blocker_id, userId2),
            eq(userBlocks.blocked_id, userId1)
          )
        )
      )
      .limit(1);

    return blocks.length > 0;
  }

  /**
   * Check if two users are friends
   * Requirements: 2.2 - Allow both users to see each other's comments and tag each other
   * 
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Promise<boolean> - True if users are confirmed friends
   */
  async areUsersFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.getFriendshipBetweenUsers(userId1, userId2);
    return friendship?.status === 'confirmed';
  }

  /**
   * Search for users with privacy controls
   * Requirements: 8.1, 8.3 - User search with privacy compliance
   * 
   * @param query - Search query (username, display name, or email)
   * @param searcherId - ID of user performing the search
   * @param limit - Maximum number of results (default: 20)
   * @returns Promise<Profile[]> - List of user profiles that match search and privacy criteria
   */
  async searchUsers(query: string, searcherId: string, limit: number = 20): Promise<Profile[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim().toLowerCase();
    
    // Get all users matching the search query with partial matching
    // Note: In the schema, there's no separate username field, so we search display_name and email
    const matchingUsers = await this.db
      .select()
      .from(profiles)
      .where(
        or(
          // Partial match on display name (case-insensitive)
          sql`LOWER(${profiles.display_name}) LIKE ${`%${searchQuery}%`}`,
          // Exact match on email (case-insensitive)
          sql`LOWER(${profiles.email}) = ${searchQuery}`,
          // Partial match on email prefix (before @)
          sql`LOWER(${profiles.email}) LIKE ${`${searchQuery}%`}`
        )
      )
      .limit(limit * 3); // Get more results to filter by privacy and rank

    // Filter results based on privacy settings and rank by relevance
    const filteredUsers: Array<{ user: Profile; score: number }> = [];
    
    for (const user of matchingUsers) {
      // Skip the searcher themselves
      if (user.id === searcherId) continue;
      
      const canInclude = await privacyService.canIncludeInSearch(searcherId, user.id);
      if (canInclude) {
        // Calculate relevance score
        let score = 0;
        const displayNameLower = user.display_name.toLowerCase();
        const emailLower = user.email.toLowerCase();
        
        // Exact matches get highest score
        if (displayNameLower === searchQuery) score += 100;
        if (emailLower === searchQuery) score += 100;
        
        // Prefix matches get medium score
        if (displayNameLower.startsWith(searchQuery)) score += 50;
        if (emailLower.startsWith(searchQuery)) score += 50;
        
        // Contains matches get lower score
        if (displayNameLower.includes(searchQuery)) score += 25;
        if (emailLower.includes(searchQuery)) score += 25;
        
        // Boost score for users with profile pictures
        if (user.avatar_url) score += 5;
        
        filteredUsers.push({ user, score });
      }
    }

    // Sort by relevance score (highest first) and return top results
    return filteredUsers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.user);
  }

  /**
   * Get friend suggestions based on mutual connections
   * Requirements: 8.2 - Friend suggestion algorithms based on mutual connections
   * 
   * @param userId - ID of user requesting suggestions
   * @param limit - Maximum number of suggestions (default: 10)
   * @returns Promise<Profile[]> - List of suggested user profiles
   */
  async getFriendSuggestions(userId: string, limit: number = 10): Promise<Profile[]> {
    // Get user's current friends
    const userFriends = await this.getFriends(userId);
    const friendIds = userFriends.map(f => f.id);
    
    if (friendIds.length === 0) {
      // If user has no friends, return empty suggestions
      // In a real implementation, we might suggest popular users or users with similar interests
      return [];
    }

    // Find users who are friends with the user's friends (mutual connections)
    const user1Profile = alias(profiles, 'user1Profile');
    const user2Profile = alias(profiles, 'user2Profile');
    const suggestedProfile = alias(profiles, 'suggestedProfile');

    // Get friends of friends who are not already friends with the user
    const mutualConnections = await this.db
      .select({
        profile: suggestedProfile,
        mutualFriendCount: sql<number>`COUNT(DISTINCT ${friendships.id})`.as('mutual_friend_count')
      })
      .from(friendships)
      .innerJoin(user1Profile, eq(user1Profile.id, friendships.user1_id))
      .innerJoin(user2Profile, eq(user2Profile.id, friendships.user2_id))
      .innerJoin(suggestedProfile, 
        or(
          and(
            eq(suggestedProfile.id, friendships.user1_id),
            sql`${friendships.user2_id} IN (${friendIds.map(() => '?').join(',')})`
          ),
          and(
            eq(suggestedProfile.id, friendships.user2_id),
            sql`${friendships.user1_id} IN (${friendIds.map(() => '?').join(',')})`
          )
        )
      )
      .where(
        and(
          eq(friendships.status, 'confirmed'),
          // Exclude the user themselves
          sql`${suggestedProfile.id} != ${userId}`,
          // Exclude users who are already friends
          sql`${suggestedProfile.id} NOT IN (${friendIds.map(() => '?').join(',')})`
        )
      )
      .groupBy(suggestedProfile.id, suggestedProfile.email, suggestedProfile.display_name, 
               suggestedProfile.avatar_url, suggestedProfile.timezone, suggestedProfile.region_code,
               suggestedProfile.onboarding_completed, suggestedProfile.is_admin, 
               suggestedProfile.created_at, suggestedProfile.updated_at)
      .orderBy(sql`COUNT(DISTINCT ${friendships.id}) DESC`)
      .limit(limit * 2); // Get more to filter by privacy

    // Filter by privacy settings
    const filteredSuggestions: Profile[] = [];
    for (const connection of mutualConnections) {
      if (filteredSuggestions.length >= limit) break;
      
      const canInclude = await privacyService.canIncludeInSearch(userId, connection.profile.id);
      if (canInclude) {
        // Check if users are blocked
        const isBlocked = await this.areUsersBlocked(userId, connection.profile.id);
        if (!isBlocked) {
          filteredSuggestions.push(connection.profile);
        }
      }
    }

    return filteredSuggestions;
  }

  /**
   * Find users by email addresses (for contact import)
   * Requirements: 8.4 - Implement contact import functionality
   * 
   * @param emails - Array of email addresses to search for
   * @param searcherId - ID of user performing the search
   * @returns Promise<Profile[]> - List of user profiles found by email
   */
  async findUsersByEmails(emails: string[], searcherId: string): Promise<Profile[]> {
    if (!emails || emails.length === 0) {
      return [];
    }

    // Normalize and validate email addresses
    const validEmails = emails
      .map(email => email.trim().toLowerCase())
      .filter(email => {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      })
      .slice(0, 100); // Limit to prevent abuse

    if (validEmails.length === 0) {
      return [];
    }

    // Find users with matching emails
    const matchingUsers = await this.db
      .select()
      .from(profiles)
      .where(
        sql`LOWER(${profiles.email}) IN (${validEmails.map(() => '?').join(',')})`
      );

    // Filter results based on privacy settings
    const filteredUsers: Profile[] = [];
    for (const user of matchingUsers) {
      // Skip the searcher themselves
      if (user.id === searcherId) continue;
      
      const canInclude = await privacyService.canIncludeInSearch(searcherId, user.id);
      if (canInclude) {
        // Check if users are blocked
        const isBlocked = await this.areUsersBlocked(searcherId, user.id);
        if (!isBlocked) {
          filteredUsers.push(user);
        }
      }
    }

    return filteredUsers;
  }

  /**
   * Generate a shareable profile link for a user
   * Requirements: 8.5 - Create profile link sharing for easy connections
   * 
   * @param userId - ID of user whose profile link to generate
   * @returns Promise<string> - Shareable profile link
   */
  async generateProfileLink(userId: string): Promise<string> {
    // Get user profile to ensure they exist
    const user = await this.getUserProfile(userId);
    
    // In a real implementation, you might want to:
    // 1. Generate a unique shareable token that expires
    // 2. Store the token in a database table
    // 3. Create a more user-friendly URL structure
    
    // For now, we'll use a simple approach with the user ID
    // In production, consider using a more secure approach
    const baseUrl = process.env.APP_BASE_URL || 'https://cronkite.app';
    return `${baseUrl}/connect/${userId}`;
  }

  /**
   * Get user profile from a shareable profile link
   * Requirements: 8.5 - Allow users to share their profile link for easy friend connections
   * 
   * @param linkUserId - User ID from the profile link
   * @param viewerId - ID of user viewing the profile
   * @returns Promise<Profile | null> - User profile if accessible, null otherwise
   */
  async getProfileFromLink(linkUserId: string, viewerId: string): Promise<Profile | null> {
    try {
      // Get the user profile
      const user = await this.getUserProfile(linkUserId);
      
      // Check if the viewer can view this profile
      const canView = await privacyService.canViewProfile(viewerId, linkUserId);
      if (!canView) {
        return null;
      }

      return user;
    } catch (error) {
      // User not found or other error
      return null;
    }
  }

  // Private helper methods

  /**
   * Get friendship record between two users
   * @private
   */
  private async getFriendshipBetweenUsers(userId1: string, userId2: string): Promise<Friendship | null> {
    const [user1Id, user2Id] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    const result = await this.db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.user1_id, user1Id),
          eq(friendships.user2_id, user2Id)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get friendship record by ID
   * @private
   */
  private async getFriendshipById(friendshipId: string): Promise<Friendship | null> {
    const result = await this.db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
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
   * Get paginated friends list with caching
   * Requirements: Performance and scalability - Implement pagination for large friend lists
   * 
   * @param userId - ID of user whose friends to retrieve
   * @param pagination - Pagination options
   * @returns Promise<PaginatedFriends> - Paginated friends list
   */
  async getPaginatedFriends(userId: string, pagination: PaginationOptions) {
    return await socialQueryOptimizer.getPaginatedFriends(userId, pagination);
  }

  /**
   * Check if two users are friends (with caching)
   * Requirements: Performance optimization - Cache friendship status
   * 
   * @param user1Id - First user ID
   * @param user2Id - Second user ID
   * @returns Promise<boolean> - True if users are friends
   */
  async areUsersFriends(user1Id: string, user2Id: string): Promise<boolean> {
    // Check cache first
    const cached = await socialCacheService.getCachedFriendshipStatus(user1Id, user2Id);
    if (cached !== null) {
      return cached;
    }

    // Query database
    const friendship = await this.db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'confirmed'),
          or(
            and(eq(friendships.user1_id, user1Id), eq(friendships.user2_id, user2Id)),
            and(eq(friendships.user1_id, user2Id), eq(friendships.user2_id, user1Id))
          )
        )
      )
      .limit(1);

    const areFriends = friendship.length > 0;
    
    // Cache the result
    await socialCacheService.cacheFriendshipStatus(user1Id, user2Id, areFriends, 600); // 10 minutes
    
    return areFriends;
  }

  /**
   * Bulk check friendship status for multiple users
   * Requirements: Performance optimization - Efficient bulk operations
   * 
   * @param userId - Base user ID
   * @param otherUserIds - Array of other user IDs to check
   * @returns Promise<Map<string, boolean>> - Map of user ID to friendship status
   */
  async bulkCheckFriendshipStatus(userId: string, otherUserIds: string[]): Promise<Map<string, boolean>> {
    return await socialQueryOptimizer.bulkCheckFriendshipStatus(userId, otherUserIds);
  }

  /**
   * Invalidate cache when friendship changes
   * @private
   */
  private async invalidateFriendshipCache(user1Id: string, user2Id: string): Promise<void> {
    await Promise.all([
      socialCacheService.invalidateUserCache(user1Id),
      socialCacheService.invalidateUserCache(user2Id)
    ]);
  }
}

// Export singleton instance
export const friendService = new FriendService();