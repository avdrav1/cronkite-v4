/**
 * Cleanup Scheduler
 * Implements Requirements: 4.1, 4.2, 4.4
 * 
 * This scheduler handles:
 * - Scheduled background cleanup for all users
 * - Concurrent execution prevention
 * - Progress logging and monitoring
 * - Compatibility with serverless environments (Netlify Functions)
 */

import { ArticleCleanupService } from "./article-cleanup-service";

/**
 * Result of a scheduled cleanup run
 */
export interface ScheduledCleanupResult {
  usersProcessed: number;
  totalDeleted: number;
  durationMs: number;
}

/**
 * Cleanup Scheduler
 * Orchestrates scheduled cleanup operations across all users
 * 
 * This scheduler is designed to be called by:
 * - Netlify scheduled functions (serverless)
 * - Manual admin triggers
 * - Background cron jobs
 * 
 * Key features:
 * - Prevents concurrent execution with isRunning flag
 * - Logs start, progress, and completion
 * - Returns detailed results for monitoring
 * - Handles errors gracefully
 */
export class CleanupScheduler {
  private cleanupService: ArticleCleanupService;
  private isRunning: boolean = false;
  
  constructor(cleanupService: ArticleCleanupService) {
    this.cleanupService = cleanupService;
  }
  
  /**
   * Run scheduled cleanup for all users
   * Requirements: 4.1, 4.2, 4.4 - Daily cleanup job processing all users
   * 
   * This method orchestrates the entire scheduled cleanup process:
   * 
   * 1. Check if cleanup is already running (prevent concurrent execution)
   * 2. Log cleanup start
   * 3. Call cleanupService.cleanupAllUsers()
   * 4. Log progress and completion
   * 5. Return detailed results
   * 
   * Concurrent execution prevention:
   * - Uses isRunning flag to prevent overlapping executions
   * - If already running, returns immediately with zero results
   * - Flag is always cleared in finally block to prevent deadlock
   * 
   * Error handling:
   * - Errors are logged and re-thrown
   * - isRunning flag is cleared even on error
   * - Partial results are not returned on error
   * 
   * Serverless compatibility:
   * - Stateless execution (no persistent state)
   * - Completes within function timeout (15 minutes for Netlify)
   * - Returns results for monitoring/logging
   * 
   * @returns Promise<ScheduledCleanupResult> - Results with users processed, articles deleted, and duration
   * @throws Error if cleanup fails
   */
  async runScheduledCleanup(): Promise<ScheduledCleanupResult> {
    // Step 1: Check if cleanup is already running
    if (this.isRunning) {
      console.log('⏭️  Cleanup already running, skipping');
      return { usersProcessed: 0, totalDeleted: 0, durationMs: 0 };
    }
    
    // Set running flag
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      // Step 2: Log cleanup start
      console.log('🧹 Starting scheduled cleanup for all users');
      console.log(`⏰ Start time: ${new Date().toISOString()}`);
      
      // Step 3: Call cleanupService.cleanupAllUsers()
      const result = await this.cleanupService.cleanupAllUsers();
      
      // Step 4: Calculate duration
      const durationMs = Date.now() - startTime;
      
      // Step 5: Log progress and completion
      console.log(`✅ Scheduled cleanup complete`);
      console.log(`   Users processed: ${result.usersProcessed}`);
      console.log(`   Articles deleted: ${result.totalDeleted}`);
      console.log(`   Duration: ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`);
      console.log(`⏰ End time: ${new Date().toISOString()}`);
      
      // Step 6: Return detailed results
      return {
        usersProcessed: result.usersProcessed,
        totalDeleted: result.totalDeleted,
        durationMs,
      };
      
    } catch (error) {
      // Log error and re-throw
      console.error('❌ Scheduled cleanup failed:', error);
      
      // Include error details in log
      if (error instanceof Error) {
        console.error(`   Error message: ${error.message}`);
        console.error(`   Error stack: ${error.stack}`);
      }
      
      throw error;
      
    } finally {
      // Always clear running flag, even on error
      this.isRunning = false;
      
      console.log('🔓 Cleanup scheduler released');
    }
  }
}

// Export singleton instance
// This singleton is used by Netlify Functions and manual triggers
import { articleCleanupService } from "./article-cleanup-service";

export const cleanupScheduler = new CleanupScheduler(articleCleanupService);
