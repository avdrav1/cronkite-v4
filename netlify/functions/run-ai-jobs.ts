import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

/**
 * On-demand AI Jobs Runner
 * 
 * This function can be triggered manually via HTTP to run AI jobs:
 * - Embedding generation for articles
 * - Cluster generation for trending topics
 * 
 * Call via: GET /.netlify/functions/run-ai-jobs
 * Or with a secret: GET /.netlify/functions/run-ai-jobs?secret=YOUR_SECRET
 */

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log("🤖 AI Jobs Runner triggered at", new Date().toISOString());
  
  // Optional: Add secret protection
  const expectedSecret = process.env.AI_JOBS_SECRET;
  if (expectedSecret) {
    const providedSecret = event.queryStringParameters?.secret;
    if (providedSecret !== expectedSecret) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }
  }
  
  const results = {
    embeddings: { processed: 0, succeeded: 0, failed: 0 },
    clusters: { created: 0, articlesProcessed: 0 },
    errors: [] as string[],
    steps: [] as string[]
  };
  
  try {
    // Step 1: Import storage
    results.steps.push("Importing storage...");
    const { getStorage } = await import("../../server/storage");
    results.steps.push("Storage imported");
    
    // Step 2: Get storage instance
    results.steps.push("Getting storage instance...");
    const storage = await getStorage();
    results.steps.push("Storage instance obtained");
    
    // Step 3: Process embeddings
    results.steps.push("Importing embedding service...");
    const { isEmbeddingServiceAvailable, createEmbeddingQueueManager } = await import("../../server/embedding-service");
    
    const embeddingAvailable = isEmbeddingServiceAvailable();
    results.steps.push(`OpenAI available: ${embeddingAvailable}`);
    
    if (embeddingAvailable) {
      results.steps.push("Processing embedding queue...");
      const manager = createEmbeddingQueueManager(storage as any);
      
      try {
        const embeddingResult = await manager.processQueue(50);
        results.embeddings = {
          processed: embeddingResult.processed,
          succeeded: embeddingResult.succeeded,
          failed: embeddingResult.failed
        };
        results.steps.push(`Embeddings: ${embeddingResult.succeeded} succeeded, ${embeddingResult.failed} failed`);
      } catch (embError) {
        const msg = embError instanceof Error ? embError.message : "Unknown error";
        results.errors.push(`Embeddings: ${msg}`);
        results.steps.push(`Embedding error: ${msg}`);
      }
    } else {
      results.steps.push("OpenAI not configured - skipping embeddings");
    }
    
    // Step 4: Generate clusters
    results.steps.push("Importing clustering service...");
    const { createClusteringServiceManager, isClusteringServiceAvailable } = await import("../../server/clustering-service");
    
    const clusteringAvailable = isClusteringServiceAvailable();
    results.steps.push(`Anthropic available: ${clusteringAvailable}`);
    
    if (clusteringAvailable) {
      results.steps.push("Generating clusters...");
      const clusteringManager = createClusteringServiceManager(storage as any);
      
      try {
        const clusterResult = await clusteringManager.generateClusters(
          undefined, // no userId - generate for all articles
          undefined, // no feedIds filter
          168 // 7 days back
        );
        
        results.clusters = {
          created: clusterResult.clustersCreated,
          articlesProcessed: clusterResult.articlesProcessed
        };
        results.steps.push(`Clusters: ${clusterResult.clustersCreated} created from ${clusterResult.articlesProcessed} articles`);
      } catch (clusterError) {
        const msg = clusterError instanceof Error ? clusterError.message : "Unknown error";
        results.errors.push(`Clustering: ${msg}`);
        results.steps.push(`Clustering error: ${msg}`);
      }
    } else {
      results.steps.push("Anthropic not configured - skipping clustering");
    }
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results
      }, null, 2)
    };
    
  } catch (error) {
    console.error("AI Jobs Runner error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        results
      }, null, 2)
    };
  }
};

export { handler };
