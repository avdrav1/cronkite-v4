/**
 * Embedding Service
 * 
 * Generates and manages article embeddings using OpenAI's text-embedding-3-small model.
 * Implements Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.1
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import type { Article, InsertEmbeddingQueue, EmbeddingQueue } from '@shared/schema';

// Constants
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const MAX_BATCH_SIZE = 100;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

// Types
export interface EmbeddingResult {
  success: boolean;
  articleId: string;
  embedding?: number[];
  tokenCount?: number;
  error?: string;
  contentHash?: string;
}

export interface BatchEmbeddingResult {
  successful: EmbeddingResult[];
  failed: EmbeddingResult[];
  totalTokens: number;
  processingTimeMs: number;
}

export interface QueueProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  remainingInQueue: number;
}

export interface EmbeddingServiceConfig {
  apiKey?: string;
  maxBatchSize?: number;
  maxRetryAttempts?: number;
}

// OpenAI client singleton
let openaiClient: OpenAI | null = null;

/**
 * Initialize or get the OpenAI client
 * Requirements: 1.1
 */
export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ OpenAI API key not configured - embedding features unavailable');
    return null;
  }
  
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
    });
  }
  
  return openaiClient;
}

/**
 * Check if embedding service is available
 */
export function isEmbeddingServiceAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Generate content hash for change detection
 * Requirements: 1.5
 */
export function generateContentHash(title: string, excerpt: string | null | undefined): string {
  const content = `${title}|${excerpt || ''}`;
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Prepare embedding input text from article
 * Requirements: 1.3 - Concatenate title and excerpt for input text
 */
export function prepareEmbeddingInput(title: string, excerpt: string | null | undefined): string {
  const cleanTitle = title.trim();
  const cleanExcerpt = (excerpt || '').trim();
  
  // Concatenate title and excerpt with a separator
  if (cleanExcerpt) {
    return `${cleanTitle}\n\n${cleanExcerpt}`;
  }
  
  return cleanTitle;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate embedding for a single text input
 * Requirements: 1.1, 1.2
 */
export async function generateEmbedding(
  text: string,
  retryAttempt: number = 0
): Promise<{ embedding: number[]; tokenCount: number } | null> {
  const client = getOpenAIClient();
  
  if (!client) {
    return null;
  }
  
  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    
    const embedding = response.data[0].embedding;
    const tokenCount = response.usage?.total_tokens || 0;
    
    // Validate embedding dimensions (Property 1: Embedding Dimension Invariant)
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`);
    }
    
    return { embedding, tokenCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle rate limits and server errors with retry
    if (error instanceof OpenAI.APIError) {
      const isRetryable = error.status === 429 || (error.status && error.status >= 500);
      
      if (isRetryable && retryAttempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAYS[retryAttempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.warn(`⚠️ OpenAI API error (${error.status}), retrying in ${delay}ms... (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        await sleep(delay);
        return generateEmbedding(text, retryAttempt + 1);
      }
    }
    
    console.error(`❌ Failed to generate embedding: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate embedding for a single article
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export async function generateArticleEmbedding(
  article: Pick<Article, 'id' | 'title' | 'excerpt' | 'content_hash'>
): Promise<EmbeddingResult> {
  const articleId = article.id;
  
  try {
    // Prepare input text (Requirements: 1.3)
    const inputText = prepareEmbeddingInput(article.title, article.excerpt);
    
    // Generate content hash for change detection (Requirements: 1.5)
    const contentHash = generateContentHash(article.title, article.excerpt);
    
    // Generate embedding
    const result = await generateEmbedding(inputText);
    
    if (!result) {
      return {
        success: false,
        articleId,
        error: 'OpenAI client not available',
      };
    }
    
    return {
      success: true,
      articleId,
      embedding: result.embedding,
      tokenCount: result.tokenCount,
      contentHash,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      articleId,
      error: errorMessage,
    };
  }
}


/**
 * Generate embeddings for a batch of articles
 * Requirements: 1.6 - Process articles in batches of up to 100
 */
export async function generateEmbeddingsBatch(
  articles: Array<Pick<Article, 'id' | 'title' | 'excerpt' | 'content_hash'>>
): Promise<BatchEmbeddingResult> {
  const startTime = Date.now();
  const successful: EmbeddingResult[] = [];
  const failed: EmbeddingResult[] = [];
  let totalTokens = 0;
  
  // Enforce batch size limit (Property 4: Batch Size Limit)
  const batchArticles = articles.slice(0, MAX_BATCH_SIZE);
  
  if (articles.length > MAX_BATCH_SIZE) {
    console.warn(`⚠️ Batch size ${articles.length} exceeds limit ${MAX_BATCH_SIZE}, processing first ${MAX_BATCH_SIZE} articles`);
  }
  
  const client = getOpenAIClient();
  
  if (!client) {
    // Return all as failed if client not available
    return {
      successful: [],
      failed: batchArticles.map(article => ({
        success: false,
        articleId: article.id,
        error: 'OpenAI client not available',
      })),
      totalTokens: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // Process articles in parallel with controlled concurrency
  const CONCURRENCY_LIMIT = 10;
  
  for (let i = 0; i < batchArticles.length; i += CONCURRENCY_LIMIT) {
    const chunk = batchArticles.slice(i, i + CONCURRENCY_LIMIT);
    
    const results = await Promise.all(
      chunk.map(article => generateArticleEmbedding(article))
    );
    
    for (const result of results) {
      if (result.success) {
        successful.push(result);
        totalTokens += result.tokenCount || 0;
      } else {
        failed.push(result);
      }
    }
  }
  
  const processingTimeMs = Date.now() - startTime;
  
  console.log(`✅ Batch embedding complete: ${successful.length} succeeded, ${failed.length} failed, ${totalTokens} tokens, ${processingTimeMs}ms`);
  
  return {
    successful,
    failed,
    totalTokens,
    processingTimeMs,
  };
}

/**
 * Check if an article needs embedding update
 * Requirements: 1.5 - Skip regeneration unless content has changed
 */
export function needsEmbeddingUpdate(
  article: Pick<Article, 'title' | 'excerpt' | 'embedding' | 'content_hash' | 'embedding_status'>
): boolean {
  // If no embedding exists, needs update
  if (!article.embedding || article.embedding_status === 'pending') {
    return true;
  }
  
  // If embedding failed, needs retry
  if (article.embedding_status === 'failed') {
    return true;
  }
  
  // If content hash doesn't exist, needs update
  if (!article.content_hash) {
    return true;
  }
  
  // Check if content has changed (Property 3: Embedding Idempotence)
  const currentHash = generateContentHash(article.title, article.excerpt);
  return currentHash !== article.content_hash;
}

// ============================================================================
// Embedding Queue Management
// Requirements: 1.2, 7.1
// ============================================================================

export interface EmbeddingQueueItem {
  id: string;
  article_id: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  last_attempt_at: Date | null;
  error_message: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Storage interface for embedding queue operations
 * This allows the service to work with different storage implementations
 */
export interface EmbeddingQueueStorage {
  // Queue operations
  addToEmbeddingQueue(articleIds: string[], priority?: number): Promise<void>;
  getEmbeddingQueueItems(limit: number, status?: string): Promise<EmbeddingQueueItem[]>;
  updateEmbeddingQueueItem(id: string, updates: Partial<EmbeddingQueueItem>): Promise<void>;
  removeFromEmbeddingQueue(articleId: string): Promise<void>;
  getEmbeddingQueueCount(status?: string): Promise<number>;
  
  // Article operations
  getArticleById(id: string): Promise<Article | undefined>;
  updateArticleEmbedding(
    articleId: string, 
    embedding: number[], 
    contentHash: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void>;
}

/**
 * Embedding Queue Manager
 * Handles queue operations for embedding generation
 */
export class EmbeddingQueueManager {
  private storage: EmbeddingQueueStorage;
  
  constructor(storage: EmbeddingQueueStorage) {
    this.storage = storage;
  }
  
  /**
   * Queue articles for embedding generation
   * Requirements: 7.1
   */
  async queueForEmbedding(articleIds: string[], priority: number = 0): Promise<void> {
    if (articleIds.length === 0) {
      return;
    }
    
    await this.storage.addToEmbeddingQueue(articleIds, priority);
    console.log(`📥 Queued ${articleIds.length} articles for embedding generation (priority: ${priority})`);
  }
  
  /**
   * Process the embedding queue
   * Requirements: 1.2, 7.1
   */
  async processQueue(batchSize: number = MAX_BATCH_SIZE): Promise<QueueProcessResult> {
    // Get pending items from queue, ordered by priority
    const queueItems = await this.storage.getEmbeddingQueueItems(batchSize, 'pending');
    
    if (queueItems.length === 0) {
      const remaining = await this.storage.getEmbeddingQueueCount('pending');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        remainingInQueue: remaining,
      };
    }
    
    let succeeded = 0;
    let failed = 0;
    
    // Fetch articles for the queue items
    const articles: Array<Pick<Article, 'id' | 'title' | 'excerpt' | 'content_hash'>> = [];
    const queueItemMap = new Map<string, EmbeddingQueueItem>();
    
    for (const item of queueItems) {
      const article = await this.storage.getArticleById(item.article_id);
      if (article) {
        articles.push({
          id: article.id,
          title: article.title,
          excerpt: article.excerpt,
          content_hash: article.content_hash,
        });
        queueItemMap.set(article.id, item);
      } else {
        // Article no longer exists, remove from queue
        await this.storage.removeFromEmbeddingQueue(item.article_id);
      }
    }
    
    if (articles.length === 0) {
      const remaining = await this.storage.getEmbeddingQueueCount('pending');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        remainingInQueue: remaining,
      };
    }
    
    // Process batch
    const batchResult = await generateEmbeddingsBatch(articles);
    
    // Update successful embeddings
    for (const result of batchResult.successful) {
      const queueItem = queueItemMap.get(result.articleId);
      
      if (result.embedding && result.contentHash) {
        await this.storage.updateArticleEmbedding(
          result.articleId,
          result.embedding,
          result.contentHash,
          'completed'
        );
        
        // Remove from queue
        await this.storage.removeFromEmbeddingQueue(result.articleId);
        succeeded++;
      }
    }
    
    // Handle failed embeddings
    for (const result of batchResult.failed) {
      const queueItem = queueItemMap.get(result.articleId);
      
      if (queueItem) {
        const newAttempts = queueItem.attempts + 1;
        
        if (newAttempts >= queueItem.max_attempts) {
          // Move to dead letter queue
          await this.storage.updateEmbeddingQueueItem(queueItem.id, {
            status: 'dead_letter',
            attempts: newAttempts,
            last_attempt_at: new Date(),
            error_message: result.error || 'Max retries exceeded',
          });
          
          // Update article status
          await this.storage.updateArticleEmbedding(
            result.articleId,
            [],
            '',
            'failed',
            result.error || 'Max retries exceeded'
          );
        } else {
          // Update for retry
          await this.storage.updateEmbeddingQueueItem(queueItem.id, {
            attempts: newAttempts,
            last_attempt_at: new Date(),
            error_message: result.error,
          });
        }
        
        failed++;
      }
    }
    
    const remaining = await this.storage.getEmbeddingQueueCount('pending');
    
    return {
      processed: articles.length,
      succeeded,
      failed,
      remainingInQueue: remaining,
    };
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    deadLetter: number;
  }> {
    const [pending, processing, failed, deadLetter] = await Promise.all([
      this.storage.getEmbeddingQueueCount('pending'),
      this.storage.getEmbeddingQueueCount('processing'),
      this.storage.getEmbeddingQueueCount('failed'),
      this.storage.getEmbeddingQueueCount('dead_letter'),
    ]);
    
    return { pending, processing, failed, deadLetter };
  }
}

/**
 * Create an embedding queue manager with the given storage
 */
export function createEmbeddingQueueManager(storage: EmbeddingQueueStorage): EmbeddingQueueManager {
  return new EmbeddingQueueManager(storage);
}
