/**
 * Feed Sync Integration Service
 * 
 * Wires together the feed sync, embedding, and clustering pipeline.
 * Implements Requirements: 3.8, 3.9, 7.1, 7.2
 * 
 * This module provides the integration layer that:
 * - Queues new articles for embedding generation after feed sync
 * - Triggers clustering after embedding batches complete
 * - Handles graceful degradation when AI services are unavailable
 */

import type { Feed, Article } from '@shared/schema';
import type { IStorage } from './storage';
import { syncFeed, syncFeeds, type SyncResult, type SyncOptions } from './rss-sync';
import { 
  createEmbeddingQueueManager, 
  isEmbeddingServiceAvailable,
  type EmbeddingQueueManager,
  type QueueProcessResult
} from './embedding-service';
import { 
  createClusteringServiceManager, 
  isClusteringServiceAvailable,
  type ClusteringServiceManager,
  type ClusterGenerationResult
} from './clustering-service';
import { 
  createSyncPipelineManager,
  type SyncPipelineManager,
  type SyncTriggerResult
} from './feed-scheduler';

// ============================================================================
// Types
// ============================================================================

export interface FeedSyncIntegrationResult {
  syncResult: SyncResult;
  embeddingsQueued: number;
  clusteringTriggered: boolean;
}

export interface BatchSyncIntegrationResult {
  syncResults: SyncResult[];
  totalEmbeddingsQueued: number;
  clusteringTriggered: boolean;
  feedsSuccessful: number;
  feedsFailed: number;
}

export interface PipelineStatus {
  embeddingServiceAvailable: boolean;
  clusteringServiceAvailable: boolean;
  embeddingQueueStats: {
    pending: number;
    processing: number;
    failed: number;
    deadLetter: number;
  } | null;
}

// ============================================================================
// Feed Sync Integration Service
// Requirements: 3.8, 3.9, 7.1, 7.2
// ============================================================================

/**
 * Feed Sync Integration Service
 * 
 * Coordinates the feed sync → embedding → clustering pipeline
 * 
 * Property 11: Feed Sync Triggers Embedding Queue
 * - When a feed sync adds new articles, all new articles are added to the embedding queue
 */
export class FeedSyncIntegrationService {
  private storage: IStorage;
  private embeddingManager: EmbeddingQueueManager | null = null;
  private clusteringManager: ClusteringServiceManager | null = null;
  private pipelineManager: SyncPipelineManager | null = null;
  private clusteringPending: boolean = false;
  
  constructor(storage: IStorage) {
    this.storage = storage;
    this.initializeManagers();
  }
  
  /**
   * Initialize service managers if AI services are available
   */
  private initializeManagers(): void {
    // Initialize embedding manager if service is available
    if (isEmbeddingServiceAvailable()) {
      this.embeddingManager = createEmbeddingQueueManager(this.storage as any);
      console.log('✅ Embedding queue manager initialized');
    } else {
      console.warn('⚠️ Embedding service unavailable - embedding queue disabled');
    }
    
    // Initialize clustering manager if service is available
    if (isClusteringServiceAvailable()) {
      this.clusteringManager = createClusteringServiceManager(this.storage as any);
      console.log('✅ Clustering service manager initialized');
    } else {
      console.warn('⚠️ Clustering service unavailable - auto-clustering disabled');
    }
    
    // Initialize pipeline manager
    this.pipelineManager = createSyncPipelineManager(this.storage as any, {
      onSyncComplete: async (feedId, newArticleIds) => {
        console.log(`📥 Feed ${feedId} sync complete with ${newArticleIds.length} new articles`);
      },
      onEmbeddingsComplete: async (articleIds) => {
        console.log(`✅ Embeddings complete for ${articleIds.length} articles`);
      },
      onClusteringComplete: async () => {
        console.log('✅ Clustering regeneration complete');
      }
    });
  }
  
  /**
   * Sync a single feed and queue new articles for embedding
   * 
   * Requirements: 3.8, 7.1
   * Property 11: Feed Sync Triggers Embedding Queue
   * 
   * @param feed - The feed to sync
   * @param options - Sync options
   * @returns Integration result with sync stats and embedding queue info
   */
  async syncFeedWithEmbedding(
    feed: Feed,
    options: SyncOptions = {}
  ): Promise<FeedSyncIntegrationResult> {
    const syncStartTime = new Date();
    
    // Perform the feed sync
    const syncResult = await syncFeed(feed, options);
    
    let embeddingsQueued = 0;
    let clusteringTriggered = false;
    
    // If sync was successful and we have new articles, queue them for embedding
    if (syncResult.success && syncResult.articlesNew > 0) {
      embeddingsQueued = await this.queueNewArticlesForEmbedding(
        feed.id,
        syncStartTime,
        syncResult.articlesNew
      );
      
      // Mark that clustering should be triggered after embeddings complete
      if (embeddingsQueued > 0) {
        this.clusteringPending = true;
      }
    }
    
    // Update feed schedule after sync
    if (this.pipelineManager) {
      try {
        await this.pipelineManager.onFeedSyncComplete(
          feed.id,
          syncStartTime,
          syncResult.articlesNew
        );
      } catch (error) {
        console.warn('⚠️ Failed to update pipeline after sync:', error);
      }
    }
    
    return {
      syncResult,
      embeddingsQueued,
      clusteringTriggered
    };
  }
  
  /**
   * Sync multiple feeds and queue new articles for embedding
   * 
   * Requirements: 3.8, 3.9, 7.1, 7.2
   * 
   * @param feeds - The feeds to sync
   * @param options - Sync options
   * @returns Batch integration result
   */
  async syncFeedsWithEmbedding(
    feeds: Feed[],
    options: SyncOptions & { batchSize?: number; delayMs?: number } = {}
  ): Promise<BatchSyncIntegrationResult> {
    const syncStartTime = new Date();
    
    // Perform batch feed sync
    const syncResults = await syncFeeds(feeds, options);
    
    let totalEmbeddingsQueued = 0;
    let feedsSuccessful = 0;
    let feedsFailed = 0;
    
    // Process each sync result
    for (let i = 0; i < syncResults.length; i++) {
      const result = syncResults[i];
      const feed = feeds[i];
      
      if (result.success) {
        feedsSuccessful++;
        
        // Queue new articles for embedding
        if (result.articlesNew > 0) {
          const queued = await this.queueNewArticlesForEmbedding(
            feed.id,
            syncStartTime,
            result.articlesNew
          );
          totalEmbeddingsQueued += queued;
        }
      } else {
        feedsFailed++;
      }
    }
    
    // Trigger clustering if we have new embeddings queued
    let clusteringTriggered = false;
    if (totalEmbeddingsQueued > 0) {
      this.clusteringPending = true;
      
      // Process embedding queue
      await this.processEmbeddingQueue();
      
      // Trigger clustering after embeddings (Requirements: 3.9)
      clusteringTriggered = await this.triggerClusteringIfPending();
    }
    
    console.log(`📊 Batch sync complete: ${feedsSuccessful}/${feeds.length} successful, ${totalEmbeddingsQueued} articles queued for embedding`);
    
    return {
      syncResults,
      totalEmbeddingsQueued,
      clusteringTriggered,
      feedsSuccessful,
      feedsFailed
    };
  }
  
  /**
   * Queue new articles from a feed sync for embedding generation
   * 
   * Requirements: 3.8, 7.1
   * Property 11: Feed Sync Triggers Embedding Queue
   * 
   * @param feedId - The feed ID
   * @param syncStartTime - When the sync started
   * @param newArticleCount - Number of new articles from sync
   * @returns Number of articles queued
   */
  private async queueNewArticlesForEmbedding(
    feedId: string,
    syncStartTime: Date,
    newArticleCount: number
  ): Promise<number> {
    if (!this.embeddingManager) {
      console.warn('⚠️ Embedding manager not available - skipping embedding queue');
      return 0;
    }
    
    if (newArticleCount === 0) {
      return 0;
    }
    
    try {
      // Get IDs of new articles from this sync
      const newArticleIds = await this.storage.getNewArticleIds(feedId, syncStartTime);
      
      if (newArticleIds.length === 0) {
        return 0;
      }
      
      // Queue articles for embedding generation (Property 11)
      await this.embeddingManager.queueForEmbedding(newArticleIds, 0);
      
      console.log(`📥 Queued ${newArticleIds.length} new articles for embedding from feed ${feedId}`);
      
      return newArticleIds.length;
    } catch (error) {
      console.error(`❌ Failed to queue articles for embedding from feed ${feedId}:`, error);
      return 0;
    }
  }
  
  /**
   * Process the embedding queue
   * 
   * Requirements: 7.1
   * 
   * @param batchSize - Number of articles to process per batch
   * @returns Queue processing result
   */
  async processEmbeddingQueue(batchSize: number = 100): Promise<QueueProcessResult | null> {
    if (!this.embeddingManager) {
      console.warn('⚠️ Embedding manager not available');
      return null;
    }
    
    try {
      const result = await this.embeddingManager.processQueue(batchSize);
      
      console.log(`📊 Embedding queue processed: ${result.succeeded} succeeded, ${result.failed} failed, ${result.remainingInQueue} remaining`);
      
      // If we processed some embeddings, notify the pipeline
      if (result.succeeded > 0 && this.pipelineManager) {
        // Get the article IDs that were processed (we don't have them directly, but we can trigger clustering)
        await this.pipelineManager.onEmbeddingBatchComplete([]);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to process embedding queue:', error);
      return null;
    }
  }
  
  /**
   * Trigger clustering if there are pending embeddings
   * 
   * Requirements: 3.9, 7.2
   * 
   * @returns Whether clustering was triggered
   */
  async triggerClusteringIfPending(): Promise<boolean> {
    if (!this.clusteringPending) {
      return false;
    }
    
    if (!this.clusteringManager) {
      console.warn('⚠️ Clustering manager not available');
      this.clusteringPending = false;
      return false;
    }
    
    try {
      console.log('🔄 Triggering cluster regeneration after embedding batch...');
      
      // Generate clusters (this will use the latest embeddings)
      const result = await this.clusteringManager.generateClusters();
      
      console.log(`✅ Clustering complete: ${result.clustersCreated} clusters from ${result.articlesProcessed} articles`);
      
      this.clusteringPending = false;
      return true;
    } catch (error) {
      console.error('❌ Failed to trigger clustering:', error);
      this.clusteringPending = false;
      return false;
    }
  }
  
  /**
   * Manually trigger clustering
   * 
   * Requirements: 3.6
   * 
   * @param userId - Optional user ID to scope clustering
   * @param feedIds - Optional feed IDs to scope clustering
   * @returns Clustering result
   */
  async triggerClustering(
    userId?: string,
    feedIds?: string[]
  ): Promise<ClusterGenerationResult | null> {
    if (!this.clusteringManager) {
      console.warn('⚠️ Clustering manager not available');
      return null;
    }
    
    try {
      console.log('🔄 Manually triggering cluster generation...');
      
      const result = await this.clusteringManager.generateClusters(userId, feedIds);
      
      console.log(`✅ Manual clustering complete: ${result.clustersCreated} clusters from ${result.articlesProcessed} articles`);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to trigger manual clustering:', error);
      return null;
    }
  }
  
  /**
   * Get the current pipeline status
   * 
   * @returns Pipeline status information
   */
  async getPipelineStatus(): Promise<PipelineStatus> {
    let embeddingQueueStats = null;
    
    if (this.embeddingManager) {
      try {
        embeddingQueueStats = await this.embeddingManager.getQueueStats();
      } catch (error) {
        console.warn('⚠️ Failed to get embedding queue stats:', error);
      }
    }
    
    return {
      embeddingServiceAvailable: isEmbeddingServiceAvailable(),
      clusteringServiceAvailable: isClusteringServiceAvailable(),
      embeddingQueueStats
    };
  }
  
  /**
   * Expire old clusters
   * 
   * Requirements: 2.6
   * 
   * @returns Number of clusters expired
   */
  async expireOldClusters(): Promise<number> {
    if (!this.clusteringManager) {
      return 0;
    }
    
    try {
      return await this.clusteringManager.expireOldClusters();
    } catch (error) {
      console.error('❌ Failed to expire old clusters:', error);
      return 0;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a feed sync integration service
 * 
 * @param storage - Storage interface
 * @returns Feed sync integration service instance
 */
export function createFeedSyncIntegrationService(storage: IStorage): FeedSyncIntegrationService {
  return new FeedSyncIntegrationService(storage);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Sync a feed with automatic embedding and clustering integration
 * 
 * This is a convenience function that creates a temporary service instance
 * for one-off sync operations.
 * 
 * @param storage - Storage interface
 * @param feed - Feed to sync
 * @param options - Sync options
 * @returns Integration result
 */
export async function syncFeedWithIntegration(
  storage: IStorage,
  feed: Feed,
  options: SyncOptions = {}
): Promise<FeedSyncIntegrationResult> {
  const service = createFeedSyncIntegrationService(storage);
  return service.syncFeedWithEmbedding(feed, options);
}

/**
 * Sync multiple feeds with automatic embedding and clustering integration
 * 
 * @param storage - Storage interface
 * @param feeds - Feeds to sync
 * @param options - Sync options
 * @returns Batch integration result
 */
export async function syncFeedsWithIntegration(
  storage: IStorage,
  feeds: Feed[],
  options: SyncOptions & { batchSize?: number; delayMs?: number } = {}
): Promise<BatchSyncIntegrationResult> {
  const service = createFeedSyncIntegrationService(storage);
  return service.syncFeedsWithEmbedding(feeds, options);
}
