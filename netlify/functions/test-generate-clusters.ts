import type { Handler } from "@netlify/functions";

/**
 * Diagnostic endpoint to test cluster generation
 * Call: GET /.netlify/functions/test-generate-clusters
 */
export const handler: Handler = async () => {
  console.log("🧪 Test generate clusters triggered at", new Date().toISOString());
  
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: {}
  };
  
  try {
    // Step 1: Import modules
    console.log("Step 1: Importing modules...");
    const { getStorage } = await import("../../server/storage");
    const { createClusteringServiceManager, isClusteringServiceAvailable } = await import("../../server/clustering-service");
    results.steps.import = { success: true };
    
    // Step 2: Check availability
    console.log("Step 2: Checking availability...");
    const available = isClusteringServiceAvailable();
    results.steps.availability = { success: available };
    
    if (!available) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...results, error: "Anthropic not configured" }, null, 2)
      };
    }
    
    // Step 3: Get storage
    console.log("Step 3: Getting storage...");
    const storage = await getStorage();
    results.steps.storage = { success: true };
    
    // Step 4: Test getArticlesWithEmbeddings directly
    console.log("Step 4: Testing getArticlesWithEmbeddings...");
    const articles = await storage.getArticlesWithEmbeddings(undefined, undefined, 168);
    results.steps.articlesQuery = {
      success: true,
      count: articles.length,
      sample: articles.slice(0, 3).map(a => ({
        id: a.id,
        title: a.title.substring(0, 50),
        feedName: a.feedName,
        hasEmbedding: a.embedding && a.embedding.length > 0
      }))
    };
    
    // Step 5: Create clustering manager
    console.log("Step 5: Creating clustering manager...");
    const clusteringManager = createClusteringServiceManager(storage as any);
    results.steps.manager = { success: true };
    
    // Step 6: Generate clusters
    console.log("Step 6: Generating clusters...");
    const clusterResult = await clusteringManager.generateClusters(undefined, undefined, 168);
    results.steps.clustering = {
      success: true,
      clustersCreated: clusterResult.clustersCreated,
      articlesProcessed: clusterResult.articlesProcessed,
      processingTimeMs: clusterResult.processingTimeMs,
      clusters: clusterResult.clusters.map(c => ({
        topic: c.topic,
        articleCount: c.articleCount,
        sources: c.sources
      }))
    };
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(results, null, 2)
    };
    
  } catch (error) {
    console.error("Error:", error);
    results.error = error instanceof Error ? error.message : "Unknown error";
    results.stack = error instanceof Error ? error.stack?.split("\n").slice(0, 10) : undefined;
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(results, null, 2)
    };
  }
};
