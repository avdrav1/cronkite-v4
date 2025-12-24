import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

/**
 * Diagnostic endpoint to test clustering functionality
 * Call: GET /.netlify/functions/test-clustering
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log("🧪 Test clustering triggered at", new Date().toISOString());
  
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    },
    tests: {}
  };
  
  try {
    // Test 1: Check if we can import the modules
    console.log("📦 Testing module imports...");
    const { getStorage } = await import("../../server/storage");
    const { clusterArticles, isClusteringAvailable } = await import("../../server/ai-summary");
    results.tests.moduleImport = { success: true };
    
    // Test 2: Check clustering availability
    console.log("🔍 Checking clustering availability...");
    const clusteringAvailable = isClusteringAvailable();
    results.tests.clusteringAvailable = { 
      success: clusteringAvailable,
      message: clusteringAvailable ? "Anthropic API key is configured" : "Anthropic API key is NOT configured"
    };
    
    // Test 3: Get storage and fetch articles with embeddings directly
    console.log("📊 Fetching articles with embeddings from database...");
    const storage = await getStorage();
    
    // Get articles with embeddings (no userId filter to get all articles)
    const articlesWithEmbeddings = await storage.getArticlesWithEmbeddings(
      undefined, // no userId - get all
      undefined, // no feedIds filter
      168 // 7 days back
    );
    
    console.log(`📊 Found ${articlesWithEmbeddings.length} articles with embeddings`);
    
    // Convert to the format expected by clusterArticles
    const sampleArticles = articlesWithEmbeddings.slice(0, 50).map(a => ({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt || '',
      source: a.feedName,
      published_at: a.publishedAt?.toISOString()
    }));
    
    results.tests.articleFetch = {
      success: sampleArticles.length > 0,
      articleCount: articlesWithEmbeddings.length,
      sampleCount: sampleArticles.length,
      sampleTitles: sampleArticles.slice(0, 3).map(a => a.title)
    };
    
    // Test 4: Try clustering if we have enough articles
    if (sampleArticles.length >= 3 && clusteringAvailable) {
      console.log("🤖 Testing text-based clustering...");
      try {
        const clusters = await clusterArticles(sampleArticles);
        results.tests.clustering = {
          success: true,
          clustersCreated: clusters.length,
          clusters: clusters.map(c => ({
            topic: c.topic,
            articleCount: c.articleCount,
            sources: c.sources
          }))
        };
      } catch (clusterError) {
        results.tests.clustering = {
          success: false,
          error: clusterError instanceof Error ? clusterError.message : 'Unknown error'
        };
      }
    } else {
      results.tests.clustering = {
        success: false,
        skipped: true,
        reason: sampleArticles.length < 3 
          ? `Not enough articles (${sampleArticles.length})` 
          : "Clustering not available (no API key)"
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(results, null, 2)
    };
    
  } catch (error) {
    console.error("❌ Test error:", error);
    results.error = error instanceof Error ? error.message : 'Unknown error';
    results.stack = error instanceof Error ? error.stack : undefined;
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(results, null, 2)
    };
  }
};
