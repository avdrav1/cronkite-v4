import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

/**
 * Unified Diagnostic Endpoint
 *
 * Provides health checks and diagnostics for all services.
 *
 * Usage:
 *   GET /.netlify/functions/diagnostic           - Full diagnostic report
 *   GET /.netlify/functions/diagnostic?test=env  - Environment check only
 *   GET /.netlify/functions/diagnostic?test=storage - Storage connection test
 *   GET /.netlify/functions/diagnostic?test=embedding - Embedding service test
 *   GET /.netlify/functions/diagnostic?test=clustering - Clustering service test
 */

interface DiagnosticResult {
  timestamp: string;
  environment?: {
    NODE_ENV: string | undefined;
    hasOpenAIKey: boolean;
    hasAnthropicKey: boolean;
    hasSupabaseUrl: boolean;
    hasDatabaseUrl: boolean;
  };
  tests: {
    storage?: { success: boolean; error?: string };
    embedding?: {
      success: boolean;
      available: boolean;
      queueSize?: number;
      sampleItems?: Array<{ id: string; article_id: string; status: string }>;
      processResult?: { processed: number; succeeded: number; failed: number };
      error?: string;
    };
    clustering?: {
      success: boolean;
      available: boolean;
      articlesWithEmbeddings?: number;
      sampleTitles?: string[];
      clusterResult?: { clustersCreated: number; articlesProcessed: number };
      error?: string;
    };
  };
  error?: string;
  stack?: string;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();
  const testParam = event.queryStringParameters?.test;

  console.log(`Diagnostic triggered at ${new Date().toISOString()}, test=${testParam || 'all'}`);

  const results: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Determine which tests to run
  const runAll = !testParam;
  const runEnv = runAll || testParam === 'env';
  const runStorage = runAll || testParam === 'storage';
  const runEmbedding = runAll || testParam === 'embedding';
  const runClustering = runAll || testParam === 'clustering';

  try {
    // Environment check
    if (runEnv) {
      results.environment = {
        NODE_ENV: process.env.NODE_ENV,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      };
    }

    // Storage test
    let storage: any = null;
    if (runStorage || runEmbedding || runClustering) {
      try {
        const { getStorage } = await import("../../server/storage");
        storage = await getStorage();
        results.tests.storage = { success: true };
      } catch (error) {
        results.tests.storage = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Embedding test
    if (runEmbedding && storage) {
      try {
        const { isEmbeddingServiceAvailable, createEmbeddingQueueManager } = await import("../../server/embedding-service");
        const available = isEmbeddingServiceAvailable();

        // Get queue status
        const queueItems = await storage.getEmbeddingQueueItems(10, 'pending');

        results.tests.embedding = {
          success: true,
          available,
          queueSize: queueItems.length,
          sampleItems: queueItems.slice(0, 3).map((item: any) => ({
            id: item.id,
            article_id: item.article_id,
            status: item.status,
          })),
        };

        // Optionally process one embedding to test the full pipeline
        if (available && queueItems.length > 0) {
          try {
            const manager = createEmbeddingQueueManager(storage);
            const processResult = await manager.processQueue(1);
            results.tests.embedding.processResult = {
              processed: processResult.processed,
              succeeded: processResult.succeeded,
              failed: processResult.failed,
            };
          } catch (processError) {
            results.tests.embedding.error = processError instanceof Error ? processError.message : 'Process error';
          }
        }
      } catch (error) {
        results.tests.embedding = {
          success: false,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Clustering test
    if (runClustering && storage) {
      try {
        const { createClusteringServiceManager, isClusteringServiceAvailable } = await import("../../server/clustering-service");
        const available = isClusteringServiceAvailable();

        // Get articles with embeddings
        const articlesWithEmbeddings = await storage.getArticlesWithEmbeddings(
          undefined,
          undefined,
          168 // 7 days
        );

        results.tests.clustering = {
          success: true,
          available,
          articlesWithEmbeddings: articlesWithEmbeddings.length,
          sampleTitles: articlesWithEmbeddings.slice(0, 3).map((a: any) => a.title),
        };

        // Optionally run clustering if available and we have enough articles
        if (available && articlesWithEmbeddings.length >= 5) {
          try {
            const clusteringManager = createClusteringServiceManager(storage);
            const clusterResult = await clusteringManager.generateClusters(undefined, undefined, 168);
            results.tests.clustering.clusterResult = {
              clustersCreated: clusterResult.clustersCreated,
              articlesProcessed: clusterResult.articlesProcessed,
            };
          } catch (clusterError) {
            results.tests.clustering.error = clusterError instanceof Error ? clusterError.message : 'Cluster error';
          }
        }
      } catch (error) {
        results.tests.clustering = {
          success: false,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Diagnostic completed in ${duration}ms`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...results, durationMs: duration }, null, 2)
    };

  } catch (error) {
    console.error("Diagnostic error:", error);
    results.error = error instanceof Error ? error.message : 'Unknown error';
    results.stack = error instanceof Error ? error.stack : undefined;

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(results, null, 2)
    };
  }
};
