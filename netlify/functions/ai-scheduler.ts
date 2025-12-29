import type { Config } from "@netlify/functions";

// This is a Netlify Scheduled Function that runs the AI background jobs
// It replaces the in-process scheduler that can't run in serverless
// Uses the modern Netlify Functions format with config export

export default async function handler() {
  console.log("🤖 AI Scheduler triggered at", new Date().toISOString());
  
  const results = {
    embeddings: { processed: 0, succeeded: 0, failed: 0 },
    clusters: { created: 0, articlesProcessed: 0 },
    errors: [] as string[]
  };
  
  try {
    // Step 1: Import storage
    console.log("Step 1: Importing storage...");
    const { getStorage } = await import("../../server/storage");
    console.log("Step 1: Storage imported");
    
    // Step 2: Get storage instance
    console.log("Step 2: Getting storage instance...");
    const storage = await getStorage();
    console.log("Step 2: Storage instance obtained");
    
    // Step 3: Import embedding service
    console.log("Step 3: Importing embedding service...");
    const { isEmbeddingServiceAvailable, createEmbeddingQueueManager } = await import("../../server/embedding-service");
    console.log("Step 3: Embedding service imported");
    
    // Step 4: Check embedding availability
    console.log("Step 4: Checking embedding availability...");
    const embeddingAvailable = isEmbeddingServiceAvailable();
    console.log("Step 4: OpenAI available:", embeddingAvailable);
    
    // Step 5: Process embedding queue if available
    if (embeddingAvailable) {
      console.log("Step 5: Creating embedding manager...");
      const manager = createEmbeddingQueueManager(storage as any);
      console.log("Step 5: Manager created");
      
      console.log("Step 5b: Processing embedding queue...");
      const embeddingResult = await manager.processQueue(50);
      console.log("Step 5b: Queue processed:", embeddingResult);
      
      results.embeddings = {
        processed: embeddingResult.processed,
        succeeded: embeddingResult.succeeded,
        failed: embeddingResult.failed
      };
      
      console.log("Embeddings: " + embeddingResult.succeeded + " succeeded, " + embeddingResult.failed + " failed");
    } else {
      console.log("Step 5: OpenAI not configured - skipping embeddings");
    }
    
    // Step 6: Run clustering with smart scheduling
    console.log("Step 6: Importing clustering service...");
    const { createClusteringServiceManager, isClusteringServiceAvailable } = await import("../../server/clustering-service");
    
    const clusteringAvailable = isClusteringServiceAvailable();
    console.log("Step 6: Anthropic available:", clusteringAvailable);
    
    if (clusteringAvailable) {
      console.log("Step 6b: Creating clustering manager...");
      const clusteringManager = createClusteringServiceManager(storage as any);
      
      try {
        // Import the smart clustering logic
        console.log("Step 6c: Checking if clustering should run...");
        
        // Simple time-based check for clustering
        const lastClusteringQuery = await storage.query(`
          SELECT created_at 
          FROM clusters 
          ORDER BY created_at DESC 
          LIMIT 1
        `);
        
        const lastClustering = lastClusteringQuery.rows[0]?.created_at;
        const hoursSinceLastClustering = lastClustering 
          ? (Date.now() - new Date(lastClustering).getTime()) / (1000 * 60 * 60)
          : 999; // Force run if no clusters exist
        
        // Check for new articles with embeddings in the last 4 hours
        const newArticlesQuery = await storage.query(`
          SELECT COUNT(*) as count
          FROM articles 
          WHERE embedding IS NOT NULL 
          AND published_at > NOW() - INTERVAL '4 hours'
        `);
        
        const newArticleCount = parseInt(newArticlesQuery.rows[0]?.count || '0');
        const minNewArticles = 10;
        const minHoursBetween = 4;
        
        const shouldRun = (!lastClustering) || 
                         (hoursSinceLastClustering >= 24) || // Force run after 24h
                         (hoursSinceLastClustering >= minHoursBetween && newArticleCount >= minNewArticles);
        
        if (shouldRun) {
          const reason = !lastClustering ? 'First clustering run' :
                        hoursSinceLastClustering >= 24 ? `Fallback: ${hoursSinceLastClustering.toFixed(1)}h since last run` :
                        `${newArticleCount} new articles with embeddings (min: ${minNewArticles})`;
          
          console.log(`Step 6d: Running clustering - ${reason}...`);
          const clusterResult = await clusteringManager.generateClusters(
            undefined, // no userId - generate for all articles
            undefined, // no feedIds filter
            168 // 7 days back
          );
          
          results.clusters = {
            created: clusterResult.clustersCreated,
            articlesProcessed: clusterResult.articlesProcessed
          };
          
          console.log("Clusters: " + clusterResult.clustersCreated + " created from " + clusterResult.articlesProcessed + " articles");
        } else {
          const reason = hoursSinceLastClustering < minHoursBetween ? 
            `Only ${hoursSinceLastClustering.toFixed(1)}h since last run (min: ${minHoursBetween}h)` :
            `Only ${newArticleCount} new articles (min: ${minNewArticles})`;
          
          console.log(`Step 6d: Skipping clustering - ${reason}`);
          results.clusters = { created: 0, articlesProcessed: 0 };
        }
      } catch (clusterError) {
        const msg = clusterError instanceof Error ? clusterError.message : "Unknown error";
        console.error("Clustering error:", msg);
        results.errors.push("Clustering: " + msg);
      }
    } else {
      console.log("Step 6: Anthropic not configured - skipping clustering");
    }
    
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      results
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("AI Scheduler error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      results
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Schedule configuration - runs every 15 minutes (reduced from 5 minutes)
export const config: Config = {
  schedule: "*/15 * * * *"
};
