/**
 * Feed Ownership Validation Helper
 * Requirements: 4.4 - Verify user owns feed before operations
 * 
 * This module provides helper functions to validate that a user owns a feed
 * before allowing operations like sync, delete, or update.
 */

import { getStorage } from "./storage";
import type { Feed } from "@shared/schema";

/**
 * Result of feed ownership validation
 */
export interface FeedOwnershipResult {
  /** Whether the user owns the feed */
  isOwner: boolean;
  /** The feed if found and owned by user, undefined otherwise */
  feed?: Feed;
  /** Error code if validation failed */
  errorCode?: 'FEED_NOT_FOUND' | 'FEED_NOT_AUTHORIZED';
  /** Human-readable error message */
  errorMessage?: string;
}

/**
 * Validates that a user owns a specific feed
 * 
 * @param userId - The ID of the user to check ownership for
 * @param feedId - The ID of the feed to validate ownership of
 * @returns FeedOwnershipResult indicating ownership status and feed details
 * 
 * Requirements: 4.4 - IF a user attempts to unsubscribe from a feed they don't own,
 * THEN THE Feed_Manager SHALL reject the request with an authorization error
 */
export async function validateFeedOwnership(
  userId: string,
  feedId: string
): Promise<FeedOwnershipResult> {
  try {
    const storage = await getStorage();
    
    // Get all feeds for the user
    const userFeeds = await storage.getUserFeeds(userId);
    
    // Find the specific feed
    const feed = userFeeds.find(f => f.id === feedId);
    
    if (!feed) {
      // Feed not found in user's feeds - could be non-existent or owned by another user
      return {
        isOwner: false,
        errorCode: 'FEED_NOT_AUTHORIZED',
        errorMessage: 'You do not have permission to access this feed'
      };
    }
    
    // User owns the feed
    return {
      isOwner: true,
      feed
    };
  } catch (error) {
    console.error('Feed ownership validation error:', error);
    return {
      isOwner: false,
      errorCode: 'FEED_NOT_FOUND',
      errorMessage: 'An error occurred while validating feed ownership'
    };
  }
}

/**
 * Validates that a user owns multiple feeds
 * 
 * @param userId - The ID of the user to check ownership for
 * @param feedIds - Array of feed IDs to validate ownership of
 * @returns Object containing owned and unauthorized feed IDs
 */
export async function validateMultipleFeedOwnership(
  userId: string,
  feedIds: string[]
): Promise<{
  ownedFeeds: Feed[];
  ownedFeedIds: string[];
  unauthorizedFeedIds: string[];
}> {
  try {
    const storage = await getStorage();
    
    // Get all feeds for the user
    const userFeeds = await storage.getUserFeeds(userId);
    const userFeedIds = new Set(userFeeds.map(f => f.id));
    
    const ownedFeeds: Feed[] = [];
    const ownedFeedIds: string[] = [];
    const unauthorizedFeedIds: string[] = [];
    
    for (const feedId of feedIds) {
      if (userFeedIds.has(feedId)) {
        const feed = userFeeds.find(f => f.id === feedId);
        if (feed) {
          ownedFeeds.push(feed);
          ownedFeedIds.push(feedId);
        }
      } else {
        unauthorizedFeedIds.push(feedId);
      }
    }
    
    return {
      ownedFeeds,
      ownedFeedIds,
      unauthorizedFeedIds
    };
  } catch (error) {
    console.error('Multiple feed ownership validation error:', error);
    return {
      ownedFeeds: [],
      ownedFeedIds: [],
      unauthorizedFeedIds: feedIds
    };
  }
}

/**
 * Express middleware-style helper for feed ownership validation
 * Returns an object that can be used to send appropriate error responses
 * 
 * @param userId - The ID of the user to check ownership for
 * @param feedId - The ID of the feed to validate ownership of
 * @returns Object with validation result and helper methods
 */
export async function requireFeedOwnership(
  userId: string,
  feedId: string
): Promise<{
  isValid: boolean;
  feed?: Feed;
  httpStatus: number;
  errorResponse?: {
    success: boolean;
    error: string;
    message: string;
  };
}> {
  const result = await validateFeedOwnership(userId, feedId);
  
  if (result.isOwner && result.feed) {
    return {
      isValid: true,
      feed: result.feed,
      httpStatus: 200
    };
  }
  
  return {
    isValid: false,
    httpStatus: result.errorCode === 'FEED_NOT_FOUND' ? 404 : 403,
    errorResponse: {
      success: false,
      error: result.errorCode || 'FEED_NOT_AUTHORIZED',
      message: result.errorMessage || 'You do not have permission to access this feed'
    }
  };
}
