/**
 * AI Background Scheduler
 * 
 * Manages background processing for AI features:
 * - Embedding generation queue processing
 * - Cluster generation and refresh
 * - Periodic cleanup of expired clusters
 */

import { getStorage } from './storage';
import { 
  createEmbeddingQueueManager, 
  isEmbeddingServiceAvailable,
  type EmbeddingQueueManager 
} from './embedding-service';
import { 
  createClusteringServiceManager, 
  isClusteringServiceAvailable,
  type ClusteringServiceManager 
} from './clustering-service';

// Scheduler configuration
const EMBEDDING_PROCESS_INTERVAL = 30 * 1000; // Process embeddings every 30 seconds
const CLUSTERING_INTERVAL = 5 * 60 * 1000; // Generate clusters every 5 minutes
const CLUSTER_CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up expired clusters every hour
const EMBEDDING_BATCH_SIZE = 50; // Process 50 articles at a time

// Scheduler state
let embeddingInterval: NodeJS.Timeout | null = null;
let clusteringInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let embeddingManager: EmbeddingQueueManager | null = null;
let clusteringManager: ClusteringServiceManager | null = null;

// Stats tracking
interface SchedulerStats {
  embeddingsProcessed: number;
  embeddingsFailed: number;
  clustersGenerated: number;
  clustersExpired: number;
  lastEmbeddingRun: Date | null;
  lastClusteringRun: Date | null;
  lastCleanupRun: Date | null;
  errors: string[];
}

const stats: SchedulerStats = {
  embeddingsProcessed: 0,
  embeddingsFailed: 0,
  clustersGenerated: 0,
  clustersExpired: 0,
  lastEmbeddingRun: null,
  lastClusteringRun: null,
  lastCleanupRun: null,
  errors: []
};

/**
 * Initialize the AI background scheduler
 */
export async function initializeAIScheduler(): Promise<boolean> {
  if (isRunning) {
    console.log('⚠️ AI scheduler already running');
    return true;
  }

  console.log('🚀 Initializing AI background scheduler...');

  try {
    const storage = await getStorage();

    // Initialize embedding manager if service is available
    if (isEmbeddingServiceAvailable()) {
      embeddingManager = createEmbeddingQueueManager(storage as any);
      console.log('✅ Embedding queue manager initialized');
    } else {
      console.warn('⚠️ OpenAI API key not configured - embedding processing disabled');
    }

    // Initialize clustering manager if service is available
    if (isClusteringServiceAvailable()) {
      clusteringManager = createClusteringServiceManager(storage as any);
      console.log('✅ Clustering service manager initialized');
    } else {
      console.warn('⚠️ Anthropic API key not configured - AI cluster labeling disabled (will use fallback)');
      // Still create the manager - it will use fallback labels
      clusteringManager = createClusteringServiceManager(storage as any);
    }

    isRunning = true;
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to initialize AI scheduler:', errorMsg);
    stats.errors.push(`Init error: ${errorMsg}`);
    return false;
  }
}

/**
 * Process the embedding queue
 */
async function processEmbeddingQueue(): Promise<void> {
  if (!embeddingManager) {
    return;
  }

  try {
    const result = await embeddingManager.processQueue(EMBEDDING_BATCH_SIZE);
    
    if (result.processed > 0) {
      stats.embeddingsProcessed += result.succeeded;
      stats.embeddingsFailed += result.failed;
      console.log(`📊 Embedding queue: ${result.succeeded} succeeded, ${result.failed} failed, ${result.remainingInQueue} remaining`);
    }
    
    stats.lastEmbeddingRun = new Date();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Embedding queue processing error:', errorMsg);
    stats.errors.push(`Embedding error: ${errorMsg}`);
    // Keep only last 10 errors
    if (stats.errors.length > 10) {
      stats.errors = stats.errors.slice(-10);
    }
  }
}

/**
 * Generate clusters from articles with embeddings
 */
async function generateClusters(): Promise<void> {
  if (!clusteringManager) {
    return;
  }

  try {
    console.log('🔄 Starting cluster generation...');
    
    // Generate clusters for all users (no userId filter = global clusters)
    const result = await clusteringManager.generateClusters(undefined, undefined, 48);
    
    if (result.clustersCreated > 0) {
      stats.clustersGenerated += result.clustersCreated;
      console.log(`✅ Generated ${result.clustersCreated} clusters from ${result.articlesProcessed} articles in ${result.processingTimeMs}ms`);
    } else if (result.articlesProcessed > 0) {
      console.log(`ℹ️ Processed ${result.articlesProcessed} articles but no clusters formed (need 2+ articles from 2+ sources with similarity >= 0.75)`);
    } else {
      console.log('ℹ️ No articles with embeddings found for clustering');
    }
    
    stats.lastClusteringRun = new Date();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Cluster generation error:', errorMsg);
    stats.errors.push(`Clustering error: ${errorMsg}`);
    if (stats.errors.length > 10) {
      stats.errors = stats.errors.slice(-10);
    }
  }
}

/**
 * Clean up expired clusters
 */
async function cleanupExpiredClusters(): Promise<void> {
  if (!clusteringManager) {
    return;
  }

  try {
    const expiredCount = await clusteringManager.expireOldClusters();
    
    if (expiredCount > 0) {
      stats.clustersExpired += expiredCount;
      console.log(`🗑️ Cleaned up ${expiredCount} expired clusters`);
    }
    
    stats.lastCleanupRun = new Date();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Cluster cleanup error:', errorMsg);
    stats.errors.push(`Cleanup error: ${errorMsg}`);
    if (stats.errors.length > 10) {
      stats.errors = stats.errors.slice(-10);
    }
  }
}

/**
 * Start the background scheduler
 */
export function startAIScheduler(): void {
  if (!isRunning) {
    console.warn('⚠️ AI scheduler not initialized. Call initializeAIScheduler() first.');
    return;
  }

  console.log('🎯 Starting AI background scheduler intervals...');

  // Start embedding processing interval
  if (embeddingManager && !embeddingInterval) {
    // Run immediately, then on interval
    processEmbeddingQueue();
    embeddingInterval = setInterval(processEmbeddingQueue, EMBEDDING_PROCESS_INTERVAL);
    console.log(`  • Embedding processing: every ${EMBEDDING_PROCESS_INTERVAL / 1000}s`);
  }

  // Start clustering interval
  if (clusteringManager && !clusteringInterval) {
    // Run immediately, then on interval
    generateClusters();
    clusteringInterval = setInterval(generateClusters, CLUSTERING_INTERVAL);
    console.log(`  • Cluster generation: every ${CLUSTERING_INTERVAL / 1000}s`);
  }

  // Start cleanup interval
  if (clusteringManager && !cleanupInterval) {
    cleanupInterval = setInterval(cleanupExpiredClusters, CLUSTER_CLEANUP_INTERVAL);
    console.log(`  • Cluster cleanup: every ${CLUSTER_CLEANUP_INTERVAL / 1000}s`);
  }

  console.log('✅ AI background scheduler started');
}

/**
 * Stop the background scheduler
 */
export function stopAIScheduler(): void {
  console.log('🛑 Stopping AI background scheduler...');

  if (embeddingInterval) {
    clearInterval(embeddingInterval);
    embeddingInterval = null;
  }

  if (clusteringInterval) {
    clearInterval(clusteringInterval);
    clusteringInterval = null;
  }

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  isRunning = false;
  console.log('✅ AI background scheduler stopped');
}

/**
 * Get scheduler statistics
 */
export function getSchedulerStats(): SchedulerStats & { isRunning: boolean; services: { embeddings: boolean; clustering: boolean } } {
  return {
    ...stats,
    isRunning,
    services: {
      embeddings: isEmbeddingServiceAvailable(),
      clustering: isClusteringServiceAvailable()
    }
  };
}

/**
 * Manually trigger embedding processing
 */
export async function triggerEmbeddingProcessing(): Promise<{ processed: number; succeeded: number; failed: number }> {
  if (!embeddingManager) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const result = await embeddingManager.processQueue(EMBEDDING_BATCH_SIZE);
  stats.embeddingsProcessed += result.succeeded;
  stats.embeddingsFailed += result.failed;
  stats.lastEmbeddingRun = new Date();
  
  return {
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed
  };
}

/**
 * Manually trigger cluster generation
 */
export async function triggerClusterGeneration(userId?: string): Promise<{ clustersCreated: number; articlesProcessed: number }> {
  if (!clusteringManager) {
    return { clustersCreated: 0, articlesProcessed: 0 };
  }

  const result = await clusteringManager.generateClusters(userId, undefined, 48);
  stats.clustersGenerated += result.clustersCreated;
  stats.lastClusteringRun = new Date();
  
  return {
    clustersCreated: result.clustersCreated,
    articlesProcessed: result.articlesProcessed
  };
}

/**
 * Queue articles for embedding generation
 */
export async function queueArticlesForEmbedding(articleIds: string[]): Promise<void> {
  if (!embeddingManager) {
    console.warn('⚠️ Embedding manager not available');
    return;
  }

  await embeddingManager.queueForEmbedding(articleIds, 0);
  console.log(`📥 Queued ${articleIds.length} articles for embedding generation`);
}
