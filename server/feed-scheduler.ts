/**
 * Feed Scheduler Service
 * 
 * Manages priority-based feed synchronization timing.
 * Implements Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 6.2, 6.6
 */

import type { Feed, FeedPriority, RecommendedFeed } from '@shared/schema';
import { PRIORITY_INTERVALS, HIGH_PRIORITY_SOURCES } from '@shared/schema';

// Types
export interface FeedSyncSchedule {
  feedId: string;
  feedName: string;
  priority: FeedPriority;
  lastSyncAt: Date | null;
  nextSyncAt: Date;
  syncIntervalHours: number;
}

export interface SyncTriggerResult {
  feedsTriggered: number;
  embeddingsQueued: number;
  clusteringScheduled: boolean;
}

export interface FeedSchedulerConfig {
  defaultPriority?: FeedPriority;
  enableAutoClustering?: boolean;
}

// ============================================================================
// Priority-Based Scheduling Logic
// Requirements: 3.1, 3.2, 3.3
// ============================================================================

/**
 * Get the sync interval in hours for a given priority level
 * Requirements: 3.1, 3.2, 3.3
 * 
 * Property 9: Priority-Based Sync Interval
 * - high = 1 hour
 * - medium = 24 hours
 * - low = 168 hours (7 days)
 */
export function getSyncIntervalHours(priority: FeedPriority): number {
  return PRIORITY_INTERVALS[priority];
}

/**
 * Calculate the next sync time based on priority and last sync time
 * Requirements: 3.1, 3.2, 3.3, 6.2
 * 
 * Property 14: Priority Change Schedule Update
 */
export function calculateNextSyncAt(
  priority: FeedPriority,
  lastSyncAt: Date | null = null
): Date {
  const intervalHours = getSyncIntervalHours(priority);
  const baseTime = lastSyncAt || new Date();
  
  return new Date(baseTime.getTime() + intervalHours * 60 * 60 * 1000);
}

/**
 * Validate that a priority value is valid
 * Requirements: 6.2
 */
export function isValidPriority(priority: string): priority is FeedPriority {
  return priority === 'high' || priority === 'medium' || priority === 'low';
}

/**
 * Check if a feed URL matches a known breaking news source
 * Requirements: 3.7
 * 
 * Property 10: Default Priority Assignment
 */
export function isBreakingNewsSource(url: string): boolean {
  const normalizedUrl = url.toLowerCase();
  return HIGH_PRIORITY_SOURCES.some(source => normalizedUrl.includes(source));
}

/**
 * Determine the default priority for a new feed
 * Requirements: 3.4, 3.7
 * 
 * Property 10: Default Priority Assignment
 * - Default is 'medium' unless URL matches breaking news source
 */
export function getDefaultPriority(feedUrl: string): FeedPriority {
  if (isBreakingNewsSource(feedUrl)) {
    return 'high';
  }
  return 'medium';
}

/**
 * Check if a feed is due for sync based on its next_sync_at timestamp
 */
export function isFeedDueForSync(feed: Feed): boolean {
  if (!feed.next_sync_at) {
    return true; // Never synced, due immediately
  }
  
  const now = new Date();
  const nextSyncAt = new Date(feed.next_sync_at);
  
  return now >= nextSyncAt;
}


// ============================================================================
// Feed Scheduler Storage Interface
// ============================================================================

/**
 * Storage interface for feed scheduler operations
 */
export interface FeedSchedulerStorage {
  // Feed operations
  getFeedById(feedId: string): Promise<Feed | undefined>;
  getUserFeeds(userId: string): Promise<Feed[]>;
  getAllActiveFeeds(): Promise<Feed[]>;
  
  // Priority and scheduling updates
  updateFeedPriority(feedId: string, priority: FeedPriority): Promise<Feed>;
  updateFeedSchedule(feedId: string, updates: {
    sync_priority?: string;
    next_sync_at?: Date;
    sync_interval_hours?: number;
    last_fetched_at?: Date;
  }): Promise<Feed>;
  
  // Get feeds due for sync
  getFeedsDueForSync(limit?: number): Promise<Feed[]>;
  
  // Recommended feeds for priority inheritance
  getRecommendedFeedByUrl(url: string): Promise<RecommendedFeed | undefined>;
  
  // Embedding queue operations
  addToEmbeddingQueue(articleIds: string[], priority?: number): Promise<void>;
  
  // Get new article IDs from recent sync
  getNewArticleIds(feedId: string, since: Date): Promise<string[]>;
}

// ============================================================================
// Feed Scheduler Manager
// ============================================================================

/**
 * Feed Scheduler Manager
 * Handles priority-based feed synchronization scheduling
 */
export class FeedSchedulerManager {
  private storage: FeedSchedulerStorage;
  private config: FeedSchedulerConfig;
  
  constructor(storage: FeedSchedulerStorage, config: FeedSchedulerConfig = {}) {
    this.storage = storage;
    this.config = {
      defaultPriority: config.defaultPriority || 'medium',
      enableAutoClustering: config.enableAutoClustering ?? true,
    };
  }
  
  /**
   * Get feeds that are due for synchronization
   * Requirements: 3.1, 3.2, 3.3
   */
  async getFeedsDueForSync(limit: number = 50): Promise<Feed[]> {
    const feeds = await this.storage.getFeedsDueForSync(limit);
    
    // Filter to only active feeds that are actually due
    return feeds.filter(feed => {
      if (feed.status !== 'active') {
        return false;
      }
      return isFeedDueForSync(feed);
    });
  }
  
  /**
   * Schedule the next sync for a feed after a successful sync
   * Requirements: 3.1, 3.2, 3.3
   */
  async scheduleNextSync(feedId: string, lastSyncAt: Date = new Date()): Promise<Date> {
    const feed = await this.storage.getFeedById(feedId);
    
    if (!feed) {
      throw new Error(`Feed with id ${feedId} not found`);
    }
    
    const priority = (feed.sync_priority as FeedPriority) || 'medium';
    const nextSyncAt = calculateNextSyncAt(priority, lastSyncAt);
    const syncIntervalHours = getSyncIntervalHours(priority);
    
    await this.storage.updateFeedSchedule(feedId, {
      next_sync_at: nextSyncAt,
      sync_interval_hours: syncIntervalHours,
      last_fetched_at: lastSyncAt,
    });
    
    console.log(`📅 Scheduled next sync for feed ${feed.name}: ${nextSyncAt.toISOString()} (${priority} priority, ${syncIntervalHours}h interval)`);
    
    return nextSyncAt;
  }
  
  /**
   * Update a feed's priority and recalculate its sync schedule
   * Requirements: 6.2, 6.3
   * 
   * Property 14: Priority Change Schedule Update
   */
  async updateFeedPriority(feedId: string, newPriority: FeedPriority): Promise<Feed> {
    // Validate priority
    if (!isValidPriority(newPriority)) {
      throw new Error(`Invalid priority value: ${newPriority}. Must be 'high', 'medium', or 'low'.`);
    }
    
    const feed = await this.storage.getFeedById(feedId);
    
    if (!feed) {
      throw new Error(`Feed with id ${feedId} not found`);
    }
    
    // Calculate new schedule based on new priority
    const syncIntervalHours = getSyncIntervalHours(newPriority);
    const nextSyncAt = calculateNextSyncAt(newPriority, feed.last_fetched_at);
    
    // Update feed with new priority and schedule
    const updatedFeed = await this.storage.updateFeedSchedule(feedId, {
      sync_priority: newPriority,
      next_sync_at: nextSyncAt,
      sync_interval_hours: syncIntervalHours,
    });
    
    console.log(`🔄 Updated feed ${feed.name} priority to ${newPriority}, next sync: ${nextSyncAt.toISOString()}`);
    
    return updatedFeed;
  }
  
  /**
   * Get the sync schedule for a user's feeds
   * Requirements: 6.4
   */
  async getSyncSchedule(userId: string): Promise<FeedSyncSchedule[]> {
    const feeds = await this.storage.getUserFeeds(userId);
    
    return feeds.map(feed => {
      const priority = (feed.sync_priority as FeedPriority) || 'medium';
      const syncIntervalHours = getSyncIntervalHours(priority);
      
      return {
        feedId: feed.id,
        feedName: feed.name,
        priority,
        lastSyncAt: feed.last_fetched_at,
        nextSyncAt: feed.next_sync_at || calculateNextSyncAt(priority, feed.last_fetched_at),
        syncIntervalHours,
      };
    });
  }
  
  /**
   * Bulk update priorities for multiple feeds
   * Requirements: 6.5
   */
  async bulkUpdatePriorities(
    feedPriorities: Array<{ feedId: string; priority: FeedPriority }>
  ): Promise<Feed[]> {
    const updatedFeeds: Feed[] = [];
    
    for (const { feedId, priority } of feedPriorities) {
      try {
        const updatedFeed = await this.updateFeedPriority(feedId, priority);
        updatedFeeds.push(updatedFeed);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to update priority for feed ${feedId}: ${errorMessage}`);
      }
    }
    
    return updatedFeeds;
  }
}


// ============================================================================
// Default Priority Assignment
// Requirements: 3.4, 3.7, 6.6
// ============================================================================

/**
 * Determine the priority for a new feed subscription
 * Requirements: 3.4, 3.7, 6.6
 * 
 * Property 10: Default Priority Assignment
 * Property 15: Recommended Feed Priority Inheritance
 * 
 * Priority determination order:
 * 1. If subscribing from recommended_feeds, inherit default_priority
 * 2. If URL matches breaking news source, set to 'high'
 * 3. Otherwise, default to 'medium'
 */
export async function determineNewFeedPriority(
  feedUrl: string,
  storage: FeedSchedulerStorage
): Promise<FeedPriority> {
  // Check if this feed exists in recommended_feeds
  const recommendedFeed = await storage.getRecommendedFeedByUrl(feedUrl);
  
  if (recommendedFeed && recommendedFeed.default_priority) {
    // Property 15: Inherit priority from recommended_feeds
    const inheritedPriority = recommendedFeed.default_priority as FeedPriority;
    if (isValidPriority(inheritedPriority)) {
      console.log(`📋 Inheriting priority '${inheritedPriority}' from recommended feed: ${recommendedFeed.name}`);
      return inheritedPriority;
    }
  }
  
  // Property 10: Check if breaking news source
  if (isBreakingNewsSource(feedUrl)) {
    console.log(`📰 Detected breaking news source, setting high priority: ${feedUrl}`);
    return 'high';
  }
  
  // Default to medium
  return 'medium';
}

/**
 * Initialize scheduling for a newly subscribed feed
 * Requirements: 3.4, 3.7, 6.6
 */
export async function initializeFeedSchedule(
  feedId: string,
  feedUrl: string,
  storage: FeedSchedulerStorage
): Promise<{ priority: FeedPriority; nextSyncAt: Date; syncIntervalHours: number }> {
  // Determine priority
  const priority = await determineNewFeedPriority(feedUrl, storage);
  
  // Calculate schedule
  const syncIntervalHours = getSyncIntervalHours(priority);
  const nextSyncAt = calculateNextSyncAt(priority, null);
  
  // Update feed with initial schedule
  await storage.updateFeedSchedule(feedId, {
    sync_priority: priority,
    next_sync_at: nextSyncAt,
    sync_interval_hours: syncIntervalHours,
  });
  
  console.log(`✅ Initialized feed schedule: priority=${priority}, interval=${syncIntervalHours}h, next_sync=${nextSyncAt.toISOString()}`);
  
  return { priority, nextSyncAt, syncIntervalHours };
}

// ============================================================================
// Sync-to-Embedding Pipeline
// Requirements: 3.5, 3.6, 3.8, 3.9
// ============================================================================

export interface SyncPipelineCallbacks {
  onSyncComplete?: (feedId: string, newArticleIds: string[]) => Promise<void>;
  onEmbeddingsComplete?: (articleIds: string[]) => Promise<void>;
  onClusteringComplete?: () => Promise<void>;
}

/**
 * Sync Pipeline Manager
 * Coordinates the feed sync → embedding → clustering pipeline
 * Requirements: 3.5, 3.6, 3.8, 3.9
 */
export class SyncPipelineManager {
  private storage: FeedSchedulerStorage;
  private callbacks: SyncPipelineCallbacks;
  private clusteringScheduled: boolean = false;
  
  constructor(storage: FeedSchedulerStorage, callbacks: SyncPipelineCallbacks = {}) {
    this.storage = storage;
    this.callbacks = callbacks;
  }
  
  /**
   * Handle post-sync operations: queue new articles for embedding
   * Requirements: 3.8, 7.1
   * 
   * Property 11: Feed Sync Triggers Embedding Queue
   */
  async onFeedSyncComplete(
    feedId: string,
    syncStartTime: Date,
    newArticleCount: number
  ): Promise<{ embeddingsQueued: number }> {
    if (newArticleCount === 0) {
      return { embeddingsQueued: 0 };
    }
    
    // Get IDs of new articles from this sync
    const newArticleIds = await this.storage.getNewArticleIds(feedId, syncStartTime);
    
    if (newArticleIds.length === 0) {
      return { embeddingsQueued: 0 };
    }
    
    // Queue articles for embedding generation (Property 11)
    await this.storage.addToEmbeddingQueue(newArticleIds, 0);
    
    console.log(`📥 Queued ${newArticleIds.length} new articles for embedding generation from feed sync`);
    
    // Notify callback if provided
    if (this.callbacks.onSyncComplete) {
      await this.callbacks.onSyncComplete(feedId, newArticleIds);
    }
    
    // Schedule clustering after embeddings complete
    this.clusteringScheduled = true;
    
    return { embeddingsQueued: newArticleIds.length };
  }
  
  /**
   * Handle post-embedding operations: trigger clustering
   * Requirements: 3.9
   */
  async onEmbeddingBatchComplete(articleIds: string[]): Promise<{ clusteringTriggered: boolean }> {
    // Notify callback if provided
    if (this.callbacks.onEmbeddingsComplete) {
      await this.callbacks.onEmbeddingsComplete(articleIds);
    }
    
    // Trigger clustering if scheduled
    if (this.clusteringScheduled) {
      this.clusteringScheduled = false;
      
      console.log(`🔄 Triggering cluster regeneration after embedding batch complete`);
      
      if (this.callbacks.onClusteringComplete) {
        await this.callbacks.onClusteringComplete();
      }
      
      return { clusteringTriggered: true };
    }
    
    return { clusteringTriggered: false };
  }
  
  /**
   * Trigger a manual sync for specific feeds
   * Requirements: 3.5, 3.6
   */
  async triggerManualSync(feedIds: string[]): Promise<SyncTriggerResult> {
    let feedsTriggered = 0;
    let embeddingsQueued = 0;
    
    for (const feedId of feedIds) {
      const feed = await this.storage.getFeedById(feedId);
      
      if (!feed) {
        console.warn(`⚠️ Feed ${feedId} not found for manual sync`);
        continue;
      }
      
      // Mark feed as due for immediate sync by setting next_sync_at to now
      await this.storage.updateFeedSchedule(feedId, {
        next_sync_at: new Date(),
      });
      
      feedsTriggered++;
    }
    
    // Schedule clustering after manual sync
    this.clusteringScheduled = feedsTriggered > 0;
    
    console.log(`🔄 Manual sync triggered for ${feedsTriggered} feeds`);
    
    return {
      feedsTriggered,
      embeddingsQueued,
      clusteringScheduled: this.clusteringScheduled,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a feed scheduler manager with the given storage
 */
export function createFeedSchedulerManager(
  storage: FeedSchedulerStorage,
  config?: FeedSchedulerConfig
): FeedSchedulerManager {
  return new FeedSchedulerManager(storage, config);
}

/**
 * Create a sync pipeline manager with the given storage and callbacks
 */
export function createSyncPipelineManager(
  storage: FeedSchedulerStorage,
  callbacks?: SyncPipelineCallbacks
): SyncPipelineManager {
  return new SyncPipelineManager(storage, callbacks);
}
