import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function for Feed Synchronization
 * 
 * Runs every 15 minutes to sync feeds based on their priority:
 * - High priority: Every hour (breaking news sources)
 * - Medium priority: Every 24 hours (regular news)
 * - Low priority: Every 168 hours / 7 days (weekly digests)
 * 
 * This replaces the in-process ProductionSyncScheduler that can't run in serverless.
 */

export default async function handler() {
  const startTime = Date.now();
  console.log("📡 Feed Sync Scheduler triggered at", new Date().toISOString());
  
  const results = {
    feedsChecked: 0,
    feedsSynced: 0,
    feedsSucceeded: 0,
    feedsFailed: 0,
    articlesFound: 0,
    articlesNew: 0,
    errors: [] as Array<{ feedId: string; feedName: string; error: string }>,
    syncDetails: [] as Array<{ feedId: string; feedName: string; success: boolean; articlesNew: number; duration: number }>
  };
  
  try {
    // Step 1: Import storage
    console.log("Step 1: Importing storage...");
    const { getStorage } = await import("../../server/storage");
    const storage = await getStorage();
    console.log("Step 1: Storage imported successfully");
    
    // Step 2: Get feeds due for sync
    console.log("Step 2: Getting feeds due for sync...");
    const feedsDue = await storage.getFeedsDueForSync(25); // Process up to 25 feeds per run
    results.feedsChecked = feedsDue.length;
    console.log(`Step 2: Found ${feedsDue.length} feeds due for sync`);
    
    if (feedsDue.length === 0) {
      console.log("No feeds due for sync at this time");
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        results
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Step 3: Import sync services
    console.log("Step 3: Importing sync services...");
    const { syncFeedsWithIntegration } = await import("../../server/feed-sync-integration");
    const { calculateNextSyncAt, getSyncIntervalHours } = await import("../../server/feed-scheduler");
    console.log("Step 3: Sync services imported");
    
    // Step 4: Sync feeds in batches
    console.log("Step 4: Starting feed synchronization...");
    const batchSize = 5;
    
    for (let i = 0; i < feedsDue.length; i += batchSize) {
      const batch = feedsDue.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.map(f => f.name).join(', ')}`);
      
      try {
        const batchStartTime = Date.now();
        const syncResult = await syncFeedsWithIntegration(storage as any, batch, {
          maxArticles: 50,
          respectEtag: true,
          timeout: 30000 // 30 second timeout per feed
        });
        
        results.feedsSynced += syncResult.results.length;
        
        // Process each result
        for (let j = 0; j < syncResult.results.length; j++) {
          const result = syncResult.results[j];
          const feed = batch[j];
          const feedDuration = Date.now() - batchStartTime;
          
          if (result.success) {
            results.feedsSucceeded++;
            results.articlesFound += result.articlesFound || 0;
            results.articlesNew += result.articlesNew || 0;
            
            // Update next sync time based on priority
            const priority = (feed.sync_priority as 'high' | 'medium' | 'low') || 'medium';
            const nextSyncAt = calculateNextSyncAt(priority, new Date());
            const syncIntervalHours = getSyncIntervalHours(priority);
            
            await storage.updateFeedSchedule(feed.id, {
              next_sync_at: nextSyncAt,
              sync_interval_hours: syncIntervalHours,
              last_fetched_at: new Date()
            });
            
            results.syncDetails.push({
              feedId: feed.id,
              feedName: feed.name,
              success: true,
              articlesNew: result.articlesNew || 0,
              duration: feedDuration
            });
            
            console.log(`✅ ${feed.name}: ${result.articlesNew || 0} new articles, next sync: ${nextSyncAt.toISOString()}`);
          } else {
            results.feedsFailed++;
            const errorMsg = result.error || 'Unknown error';
            
            results.errors.push({
              feedId: feed.id,
              feedName: feed.name,
              error: errorMsg
            });
            
            results.syncDetails.push({
              feedId: feed.id,
              feedName: feed.name,
              success: false,
              articlesNew: 0,
              duration: feedDuration
            });
            
            console.error(`❌ ${feed.name}: ${errorMsg}`);
          }
        }
      } catch (batchError) {
        const errorMsg = batchError instanceof Error ? batchError.message : 'Unknown batch error';
        console.error(`Batch sync error: ${errorMsg}`);
        
        // Mark all feeds in batch as failed
        for (const feed of batch) {
          results.feedsFailed++;
          results.errors.push({
            feedId: feed.id,
            feedName: feed.name,
            error: errorMsg
          });
        }
      }
      
      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < feedsDue.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`\n📊 Feed Sync Summary:`);
    console.log(`   Feeds checked: ${results.feedsChecked}`);
    console.log(`   Feeds synced: ${results.feedsSynced}`);
    console.log(`   Succeeded: ${results.feedsSucceeded}`);
    console.log(`   Failed: ${results.feedsFailed}`);
    console.log(`   New articles: ${results.articlesNew}`);
    console.log(`   Duration: ${totalDuration}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      results
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error("Feed Sync Scheduler error:", error);
    
    return new Response(JSON.stringify({
      success: false,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      results
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Schedule configuration - runs every 15 minutes
// This allows high-priority feeds (hourly) to be checked 4 times per hour
export const config: Config = {
  schedule: "*/15 * * * *"
};
