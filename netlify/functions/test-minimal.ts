import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log("🧪 Minimal test function triggered");
  
  try {
    // Step 1: Basic response
    console.log("Step 1: Basic response works");
    
    // Step 2: Import storage
    console.log("Step 2: Importing storage...");
    const { getStorage } = await import("../../server/storage");
    console.log("Step 2: Storage imported");
    
    // Step 3: Get storage instance
    console.log("Step 3: Getting storage instance...");
    const storage = await getStorage();
    console.log("Step 3: Storage instance obtained");
    
    // Step 4: Import embedding service
    console.log("Step 4: Importing embedding service...");
    const { isEmbeddingServiceAvailable, createEmbeddingQueueManager } = await import("../../server/embedding-service");
    console.log("Step 4: Embedding service imported");
    
    // Step 5: Check availability
    console.log("Step 5: Checking availability...");
    const available = isEmbeddingServiceAvailable();
    console.log("Step 5: Available:", available);
    
    // Step 6: Create manager
    console.log("Step 6: Creating manager...");
    const manager = createEmbeddingQueueManager(storage as any);
    console.log("Step 6: Manager created");
    
    // Step 7: Process queue
    console.log("Step 7: Processing queue...");
    const result = await manager.processQueue(5);
    console.log("Step 7: Queue processed:", result);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        available,
        result
      })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 10) : undefined
      })
    };
  }
};
