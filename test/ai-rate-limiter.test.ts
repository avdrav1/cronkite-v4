/**
 * AI Rate Limiter Tests
 * 
 * Tests for the AI rate limiting, usage tracking, and failure handling functionality.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIRateLimiter,
  calculateCost,
  getCurrentDateString,
  getResetTime,
  isRetryableError,
  withExponentialBackoff,
  BatchProcessor,
  DeadLetterQueueManager,
  createAIRateLimiter,
  createBatchProcessor,
  createDeadLetterQueueManager,
  TOKEN_COSTS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS,
  DEFAULT_DAILY_LIMITS,
  type RateLimiterStorage,
  type APIUsage,
  type DeadLetterItem,
} from '../server/ai-rate-limiter';
import type { AIUsageDaily, AIUsageLog, InsertAIUsageLog } from '../shared/schema';

// ============================================================================
// Mock Storage Implementation
// ============================================================================

function createMockStorage(): RateLimiterStorage & {
  usageLogs: AIUsageLog[];
  dailyUsage: Map<string, AIUsageDaily>;
  deadLetterItems: DeadLetterItem[];
} {
  const usageLogs: AIUsageLog[] = [];
  const dailyUsage = new Map<string, AIUsageDaily>();
  const deadLetterItems: DeadLetterItem[] = [];
  
  return {
    usageLogs,
    dailyUsage,
    deadLetterItems,
    
    async recordUsageLog(usage: InsertAIUsageLog): Promise<AIUsageLog> {
      const log: AIUsageLog = {
        id: `log-${usageLogs.length + 1}`,
        user_id: usage.user_id || null,
        operation: usage.operation,
        provider: usage.provider,
        model: usage.model || null,
        token_count: usage.token_count ?? 0,
        input_tokens: usage.input_tokens || null,
        output_tokens: usage.output_tokens || null,
        estimated_cost: usage.estimated_cost || '0',
        request_metadata: usage.request_metadata || null,
        success: usage.success ?? true,
        error_message: usage.error_message || null,
        latency_ms: usage.latency_ms || null,
        created_at: new Date(),
      };
      usageLogs.push(log);
      return log;
    },
    
    async getDailyUsage(userId: string, date: string): Promise<AIUsageDaily | undefined> {
      return dailyUsage.get(`${userId}-${date}`);
    },
    
    async upsertDailyUsage(usage: any): Promise<AIUsageDaily> {
      const key = `${usage.user_id}-${usage.date}`;
      const existing = dailyUsage.get(key);
      
      const record: AIUsageDaily = {
        id: existing?.id || `daily-${dailyUsage.size + 1}`,
        user_id: usage.user_id,
        date: usage.date,
        embeddings_count: usage.embeddings_count || existing?.embeddings_count || 0,
        clusterings_count: usage.clusterings_count || existing?.clusterings_count || 0,
        searches_count: usage.searches_count || existing?.searches_count || 0,
        summaries_count: usage.summaries_count || existing?.summaries_count || 0,
        total_tokens: usage.total_tokens || existing?.total_tokens || 0,
        openai_tokens: usage.openai_tokens || existing?.openai_tokens || 0,
        anthropic_tokens: usage.anthropic_tokens || existing?.anthropic_tokens || 0,
        estimated_cost: usage.estimated_cost || existing?.estimated_cost || '0',
        embeddings_limit: usage.embeddings_limit || existing?.embeddings_limit || 500,
        clusterings_limit: usage.clusterings_limit || existing?.clusterings_limit || 10,
        searches_limit: usage.searches_limit || existing?.searches_limit || 100,
        created_at: existing?.created_at || new Date(),
        updated_at: new Date(),
      };
      
      dailyUsage.set(key, record);
      return record;
    },
    
    async incrementDailyUsage(
      userId: string,
      date: string,
      operation: string,
      tokenCount: number,
      provider: string,
      cost: number
    ): Promise<AIUsageDaily> {
      const key = `${userId}-${date}`;
      const existing = dailyUsage.get(key);
      
      const record: AIUsageDaily = {
        id: existing?.id || `daily-${dailyUsage.size + 1}`,
        user_id: userId,
        date,
        embeddings_count: (existing?.embeddings_count || 0) + (operation === 'embedding' ? 1 : 0),
        clusterings_count: (existing?.clusterings_count || 0) + (operation === 'clustering' ? 1 : 0),
        searches_count: (existing?.searches_count || 0) + (operation === 'search' ? 1 : 0),
        summaries_count: (existing?.summaries_count || 0) + (operation === 'summary' ? 1 : 0),
        total_tokens: (existing?.total_tokens || 0) + tokenCount,
        openai_tokens: (existing?.openai_tokens || 0) + (provider === 'openai' ? tokenCount : 0),
        anthropic_tokens: (existing?.anthropic_tokens || 0) + (provider === 'anthropic' ? tokenCount : 0),
        estimated_cost: ((parseFloat(existing?.estimated_cost?.toString() || '0')) + cost).toFixed(6),
        embeddings_limit: existing?.embeddings_limit || 500,
        clusterings_limit: existing?.clusterings_limit || 10,
        searches_limit: existing?.searches_limit || 100,
        created_at: existing?.created_at || new Date(),
        updated_at: new Date(),
      };
      
      dailyUsage.set(key, record);
      return record;
    },
    
    async getUsageStats(userId: string, days: number = 7): Promise<AIUsageDaily[]> {
      const results: AIUsageDaily[] = [];
      dailyUsage.forEach((value, key) => {
        if (key.startsWith(userId)) {
          results.push(value);
        }
      });
      return results;
    },
    
    async addToDeadLetterQueue(item: Omit<DeadLetterItem, 'id' | 'createdAt'>): Promise<void> {
      deadLetterItems.push({
        ...item,
        id: `dl-${deadLetterItems.length + 1}`,
        createdAt: new Date(),
      });
    },
    
    async getDeadLetterItems(limit: number = 100): Promise<DeadLetterItem[]> {
      return deadLetterItems.slice(0, limit);
    },
    
    async removeFromDeadLetterQueue(id: string): Promise<void> {
      const index = deadLetterItems.findIndex(item => item.id === id);
      if (index !== -1) {
        deadLetterItems.splice(index, 1);
      }
    },
  };
}

// ============================================================================
// Unit Tests
// ============================================================================

describe('AI Rate Limiter', () => {
  describe('Utility Functions', () => {
    describe('calculateCost', () => {
      it('should calculate cost for OpenAI embedding model', () => {
        const cost = calculateCost('openai', 'text-embedding-3-small', 1000, 0);
        expect(cost).toBeCloseTo(0.00002, 6);
      });
      
      it('should calculate cost for Anthropic model', () => {
        const cost = calculateCost('anthropic', 'claude-3-haiku-20240307', 1000, 500);
        // Input: 1000 * 0.00025 / 1000 = 0.00025
        // Output: 500 * 0.00125 / 1000 = 0.000625
        // Total: 0.000875
        expect(cost).toBeCloseTo(0.000875, 6);
      });
      
      it('should use fallback cost for unknown model', () => {
        const cost = calculateCost('openai', 'unknown-model', 1000, 0);
        expect(cost).toBeGreaterThan(0);
      });
    });
    
    describe('getCurrentDateString', () => {
      it('should return date in YYYY-MM-DD format', () => {
        const dateStr = getCurrentDateString();
        expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
    
    describe('getResetTime', () => {
      it('should return midnight UTC of next day', () => {
        const resetTime = getResetTime();
        const now = new Date();
        
        expect(resetTime.getTime()).toBeGreaterThan(now.getTime());
        expect(resetTime.getUTCHours()).toBe(0);
        expect(resetTime.getUTCMinutes()).toBe(0);
        expect(resetTime.getUTCSeconds()).toBe(0);
      });
    });
    
    describe('isRetryableError', () => {
      it('should return true for rate limit errors', () => {
        expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
        expect(isRetryableError(new Error('Error 429: Too many requests'))).toBe(true);
      });
      
      it('should return true for server errors', () => {
        expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
        expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
      });
      
      it('should return true for network errors', () => {
        expect(isRetryableError(new Error('Network error'))).toBe(true);
        expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      });
      
      it('should return false for non-retryable errors', () => {
        expect(isRetryableError(new Error('Invalid API key'))).toBe(false);
        expect(isRetryableError(new Error('Bad request'))).toBe(false);
      });
    });
  });
  
  describe('AIRateLimiter Class', () => {
    let storage: ReturnType<typeof createMockStorage>;
    let rateLimiter: AIRateLimiter;
    
    beforeEach(() => {
      storage = createMockStorage();
      rateLimiter = createAIRateLimiter(storage);
    });
    
    describe('recordUsage', () => {
      it('should record usage log', async () => {
        const usage: APIUsage = {
          operation: 'embedding',
          provider: 'openai',
          model: 'text-embedding-3-small',
          tokenCount: 100,
          inputTokens: 100,
          estimatedCost: 0.000002,
          success: true,
        };
        
        await rateLimiter.recordUsage('user-1', usage);
        
        expect(storage.usageLogs).toHaveLength(1);
        expect(storage.usageLogs[0].operation).toBe('embedding');
        expect(storage.usageLogs[0].token_count).toBe(100);
      });
      
      it('should update daily aggregates', async () => {
        const usage: APIUsage = {
          operation: 'embedding',
          provider: 'openai',
          tokenCount: 100,
          estimatedCost: 0.000002,
          success: true,
        };
        
        await rateLimiter.recordUsage('user-1', usage);
        
        const date = getCurrentDateString();
        const daily = storage.dailyUsage.get(`user-1-${date}`);
        
        expect(daily).toBeDefined();
        expect(daily?.embeddings_count).toBe(1);
        expect(daily?.total_tokens).toBe(100);
      });
    });
    
    describe('canMakeRequest', () => {
      it('should allow request when under limit', async () => {
        const result = await rateLimiter.canMakeRequest('user-1', 'embedding');
        
        expect(result.allowed).toBe(true);
        expect(result.currentCount).toBe(0);
        expect(result.dailyLimit).toBe(500);
        expect(result.remaining).toBe(500);
      });
      
      it('should deny request when at limit', async () => {
        // Set up daily usage at limit
        const date = getCurrentDateString();
        storage.dailyUsage.set(`user-1-${date}`, {
          id: 'daily-1',
          user_id: 'user-1',
          date,
          embeddings_count: 500,
          clusterings_count: 0,
          searches_count: 0,
          summaries_count: 0,
          total_tokens: 50000,
          openai_tokens: 50000,
          anthropic_tokens: 0,
          estimated_cost: '0.001',
          embeddings_limit: 500,
          clusterings_limit: 10,
          searches_limit: 100,
          created_at: new Date(),
          updated_at: new Date(),
        });
        
        const result = await rateLimiter.canMakeRequest('user-1', 'embedding');
        
        expect(result.allowed).toBe(false);
        expect(result.currentCount).toBe(500);
        expect(result.remaining).toBe(0);
        expect(result.reason).toContain('limit');
      });
    });
    
    describe('getUsageStats', () => {
      it('should return usage statistics', async () => {
        // Record some usage
        await rateLimiter.recordSuccess('user-1', 'embedding', 'openai', 'text-embedding-3-small', 100);
        await rateLimiter.recordSuccess('user-1', 'search', 'openai', 'text-embedding-3-small', 50);
        
        const stats = await rateLimiter.getUsageStats('user-1');
        
        expect(stats.daily.embeddings).toBe(1);
        expect(stats.daily.searches).toBe(1);
        expect(stats.daily.totalTokens).toBe(150);
        expect(stats.limits.embeddingsPerDay).toBe(500);
        expect(stats.remaining.embeddings).toBe(499);
      });
    });
  });
  
  describe('withExponentialBackoff', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await withExponentialBackoff(fn);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should retry on retryable error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success');
      
      const result = await withExponentialBackoff(fn, 3, [10, 20, 40]);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('should stop after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));
      
      const result = await withExponentialBackoff(fn, 3, [10, 20, 40]);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Rate limit exceeded');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid API key'));
      
      const result = await withExponentialBackoff(fn, 3, [10, 20, 40]);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('BatchProcessor', () => {
    let storage: ReturnType<typeof createMockStorage>;
    let rateLimiter: AIRateLimiter;
    let batchProcessor: BatchProcessor<string, string>;
    
    beforeEach(() => {
      storage = createMockStorage();
      rateLimiter = createAIRateLimiter(storage);
      batchProcessor = createBatchProcessor<string, string>(rateLimiter, 'embedding', 'openai');
    });
    
    it('should process batch successfully', async () => {
      const items = ['item1', 'item2', 'item3'];
      const processor = vi.fn().mockImplementation(async (item: string) => `processed-${item}`);
      
      const result = await batchProcessor.processBatch(items, processor);
      
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.deadLettered).toHaveLength(0);
    });
    
    it('should continue processing on individual failures', async () => {
      const items = ['item1', 'item2', 'item3'];
      const processor = vi.fn()
        .mockResolvedValueOnce('processed-item1')
        .mockRejectedValueOnce(new Error('Rate limit exceeded')) // Retryable error
        .mockRejectedValueOnce(new Error('Rate limit exceeded')) // Retry 1
        .mockRejectedValueOnce(new Error('Rate limit exceeded')) // Retry 2 - max retries reached
        .mockResolvedValueOnce('processed-item3');
      
      const result = await batchProcessor.processBatch(items, processor);
      
      expect(result.successful).toHaveLength(2);
      expect(result.deadLettered).toHaveLength(1);
    });
  });
  
  describe('DeadLetterQueueManager', () => {
    let storage: ReturnType<typeof createMockStorage>;
    let dlqManager: DeadLetterQueueManager;
    
    beforeEach(() => {
      storage = createMockStorage();
      dlqManager = createDeadLetterQueueManager(storage);
    });
    
    it('should add items to dead letter queue', async () => {
      await dlqManager.addToQueue(
        'embedding',
        'openai',
        { articleId: 'article-1' },
        'Max retries exceeded',
        3,
        'user-1'
      );
      
      expect(storage.deadLetterItems).toHaveLength(1);
      expect(storage.deadLetterItems[0].operation).toBe('embedding');
      expect(storage.deadLetterItems[0].attempts).toBe(3);
    });
    
    it('should retrieve items from dead letter queue', async () => {
      await dlqManager.addToQueue('embedding', 'openai', {}, 'Error 1', 3);
      await dlqManager.addToQueue('clustering', 'anthropic', {}, 'Error 2', 3);
      
      const items = await dlqManager.getItems();
      
      expect(items).toHaveLength(2);
    });
    
    it('should remove items from dead letter queue', async () => {
      await dlqManager.addToQueue('embedding', 'openai', {}, 'Error', 3);
      
      const items = await dlqManager.getItems();
      await dlqManager.removeItem(items[0].id);
      
      const remainingItems = await dlqManager.getItems();
      expect(remainingItems).toHaveLength(0);
    });
  });
});

