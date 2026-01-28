import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function for Article Cleanup
 * Implements Requirements: 4.1, 4.5
 * 
 * Runs daily at 2 AM to clean up old articles across all users:
 * - Applies per-feed article limits (default 100 articles per feed)
 * - Removes unread articles older than age threshold (default 30 days)
 * - Preserves starred, read, and commented articles
 * - Processes all active users with auto-cleanup enabled
 * 
 * This function is triggered by Netlify's scheduled function feature
 * and is compatible with serverless environments.
 */

export default async function handler() {
  const startTime = Date.now();
  console.log("🧹 Article Cleanup Scheduler triggered at", new Date().toISOString());
  
  try {
    // Step 1: Import cleanup scheduler
    console.log("Step 1: Importing cleanup scheduler...");
    const { cleanupScheduler } = await import("../../server/cleanup-scheduler");
    console.log("Step 1: Cleanup scheduler imported successfully");
    
    // Step 2: Run scheduled cleanup
    console.log("Step 2: Running scheduled cleanup...");
    const result = await cleanupScheduler.runScheduledCleanup();
    console.log("Step 2: Scheduled cleanup completed");
    
    // Step 3: Calculate total duration
    const totalDuration = Date.now() - startTime;
    
    // Step 4: Log summary
    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   Users processed: ${result.usersProcessed}`);
    console.log(`   Articles deleted: ${result.totalDeleted}`);
    console.log(`   Cleanup duration: ${result.durationMs}ms`);
    console.log(`   Total duration: ${totalDuration}ms`);
    
    // Step 5: Return success response
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      results: {
        usersProcessed: result.usersProcessed,
        articlesDeleted: result.totalDeleted,
        cleanupDurationMs: result.durationMs
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    // Calculate duration even on error
    const totalDuration = Date.now() - startTime;
    
    // Log error details
    console.error("❌ Article Cleanup Scheduler error:", error);
    
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error stack: ${error.stack}`);
    }
    
    // Return error response with 500 status
    return new Response(JSON.stringify({
      success: false,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Schedule configuration - runs daily at 2 AM
// Cron format: minute hour day month weekday
// "0 2 * * *" = At 02:00 (2 AM) every day
export const config: Config = {
  schedule: "0 2 * * *"
};
