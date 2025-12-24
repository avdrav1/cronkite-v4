import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log("🧪 Test Embedding function triggered at", new Date().toISOString());
  
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    },
    tests: {} as Record<string, any>,
  };
  
  try {
    // Test 1: Import storage
    console.log("📦 Testing storage import...");
    const { getStorage } = await import("../../server/storage");
    results.tests.storageImport = { success: true };
    
    // Test 2: Get storage instance
    console.log("📦 Getting storage instance...");
    const storage = await getStorage();
    results.tests.storageInstance = { success: true };
    
    // Test 3: Check embedding queue
    console.log("📊 Checking embedding queue...");
    try {
      const queueItems = await storage.getEmbeddingQueueItems(5, 'pending');
      results.tests.embeddingQueue = {
        success: true,
        itemCount: queueItems.length,
        sampleItems: queueItems.slice(0, 2).map(item => ({
          id: item.id,
          article_id: item.article_id,
          status: item.status,
        })),
      };
    } catch (error) {
      results.tests.embeddingQueue = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    
    // Test 4: Check embedding service availability
    console.log("🔧 Checking embedding service...");
    try {
      const { isEmbeddingServiceAvailable, createEmbeddingQueueManager } = await import("../../server/embedding-service");
      results.tests.embeddingService = {
        success: true,
        available: isEmbeddingServiceAvailable(),
      };
      
      // Test 5: Actually process one embedding
      if (isEmbeddingServiceAvailable()) {
        console.log("🔄 Processing one embedding...");
        try {
          const manager = createEmbeddingQueueManager(storage as any);
          const processResult = await manager.processQueue(1);
          results.tests.embeddingProcess = {
            success: true,
            processed: processResult.processed,
            succeeded: processResult.succeeded,
            failed: processResult.failed,
            remainingInQueue: processResult.remainingInQueue,
          };
        } catch (error) {
          results.tests.embeddingProcess = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
          };
        }
      } else {
        results.tests.embeddingProcess = {
          skipped: true,
          reason: 'Embedding service not available',
        };
      }
    } catch (error) {
      results.tests.embeddingService = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    
  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error';
    results.stack = error instanceof Error ? error.stack : undefined;
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(results, null, 2),
  };
};
