/**
 * AI Rate Limiter Service
 * 
 * Manages API usage tracking, rate limiting, and cost management for AI services.
 * Implements Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4
 */

import type { 
  AIOperation, 
  AIProvider, 
  AIUsageLog, 
  AIUsageDaily,
  InsertAIUsageLog,
  InsertAIUsageDaily 
} from '@shared/schema';
import { DEFAULT_AI_LIMITS } from '@shared/schema';

// ============================================================================
// Constants
// ============================================================================

// Cost per 1000 tokens (approximate, as of 2024)
export const TOKEN_COSTS: Record<AIProvider, Record<string, { input: number; output: number }>> = {
  openai: {
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'text-embedding-3-large': { input: 0.00013, output: 0 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  },
  anthropic: {
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  },
};

// Retry configuration (Requirements: 8.7, 9.1, 9.2)
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

// Default limits (Requirements: 8.2, 8.3)
export const DEFAULT_DAILY_LIMITS = {
  embedding: DEFAULT_AI_LIMITS.embeddingsPerDay,   // 500
  clustering: DEFAULT_AI_LIMITS.clusteringsPerDay, // 10
  search: DEFAULT_AI_LIMITS.searchesPerDay,        // 100
  summary: 50,
};

// ============================================================================
// Types
// ============================================================================

export interface APIUsage {
  operation: AIOperation;
  provider: AIProvider;
  model?: string;
  tokenCount: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost: number;
  success: boolean;
  errorMessage?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  daily: {
    embeddings: number;
    clusterings: number;
    searches: number;
    summaries: number;
    totalTokens: number;
    openaiTokens: number;
    anthropicTokens: number;
    estimatedCost: number;
  };
  limits: {
    embeddingsPerDay: number;
    clusteringsPerDay: number;
    searchesPerDay: number;
  };
  remaining: {
    embeddings: number;
    clusterings: number;
    searches: number;
  };
  resetAt: Date;
}

export interface RateLimitCheck {
  allowed: boolean;
  currentCount: number;
  dailyLimit: number;
  remaining: number;
  reason?: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

// Dead letter queue item
export interface DeadLetterItem {
  id: string;
  operation: AIOperation;
  provider: AIProvider;
  userId?: string;
  payload: unknown;
  errorMessage: string;
  attempts: number;
  createdAt: Date;
  lastAttemptAt: Date;
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Storage interface for rate limiter operations
 */
export interface RateLimiterStorage {
  // Usage log operations
  recordUsageLog(usage: InsertAIUsageLog): Promise<AIUsageLog>;
  
  // Daily usage operations
  getDailyUsage(userId: string, date: string): Promise<AIUsageDaily | undefined>;
  upsertDailyUsage(usage: InsertAIUsageDaily): Promise<AIUsageDaily>;
  incrementDailyUsage(
    userId: string, 
    date: string, 
    operation: AIOperation, 
    tokenCount: number,
    provider: AIProvider,
    cost: number
  ): Promise<AIUsageDaily>;
  
  // Usage statistics
  getUsageStats(userId: string, days?: number): Promise<AIUsageDaily[]>;
  
  // Dead letter queue
  addToDeadLetterQueue(item: Omit<DeadLetterItem, 'id' | 'createdAt'>): Promise<void>;
  getDeadLetterItems(limit?: number): Promise<DeadLetterItem[]>;
  removeFromDeadLetterQueue(id: string): Promise<void>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate estimated cost for API usage
 * Requirements: 8.5
 */
export function calculateCost(
  provider: AIProvider,
  model: string,
  inputTokens: number,
  outputTokens: number = 0
): number {
  const providerCosts = TOKEN_COSTS[provider];
  const modelCosts = providerCosts?.[model];
  
  if (!modelCosts) {
    // Default fallback costs
    return (inputTokens + outputTokens) * 0.00001;
  }
  
  return (inputTokens * modelCosts.input / 1000) + (outputTokens * modelCosts.output / 1000);
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the reset time (midnight UTC of next day)
 */
export function getResetTime(): Date {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }
    // Server errors
    if (message.includes('500') || message.includes('502') || 
        message.includes('503') || message.includes('504')) {
      return true;
    }
    // Network errors
    if (message.includes('network') || message.includes('timeout') ||
        message.includes('econnreset') || message.includes('econnrefused')) {
      return true;
    }
  }
  return false;
}


// ============================================================================
// AI Rate Limiter Class
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4
// ============================================================================

/**
 * AI Rate Limiter
 * Manages API usage tracking, rate limiting, and cost management
 */
export class AIRateLimiter {
  private storage: RateLimiterStorage;
  
  constructor(storage: RateLimiterStorage) {
    this.storage = storage;
  }
  
  // ==========================================================================
  // Usage Tracking (Requirements: 8.1, 8.5)
  // ==========================================================================
  
  /**
   * Record API usage
   * Requirements: 8.1, 8.5 - Track API calls with token counts and costs
   */
  async recordUsage(userId: string | undefined, usage: APIUsage): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Record detailed usage log
      await this.storage.recordUsageLog({
        user_id: userId || null,
        operation: usage.operation,
        provider: usage.provider,
        model: usage.model || null,
        token_count: usage.tokenCount,
        input_tokens: usage.inputTokens || null,
        output_tokens: usage.outputTokens || null,
        estimated_cost: usage.estimatedCost.toFixed(6),
        success: usage.success,
        error_message: usage.errorMessage || null,
        latency_ms: usage.latencyMs || null,
        request_metadata: usage.metadata ? JSON.stringify(usage.metadata) : null,
      });
      
      // Update daily aggregates if user is known
      if (userId) {
        const date = getCurrentDateString();
        await this.storage.incrementDailyUsage(
          userId,
          date,
          usage.operation,
          usage.tokenCount,
          usage.provider,
          usage.estimatedCost
        );
      }
      
      console.log(`📊 Recorded ${usage.operation} usage: ${usage.tokenCount} tokens, $${usage.estimatedCost.toFixed(6)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to record usage: ${errorMessage}`);
      // Don't throw - usage tracking failure shouldn't break the main operation
    }
  }
  
  /**
   * Record successful API call
   */
  async recordSuccess(
    userId: string | undefined,
    operation: AIOperation,
    provider: AIProvider,
    model: string,
    inputTokens: number,
    outputTokens: number = 0,
    latencyMs?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const totalTokens = inputTokens + outputTokens;
    const cost = calculateCost(provider, model, inputTokens, outputTokens);
    
    await this.recordUsage(userId, {
      operation,
      provider,
      model,
      tokenCount: totalTokens,
      inputTokens,
      outputTokens,
      estimatedCost: cost,
      success: true,
      latencyMs,
      metadata,
    });
  }
  
  /**
   * Record failed API call
   */
  async recordFailure(
    userId: string | undefined,
    operation: AIOperation,
    provider: AIProvider,
    model: string,
    errorMessage: string,
    latencyMs?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.recordUsage(userId, {
      operation,
      provider,
      model,
      tokenCount: 0,
      estimatedCost: 0,
      success: false,
      errorMessage,
      latencyMs,
      metadata,
    });
  }
  
  // ==========================================================================
  // Rate Limit Checking (Requirements: 8.2, 8.3, 8.4)
  // ==========================================================================
  
  /**
   * Check if an operation is allowed based on daily limits
   * Requirements: 8.2, 8.3, 8.4
   */
  async canMakeRequest(userId: string, operation: AIOperation): Promise<RateLimitCheck> {
    const date = getCurrentDateString();
    const dailyUsage = await this.storage.getDailyUsage(userId, date);
    
    // Get limit for this operation
    const limit = this.getOperationLimit(operation, dailyUsage);
    const currentCount = this.getOperationCount(operation, dailyUsage);
    const remaining = Math.max(0, limit - currentCount);
    
    if (currentCount >= limit) {
      return {
        allowed: false,
        currentCount,
        dailyLimit: limit,
        remaining: 0,
        reason: `Daily ${operation} limit of ${limit} reached. Resets at midnight UTC.`,
      };
    }
    
    return {
      allowed: true,
      currentCount,
      dailyLimit: limit,
      remaining,
    };
  }
  
  /**
   * Get the daily limit for an operation
   */
  private getOperationLimit(operation: AIOperation, dailyUsage?: AIUsageDaily): number {
    if (dailyUsage) {
      switch (operation) {
        case 'embedding':
          return dailyUsage.embeddings_limit;
        case 'clustering':
          return dailyUsage.clusterings_limit;
        case 'search':
          return dailyUsage.searches_limit;
        default:
          return DEFAULT_DAILY_LIMITS[operation] || 100;
      }
    }
    return DEFAULT_DAILY_LIMITS[operation] || 100;
  }
  
  /**
   * Get the current count for an operation
   */
  private getOperationCount(operation: AIOperation, dailyUsage?: AIUsageDaily): number {
    if (!dailyUsage) return 0;
    
    switch (operation) {
      case 'embedding':
        return dailyUsage.embeddings_count;
      case 'clustering':
        return dailyUsage.clusterings_count;
      case 'search':
        return dailyUsage.searches_count;
      case 'summary':
        return dailyUsage.summaries_count;
      default:
        return 0;
    }
  }
  
  // ==========================================================================
  // Usage Statistics (Requirements: 8.6)
  // ==========================================================================
  
  /**
   * Get usage statistics for a user
   * Requirements: 8.6
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    const date = getCurrentDateString();
    const dailyUsage = await this.storage.getDailyUsage(userId, date);
    
    const daily = {
      embeddings: dailyUsage?.embeddings_count || 0,
      clusterings: dailyUsage?.clusterings_count || 0,
      searches: dailyUsage?.searches_count || 0,
      summaries: dailyUsage?.summaries_count || 0,
      totalTokens: dailyUsage?.total_tokens || 0,
      openaiTokens: dailyUsage?.openai_tokens || 0,
      anthropicTokens: dailyUsage?.anthropic_tokens || 0,
      estimatedCost: parseFloat(dailyUsage?.estimated_cost?.toString() || '0'),
    };
    
    const limits = {
      embeddingsPerDay: dailyUsage?.embeddings_limit || DEFAULT_DAILY_LIMITS.embedding,
      clusteringsPerDay: dailyUsage?.clusterings_limit || DEFAULT_DAILY_LIMITS.clustering,
      searchesPerDay: dailyUsage?.searches_limit || DEFAULT_DAILY_LIMITS.search,
    };
    
    const remaining = {
      embeddings: Math.max(0, limits.embeddingsPerDay - daily.embeddings),
      clusterings: Math.max(0, limits.clusteringsPerDay - daily.clusterings),
      searches: Math.max(0, limits.searchesPerDay - daily.searches),
    };
    
    return {
      daily,
      limits,
      remaining,
      resetAt: getResetTime(),
    };
  }
  
  /**
   * Get historical usage statistics
   */
  async getHistoricalUsage(userId: string, days: number = 7): Promise<AIUsageDaily[]> {
    return this.storage.getUsageStats(userId, days);
  }
}


// ============================================================================
// Exponential Backoff Retry (Requirements: 8.7, 9.1, 9.2)
// ============================================================================

/**
 * Execute a function with exponential backoff retry
 * Requirements: 8.7, 9.1, 9.2 - Retry with 1s, 2s, 4s delays, stop after 3 attempts
 * 
 * @param fn - The async function to execute
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param delays - Array of delay times in ms (default: [1000, 2000, 4000])
 * @returns RetryResult with success status and result or error
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = MAX_RETRY_ATTEMPTS,
  delays: number[] = RETRY_DELAYS
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;
  let totalDelayMs = 0;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        console.warn(`⚠️ Non-retryable error on attempt ${attempt + 1}: ${lastError.message}`);
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDelayMs,
        };
      }
      
      // If we have more attempts, wait and retry
      if (attempt < maxAttempts - 1) {
        const delay = delays[attempt] || delays[delays.length - 1];
        console.warn(`⚠️ Retryable error on attempt ${attempt + 1}/${maxAttempts}, retrying in ${delay}ms: ${lastError.message}`);
        await sleep(delay);
        totalDelayMs += delay;
      } else {
        console.error(`❌ All ${maxAttempts} attempts failed: ${lastError.message}`);
      }
    }
  }
  
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: maxAttempts,
    totalDelayMs,
  };
}

// ============================================================================
// Failure Handling (Requirements: 9.3, 9.4)
// ============================================================================

/**
 * Batch processor with failure handling
 * Requirements: 9.3, 9.4 - Continue processing on individual failures,
 * move permanently failed items to dead letter queue
 */
export class BatchProcessor<T, R> {
  private rateLimiter: AIRateLimiter;
  private operation: AIOperation;
  private provider: AIProvider;
  
  constructor(
    rateLimiter: AIRateLimiter,
    operation: AIOperation,
    provider: AIProvider
  ) {
    this.rateLimiter = rateLimiter;
    this.operation = operation;
    this.provider = provider;
  }
  
  /**
   * Process a batch of items with failure handling
   * Requirements: 9.3 - Continue processing on individual failures
   * Requirements: 9.4 - Move permanently failed items to dead letter queue
   */
  async processBatch(
    items: T[],
    processor: (item: T) => Promise<R>,
    userId?: string,
    onDeadLetter?: (item: T, error: Error) => Promise<void>
  ): Promise<{
    successful: Array<{ item: T; result: R }>;
    failed: Array<{ item: T; error: Error; attempts: number }>;
    deadLettered: Array<{ item: T; error: Error }>;
  }> {
    const successful: Array<{ item: T; result: R }> = [];
    const failed: Array<{ item: T; error: Error; attempts: number }> = [];
    const deadLettered: Array<{ item: T; error: Error }> = [];
    
    for (const item of items) {
      // Check rate limit before processing
      if (userId) {
        const limitCheck = await this.rateLimiter.canMakeRequest(userId, this.operation);
        if (!limitCheck.allowed) {
          console.warn(`⚠️ Rate limit reached for ${this.operation}, skipping remaining items`);
          // Add remaining items to failed with rate limit error
          const rateLimitError = new Error(limitCheck.reason || 'Rate limit exceeded');
          failed.push({ item, error: rateLimitError, attempts: 0 });
          continue;
        }
      }
      
      // Process with retry
      const result = await withExponentialBackoff(() => processor(item));
      
      if (result.success && result.result !== undefined) {
        successful.push({ item, result: result.result });
      } else {
        const error = result.error || new Error('Unknown error');
        
        // If all retries exhausted, move to dead letter queue
        if (result.attempts >= MAX_RETRY_ATTEMPTS) {
          deadLettered.push({ item, error });
          
          // Call dead letter handler if provided
          if (onDeadLetter) {
            try {
              await onDeadLetter(item, error);
            } catch (dlError) {
              console.error(`❌ Failed to add item to dead letter queue: ${dlError}`);
            }
          }
        } else {
          failed.push({ item, error, attempts: result.attempts });
        }
      }
    }
    
    console.log(`📊 Batch processing complete: ${successful.length} succeeded, ${failed.length} failed, ${deadLettered.length} dead-lettered`);
    
    return { successful, failed, deadLettered };
  }
}

// ============================================================================
// Dead Letter Queue Manager (Requirements: 9.4)
// ============================================================================

/**
 * Dead Letter Queue Manager
 * Requirements: 9.4 - Maintain a dead letter queue for permanently failed operations
 */
export class DeadLetterQueueManager {
  private storage: RateLimiterStorage;
  
  constructor(storage: RateLimiterStorage) {
    this.storage = storage;
  }
  
  /**
   * Add an item to the dead letter queue
   */
  async addToQueue(
    operation: AIOperation,
    provider: AIProvider,
    payload: unknown,
    errorMessage: string,
    attempts: number,
    userId?: string
  ): Promise<void> {
    await this.storage.addToDeadLetterQueue({
      operation,
      provider,
      userId,
      payload,
      errorMessage,
      attempts,
      lastAttemptAt: new Date(),
    });
    
    console.log(`🗃️ Added item to dead letter queue: ${operation} (${attempts} attempts)`);
  }
  
  /**
   * Get items from the dead letter queue
   */
  async getItems(limit: number = 100): Promise<DeadLetterItem[]> {
    return this.storage.getDeadLetterItems(limit);
  }
  
  /**
   * Remove an item from the dead letter queue (after manual processing)
   */
  async removeItem(id: string): Promise<void> {
    await this.storage.removeFromDeadLetterQueue(id);
  }
  
  /**
   * Retry items from the dead letter queue
   */
  async retryItems<T>(
    processor: (item: DeadLetterItem) => Promise<T>,
    limit: number = 10
  ): Promise<{
    succeeded: number;
    failed: number;
    remaining: number;
  }> {
    const items = await this.getItems(limit);
    let succeeded = 0;
    let failed = 0;
    
    for (const item of items) {
      try {
        await processor(item);
        await this.removeItem(item.id);
        succeeded++;
      } catch (error) {
        failed++;
        console.error(`❌ Failed to retry dead letter item ${item.id}: ${error}`);
      }
    }
    
    const remainingItems = await this.getItems(1);
    const remaining = remainingItems.length > 0 ? (await this.getItems(1000)).length : 0;
    
    return { succeeded, failed, remaining };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AI rate limiter with the given storage
 */
export function createAIRateLimiter(storage: RateLimiterStorage): AIRateLimiter {
  return new AIRateLimiter(storage);
}

/**
 * Create a batch processor with the given rate limiter
 */
export function createBatchProcessor<T, R>(
  rateLimiter: AIRateLimiter,
  operation: AIOperation,
  provider: AIProvider
): BatchProcessor<T, R> {
  return new BatchProcessor<T, R>(rateLimiter, operation, provider);
}

/**
 * Create a dead letter queue manager with the given storage
 */
export function createDeadLetterQueueManager(storage: RateLimiterStorage): DeadLetterQueueManager {
  return new DeadLetterQueueManager(storage);
}


// ============================================================================
// Request Queue for Excess Requests (Requirements: 8.4)
// ============================================================================

/**
 * Queued request item
 */
export interface QueuedRequest {
  id: string;
  userId: string;
  operation: AIOperation;
  provider: AIProvider;
  payload: unknown;
  priority: number;
  scheduledFor: Date;
  createdAt: Date;
}

/**
 * Request Queue Storage Interface
 */
export interface RequestQueueStorage {
  addToRequestQueue(request: Omit<QueuedRequest, 'id' | 'createdAt'>): Promise<QueuedRequest>;
  getQueuedRequests(userId: string, operation?: AIOperation): Promise<QueuedRequest[]>;
  getRequestsDueForProcessing(limit?: number): Promise<QueuedRequest[]>;
  removeFromRequestQueue(id: string): Promise<void>;
  updateRequestSchedule(id: string, scheduledFor: Date): Promise<void>;
}

/**
 * Request Queue Manager
 * Requirements: 8.4 - Queue excess requests for the next day
 */
export class RequestQueueManager {
  private storage: RequestQueueStorage;
  private rateLimiter: AIRateLimiter;
  
  constructor(storage: RequestQueueStorage, rateLimiter: AIRateLimiter) {
    this.storage = storage;
    this.rateLimiter = rateLimiter;
  }
  
  /**
   * Queue a request for later processing
   * Requirements: 8.4 - Queue excess requests for the next day
   */
  async queueRequest(
    userId: string,
    operation: AIOperation,
    provider: AIProvider,
    payload: unknown,
    priority: number = 0
  ): Promise<QueuedRequest> {
    // Schedule for next day at midnight UTC
    const scheduledFor = getResetTime();
    
    const request = await this.storage.addToRequestQueue({
      userId,
      operation,
      provider,
      payload,
      priority,
      scheduledFor,
    });
    
    console.log(`📥 Queued ${operation} request for ${userId}, scheduled for ${scheduledFor.toISOString()}`);
    
    return request;
  }
  
  /**
   * Check if request should be queued or can be processed immediately
   * Returns the queued request if queued, or null if can proceed
   */
  async checkAndQueue(
    userId: string,
    operation: AIOperation,
    provider: AIProvider,
    payload: unknown,
    priority: number = 0
  ): Promise<{ canProceed: boolean; queuedRequest?: QueuedRequest; limitCheck: RateLimitCheck }> {
    const limitCheck = await this.rateLimiter.canMakeRequest(userId, operation);
    
    if (limitCheck.allowed) {
      return { canProceed: true, limitCheck };
    }
    
    // Queue the request for later
    const queuedRequest = await this.queueRequest(userId, operation, provider, payload, priority);
    
    return { canProceed: false, queuedRequest, limitCheck };
  }
  
  /**
   * Get queued requests for a user
   */
  async getUserQueuedRequests(userId: string, operation?: AIOperation): Promise<QueuedRequest[]> {
    return this.storage.getQueuedRequests(userId, operation);
  }
  
  /**
   * Process queued requests that are due
   */
  async processQueuedRequests<T>(
    processor: (request: QueuedRequest) => Promise<T>,
    limit: number = 100
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    requeued: number;
  }> {
    const dueRequests = await this.storage.getRequestsDueForProcessing(limit);
    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let requeued = 0;
    
    for (const request of dueRequests) {
      processed++;
      
      // Check if we can process now
      const limitCheck = await this.rateLimiter.canMakeRequest(request.userId, request.operation);
      
      if (!limitCheck.allowed) {
        // Reschedule for next day
        const nextSchedule = getResetTime();
        await this.storage.updateRequestSchedule(request.id, nextSchedule);
        requeued++;
        continue;
      }
      
      try {
        await processor(request);
        await this.storage.removeFromRequestQueue(request.id);
        succeeded++;
      } catch (error) {
        failed++;
        console.error(`❌ Failed to process queued request ${request.id}: ${error}`);
        // Reschedule for retry
        const nextSchedule = new Date(Date.now() + 60 * 60 * 1000); // 1 hour later
        await this.storage.updateRequestSchedule(request.id, nextSchedule);
      }
    }
    
    console.log(`📊 Processed ${processed} queued requests: ${succeeded} succeeded, ${failed} failed, ${requeued} requeued`);
    
    return { processed, succeeded, failed, requeued };
  }
}

/**
 * Create a request queue manager
 */
export function createRequestQueueManager(
  storage: RequestQueueStorage,
  rateLimiter: AIRateLimiter
): RequestQueueManager {
  return new RequestQueueManager(storage, rateLimiter);
}

// ============================================================================
// Wrapper Functions for Easy Integration
// ============================================================================

/**
 * Execute an AI operation with rate limiting and usage tracking
 * This is the main entry point for AI operations with full rate limiting support
 */
export async function executeWithRateLimiting<T>(
  rateLimiter: AIRateLimiter,
  userId: string | undefined,
  operation: AIOperation,
  provider: AIProvider,
  model: string,
  executor: () => Promise<{ result: T; inputTokens: number; outputTokens?: number }>,
  options?: {
    skipRateLimitCheck?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: true; result: T } | { success: false; error: string; queued?: boolean }> {
  const startTime = Date.now();
  
  // Check rate limit (unless skipped)
  if (userId && !options?.skipRateLimitCheck) {
    const limitCheck = await rateLimiter.canMakeRequest(userId, operation);
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: limitCheck.reason || 'Rate limit exceeded',
        queued: false,
      };
    }
  }
  
  // Execute with retry
  const retryResult = await withExponentialBackoff(executor);
  const latencyMs = Date.now() - startTime;
  
  if (retryResult.success && retryResult.result) {
    const { result, inputTokens, outputTokens = 0 } = retryResult.result;
    
    // Record successful usage
    await rateLimiter.recordSuccess(
      userId,
      operation,
      provider,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      options?.metadata
    );
    
    return { success: true, result };
  } else {
    const errorMessage = retryResult.error?.message || 'Unknown error';
    
    // Record failed usage
    await rateLimiter.recordFailure(
      userId,
      operation,
      provider,
      model,
      errorMessage,
      latencyMs,
      options?.metadata
    );
    
    return { success: false, error: errorMessage };
  }
}

