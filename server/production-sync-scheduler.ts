/**
 * Production Sync Scheduler
 * 
 * Manages RSS feed synchronization scheduling based on priority levels,
 * sync intervals, and system resources in production environments.
 * 
 * Requirements: 3.2, 3.3, 3.5
 */

import { syncFeedsProduction, type ProductionSyncResult, type BatchSyncOptions } from './production-rss-sync';
import { PRODUCTION_FEEDS, getFeedsByPriority, getFeedsBySyncInterval, getEnabledFeeds } from './production-feeds';
import { storage } from './storage';
import type { Feed } from '@shared/schema';

export interface SchedulerConfig {
  enabled: boolean;
  highPriorityInterval: number;    // milliseconds
  mediumPriorityInterval: number;  // milliseconds
  lowPriorityInterval: number;     // milliseconds
  maxConcurrentSyncs: number;
  batchSize: number;
  delayBetweenBatches: number;
  retryFailedAfter: number;        // milliseconds
  healthCheckInterval: number;     // milliseconds
}

export interface SchedulerStats {
  totalFeeds: number;
  activeFeeds: number;
  lastSyncTime: Date | null;
  nextSyncTime: Date | null;
  successRate: number;
  averageSyncDuration: number;
  failedFeeds: string[];
  syncHistory: SyncHistoryEntry[];
}

export interface SyncHistoryEntry {
  timestamp: Date;
  feedCount: number;
  successCount: number;
  duration: number;
  priority: 'high' | 'medium' | 'low' | 'mixed';
}

/**
 * Production RSS Sync Scheduler
 */
export class ProductionSyncScheduler {
  private config: SchedulerConfig;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private syncHistory: SyncHistoryEntry[] = [];
  private lastSyncTimes: Map<string, Date> = new Map();
  private failedFeeds: Set<string> = new Set();
  
  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      enabled: true,
      highPriorityInterval: 60 * 60 * 1000,      // 1 hour
      mediumPriorityInterval: 6 * 60 * 60 * 1000, // 6 hours
      lowPriorityInterval: 24 * 60 * 60 * 1000,   // 24 hours
      maxConcurrentSyncs: 2,
      batchSize: 3,
      delayBetweenBatches: 5000,
      retryFailedAfter: 2 * 60 * 60 * 1000,      // 2 hours
      healthCheckInterval: 15 * 60 * 1000,        // 15 minutes
      ...config
    };
    
    console.log('🕐 Production Sync Scheduler initialized with configuration:');
    console.log(`   High priority interval: ${this.config.highPriorityInterval / 1000 / 60} minutes`);
    console.log(`   Medium priority interval: ${this.config.mediumPriorityInterval / 1000 / 60} minutes`);
    console.log(`   Low priority interval: ${this.config.lowPriorityInterval / 1000 / 60} minutes`);
    console.log(`   Batch size: ${this.config.batchSize}`);
    console.log(`   Max concurrent syncs: ${this.config.maxConcurrentSyncs}`);
  }
  
  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Scheduler is already running');
      return;
    }
    
    if (!this.config.enabled) {
      console.log('📴 Scheduler is disabled');
      return;
    }
    
    console.log('🚀 Starting Production Sync Scheduler...');
    this.isRunning = true;
    
    // Schedule initial sync for each priority level
    this.scheduleHighPrioritySync();
    this.scheduleMediumPrioritySync();
    this.scheduleLowPrioritySync();
    
    // Schedule health checks
    this.scheduleHealthCheck();
    
    // Schedule failed feed retries
    this.scheduleFailedFeedRetry();
    
    console.log('✅ Production Sync Scheduler started successfully');
  }
  
  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️ Scheduler is not running');
      return;
    }
    
    console.log('🛑 Stopping Production Sync Scheduler...');
    this.isRunning = false;
    
    // Clear all timers
    this.timers.forEach((timer, name) => {
      clearTimeout(timer);
      console.log(`   Cleared timer: ${name}`);
    });
    this.timers.clear();
    
    console.log('✅ Production Sync Scheduler stopped');
  }
  
  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    const totalFeeds = PRODUCTION_FEEDS.length;
    const activeFeeds = getEnabledFeeds().length;
    
    // Calculate success rate from recent history
    const recentHistory = this.syncHistory.slice(-10);
    const totalSyncs = recentHistory.reduce((sum, entry) => sum + entry.feedCount, 0);
    const successfulSyncs = recentHistory.reduce((sum, entry) => sum + entry.successCount, 0);
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
    
    // Calculate average sync duration
    const averageSyncDuration = recentHistory.length > 0 
      ? recentHistory.reduce((sum, entry) => sum + entry.duration, 0) / recentHistory.length
      : 0;
    
    // Get last and next sync times
    const lastSyncTime = this.syncHistory.length > 0 
      ? this.syncHistory[this.syncHistory.length - 1].timestamp
      : null;
    
    const nextSyncTime = this.getNextSyncTime();
    
    return {
      totalFeeds,
      activeFeeds,
      lastSyncTime,
      nextSyncTime,
      successRate: Math.round(successRate * 100) / 100,
      averageSyncDuration: Math.round(averageSyncDuration),
      failedFeeds: Array.from(this.failedFeeds),
      syncHistory: this.syncHistory.slice(-20) // Last 20 entries
    };
  }
  
  /**
   * Manually trigger sync for specific priority
   */
  async triggerSync(priority: 'high' | 'medium' | 'low' | 'all'): Promise<ProductionSyncResult[]> {
    console.log(`🔄 Manually triggering ${priority} priority sync...`);
    
    let feeds: any[];
    let syncPriority: 'high' | 'medium' | 'low' | 'mixed';
    
    if (priority === 'all') {
      feeds = getEnabledFeeds();
      syncPriority = 'mixed';
    } else {
      feeds = getFeedsByPriority(priority);
      syncPriority = priority;
    }
    
    return this.performSync(feeds, syncPriority);
  }
  
  /**
   * Schedule high priority feed sync
   */
  private scheduleHighPrioritySync(): void {
    const syncHighPriority = async () => {
      if (!this.isRunning) return;
      
      try {
        const feeds = getFeedsByPriority('high');
        await this.performSync(feeds, 'high');
      } catch (error) {
        console.error('❌ High priority sync failed:', error);
      }
      
      // Schedule next high priority sync
      if (this.isRunning) {
        const timer = setTimeout(syncHighPriority, this.config.highPriorityInterval);
        this.timers.set('high-priority', timer);
      }
    };
    
    // Start immediately, then schedule recurring
    setTimeout(syncHighPriority, 1000); // 1 second delay for startup
  }
  
  /**
   * Schedule medium priority feed sync
   */
  private scheduleMediumPrioritySync(): void {
    const syncMediumPriority = async () => {
      if (!this.isRunning) return;
      
      try {
        const feeds = getFeedsByPriority('medium');
        await this.performSync(feeds, 'medium');
      } catch (error) {
        console.error('❌ Medium priority sync failed:', error);
      }
      
      // Schedule next medium priority sync
      if (this.isRunning) {
        const timer = setTimeout(syncMediumPriority, this.config.mediumPriorityInterval);
        this.timers.set('medium-priority', timer);
      }
    };
    
    // Start after 5 minutes to stagger with high priority
    setTimeout(syncMediumPriority, 5 * 60 * 1000);
  }
  
  /**
   * Schedule low priority feed sync
   */
  private scheduleLowPrioritySync(): void {
    const syncLowPriority = async () => {
      if (!this.isRunning) return;
      
      try {
        const feeds = getFeedsByPriority('low');
        await this.performSync(feeds, 'low');
      } catch (error) {
        console.error('❌ Low priority sync failed:', error);
      }
      
      // Schedule next low priority sync
      if (this.isRunning) {
        const timer = setTimeout(syncLowPriority, this.config.lowPriorityInterval);
        this.timers.set('low-priority', timer);
      }
    };
    
    // Start after 10 minutes to stagger with other priorities
    setTimeout(syncLowPriority, 10 * 60 * 1000);
  }
  
  /**
   * Schedule health checks
   */
  private scheduleHealthCheck(): void {
    const performHealthCheck = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
      
      // Schedule next health check
      if (this.isRunning) {
        const timer = setTimeout(performHealthCheck, this.config.healthCheckInterval);
        this.timers.set('health-check', timer);
      }
    };
    
    // Start health checks after 2 minutes
    setTimeout(performHealthCheck, 2 * 60 * 1000);
  }
  
  /**
   * Schedule failed feed retry
   */
  private scheduleFailedFeedRetry(): void {
    const retryFailedFeeds = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.retryFailedFeeds();
      } catch (error) {
        console.error('❌ Failed feed retry failed:', error);
      }
      
      // Schedule next retry
      if (this.isRunning) {
        const timer = setTimeout(retryFailedFeeds, this.config.retryFailedAfter);
        this.timers.set('failed-retry', timer);
      }
    };
    
    // Start retries after 30 minutes
    setTimeout(retryFailedFeeds, 30 * 60 * 1000);
  }
  
  /**
   * Perform sync for a set of feeds
   */
  private async performSync(
    feeds: any[], 
    priority: 'high' | 'medium' | 'low' | 'mixed'
  ): Promise<ProductionSyncResult[]> {
    
    if (feeds.length === 0) {
      console.log(`📭 No ${priority} priority feeds to sync`);
      return [];
    }
    
    const startTime = Date.now();
    console.log(`🔄 Starting ${priority} priority sync for ${feeds.length} feeds`);
    
    // Configure sync options based on priority
    const syncOptions: BatchSyncOptions = {
      batchSize: this.config.batchSize,
      delayMs: this.config.delayBetweenBatches,
      maxConcurrent: this.config.maxConcurrentSyncs,
      validateContent: priority === 'high', // Only validate high priority feeds
      maxRetries: priority === 'high' ? 3 : 2,
      retryDelayMs: 2000,
      onProgress: (completed, total, current) => {
        console.log(`📊 ${priority} sync progress: ${completed}/${total} - ${current}`);
      },
      onError: (feed, error) => {
        console.error(`❌ ${priority} sync error for ${feed.name}: ${error}`);
        this.failedFeeds.add(feed.id);
      }
    };
    
    // Perform the sync
    const results = await syncFeedsProduction(feeds, syncOptions);
    
    // Update statistics
    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    this.syncHistory.push({
      timestamp: new Date(),
      feedCount: feeds.length,
      successCount,
      duration,
      priority
    });
    
    // Keep only last 50 history entries
    if (this.syncHistory.length > 50) {
      this.syncHistory = this.syncHistory.slice(-50);
    }
    
    // Update last sync times for successful feeds
    results.forEach((result, index) => {
      if (result.success) {
        this.lastSyncTimes.set(feeds[index].id, new Date());
        this.failedFeeds.delete(feeds[index].id);
      }
    });
    
    console.log(`✅ ${priority} priority sync completed: ${successCount}/${feeds.length} successful (${duration}ms)`);
    
    return results;
  }
  
  /**
   * Perform health check on system
   */
  private async performHealthCheck(): Promise<void> {
    console.log('🏥 Performing system health check...');
    
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (memUsageMB > 500) { // 500MB threshold
        console.warn(`⚠️ High memory usage: ${memUsageMB}MB`);
      }
      
      // Check failed feeds
      if (this.failedFeeds.size > 0) {
        console.warn(`⚠️ ${this.failedFeeds.size} feeds are currently failing`);
      }
      
      // Check sync frequency
      const stats = this.getStats();
      if (stats.successRate < 80) {
        console.warn(`⚠️ Low success rate: ${stats.successRate}%`);
      }
      
      console.log(`💚 Health check completed - Memory: ${memUsageMB}MB, Success rate: ${stats.successRate}%`);
      
    } catch (error) {
      console.error('❌ Health check error:', error);
    }
  }
  
  /**
   * Retry failed feeds
   */
  private async retryFailedFeeds(): Promise<void> {
    if (this.failedFeeds.size === 0) {
      return;
    }
    
    console.log(`🔄 Retrying ${this.failedFeeds.size} failed feeds...`);
    
    // Get failed feed configurations
    const failedFeedIds = Array.from(this.failedFeeds);
    const failedFeedConfigs = PRODUCTION_FEEDS.filter(feed => 
      failedFeedIds.includes(feed.id) && feed.enabled
    );
    
    if (failedFeedConfigs.length === 0) {
      console.log('📭 No failed feeds to retry');
      return;
    }
    
    // Retry with more conservative settings
    const results = await syncFeedsProduction(failedFeedConfigs, {
      batchSize: 1, // One at a time for failed feeds
      delayMs: 10000, // Longer delay
      maxRetries: 1, // Only one retry attempt
      validateContent: false, // Skip validation for retries
      onError: (feed, error) => {
        console.error(`❌ Retry failed for ${feed.name}: ${error}`);
      }
    });
    
    // Update failed feeds set
    results.forEach((result, index) => {
      if (result.success) {
        this.failedFeeds.delete(failedFeedConfigs[index].id);
        console.log(`✅ Retry successful for ${failedFeedConfigs[index].name}`);
      }
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`🔄 Retry completed: ${successCount}/${failedFeedConfigs.length} successful`);
  }
  
  /**
   * Get next scheduled sync time
   */
  private getNextSyncTime(): Date | null {
    const now = Date.now();
    const nextTimes: number[] = [];
    
    // Calculate next sync times for each priority
    const lastHighSync = this.getLastSyncTime('high');
    if (lastHighSync) {
      nextTimes.push(lastHighSync.getTime() + this.config.highPriorityInterval);
    } else {
      nextTimes.push(now + 60000); // 1 minute if never synced
    }
    
    const lastMediumSync = this.getLastSyncTime('medium');
    if (lastMediumSync) {
      nextTimes.push(lastMediumSync.getTime() + this.config.mediumPriorityInterval);
    } else {
      nextTimes.push(now + 5 * 60000); // 5 minutes if never synced
    }
    
    const lastLowSync = this.getLastSyncTime('low');
    if (lastLowSync) {
      nextTimes.push(lastLowSync.getTime() + this.config.lowPriorityInterval);
    } else {
      nextTimes.push(now + 10 * 60000); // 10 minutes if never synced
    }
    
    // Return the earliest next sync time
    const nextTime = Math.min(...nextTimes);
    return nextTime > now ? new Date(nextTime) : new Date(now + 60000);
  }
  
  /**
   * Get last sync time for a priority level
   */
  private getLastSyncTime(priority: 'high' | 'medium' | 'low'): Date | null {
    const entries = this.syncHistory.filter(entry => entry.priority === priority);
    return entries.length > 0 ? entries[entries.length - 1].timestamp : null;
  }
}

/**
 * Global scheduler instance
 */
let schedulerInstance: ProductionSyncScheduler | null = null;

/**
 * Get or create the global scheduler instance
 */
export function getScheduler(config?: Partial<SchedulerConfig>): ProductionSyncScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ProductionSyncScheduler(config);
  }
  return schedulerInstance;
}

/**
 * Start the global scheduler
 */
export async function startScheduler(config?: Partial<SchedulerConfig>): Promise<void> {
  const scheduler = getScheduler(config);
  await scheduler.start();
}

/**
 * Stop the global scheduler
 */
export async function stopScheduler(): Promise<void> {
  if (schedulerInstance) {
    await schedulerInstance.stop();
  }
}