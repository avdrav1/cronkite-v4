/**
 * Similar Articles Service
 * 
 * Provides similar article recommendations based on vector embeddings.
 * Implements Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 * 
 * Property 12: Similar Articles Search Constraints
 * - Result set contains at most 5 articles
 * - All articles have similarity scores >= 0.7
 * - Source article does not appear in results
 * - All articles belong to user's subscribed feeds
 */

import { 
  cosineSimilarity, 
  SIMILAR_ARTICLES_THRESHOLD, 
  MAX_SIMILAR_ARTICLES,
  type ArticleWithEmbedding,
  type SimilarArticle 
} from './clustering-service';
import type { IStorage } from './storage';

// Constants
export const SIMILARITY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (Requirements: 4.6)
export const MIN_SIMILARITY_THRESHOLD = 0.7; // Requirements: 4.2
export const MAX_RESULTS = 5; // Requirements: 4.1

// Types
export interface SimilarArticlesResult {
  articleId: string;
  similarArticles: SimilarArticle[];
  fromCache: boolean;
  cacheExpiresAt?: Date;
  message?: string;
}

export interface SimilarArticlesCacheEntry {
  articleId: string;
  similarArticles: SimilarArticle[];
  createdAt: Date;
  expiresAt: Date;
  userId: string;
}

/**
 * In-memory cache for similar articles results
 * Key: `${userId}:${articleId}`
 */
const similarArticlesCache = new Map<string, SimilarArticlesCacheEntry>();

/**
 * Generate cache key for similar articles
 */
function getCacheKey(userId: string, articleId: string): string {
  return `${userId}:${articleId}`;
}

/**
 * Get cached similar articles if available and not expired
 * Requirements: 4.6 - Cache results for 1 hour
 */
export function getCachedSimilarArticles(
  userId: string, 
  articleId: string
): SimilarArticlesCacheEntry | null {
  const cacheKey = getCacheKey(userId, articleId);
  const cached = similarArticlesCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  // Check if cache has expired
  if (new Date() > cached.expiresAt) {
    similarArticlesCache.delete(cacheKey);
    return null;
  }
  
  return cached;
}

/**
 * Store similar articles in cache
 * Requirements: 4.6 - Cache results for 1 hour
 */
export function cacheSimilarArticles(
  userId: string,
  articleId: string,
  similarArticles: SimilarArticle[]
): SimilarArticlesCacheEntry {
  const cacheKey = getCacheKey(userId, articleId);
  const now = new Date();
  
  const entry: SimilarArticlesCacheEntry = {
    articleId,
    similarArticles,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SIMILARITY_CACHE_TTL_MS),
    userId,
  };
  
  similarArticlesCache.set(cacheKey, entry);
  return entry;
}

/**
 * Invalidate cache for a specific article
 * Called when new embeddings are generated
 * Requirements: 4.6 - Invalidate on new embeddings
 */
export function invalidateSimilarArticlesCache(articleId: string): void {
  // Remove all cache entries that reference this article
  const keysToDelete: string[] = [];
  
  similarArticlesCache.forEach((entry, key) => {
    if (entry.articleId === articleId) {
      keysToDelete.push(key);
    }
    // Also invalidate if this article appears in similar articles list
    else if (entry.similarArticles.some(a => a.articleId === articleId)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => similarArticlesCache.delete(key));
}

/**
 * Invalidate all cache entries for a user
 * Called when user subscribes to new feeds
 */
export function invalidateUserSimilarArticlesCache(userId: string): void {
  const keysToDelete: string[] = [];
  
  similarArticlesCache.forEach((entry, key) => {
    if (entry.userId === userId) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => similarArticlesCache.delete(key));
}

/**
 * Clear expired cache entries
 * Should be called periodically
 */
export function cleanupExpiredCache(): number {
  const now = new Date();
  const keysToDelete: string[] = [];
  
  similarArticlesCache.forEach((entry, key) => {
    if (now > entry.expiresAt) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => similarArticlesCache.delete(key));
  return keysToDelete.length;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  oldestEntry?: Date;
  newestEntry?: Date;
} {
  const entries = Array.from(similarArticlesCache.values());
  
  if (entries.length === 0) {
    return { totalEntries: 0 };
  }
  
  const sortedByDate = entries.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  
  return {
    totalEntries: entries.length,
    oldestEntry: sortedByDate[0].createdAt,
    newestEntry: sortedByDate[sortedByDate.length - 1].createdAt,
  };
}



/**
 * Find similar articles for a given article
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * Property 12: Similar Articles Search Constraints
 * - (a) Result set contains at most 5 articles
 * - (b) All articles have similarity scores >= 0.7
 * - (c) Source article does not appear in results
 * - (d) All articles belong to user's subscribed feeds
 * 
 * @param storage - Storage interface for database operations
 * @param articleId - ID of the source article
 * @param userId - ID of the user (for feed filtering)
 * @returns Similar articles result with caching information
 */
export async function findSimilarArticles(
  storage: IStorage,
  articleId: string,
  userId: string
): Promise<SimilarArticlesResult> {
  // Check cache first (Requirements: 4.6)
  const cached = getCachedSimilarArticles(userId, articleId);
  if (cached) {
    console.log(`📦 Similar articles cache hit for article ${articleId}`);
    return {
      articleId,
      similarArticles: cached.similarArticles,
      fromCache: true,
      cacheExpiresAt: cached.expiresAt,
    };
  }
  
  console.log(`🔍 Finding similar articles for article ${articleId}`);
  
  // Get user's subscribed feeds (Requirements: 4.4)
  const userFeeds = await storage.getUserFeeds(userId);
  
  if (userFeeds.length === 0) {
    return {
      articleId,
      similarArticles: [],
      fromCache: false,
      message: 'No subscribed feeds found',
    };
  }
  
  const feedIds = userFeeds.map(f => f.id);
  
  // Get all articles with embeddings from user's feeds
  // Use a longer time window for better recommendations
  const articlesWithEmbeddings = await storage.getArticlesWithEmbeddings(
    userId,
    feedIds,
    168 // 7 days of articles for better recommendations
  );
  
  if (articlesWithEmbeddings.length === 0) {
    return {
      articleId,
      similarArticles: [],
      fromCache: false,
      message: 'No articles with embeddings found',
    };
  }
  
  // Find the source article
  const sourceArticle = articlesWithEmbeddings.find(a => a.id === articleId);
  
  if (!sourceArticle) {
    // Source article might not have an embedding yet
    return {
      articleId,
      similarArticles: [],
      fromCache: false,
      message: 'Source article does not have an embedding',
    };
  }
  
  // Find similar articles using cosine similarity
  // Property 12: Implements all constraints
  const similarArticles = findSimilarArticlesFromList(
    sourceArticle,
    articlesWithEmbeddings,
    {
      threshold: MIN_SIMILARITY_THRESHOLD, // (b) >= 0.7
      maxResults: MAX_RESULTS, // (a) at most 5
      excludeArticleIds: [articleId], // (c) exclude source
      feedIds, // (d) user's subscribed feeds
    }
  );
  
  // Cache the results (Requirements: 4.6)
  const cacheEntry = cacheSimilarArticles(userId, articleId, similarArticles);
  
  console.log(`✅ Found ${similarArticles.length} similar articles for article ${articleId}`);
  
  return {
    articleId,
    similarArticles,
    fromCache: false,
    cacheExpiresAt: cacheEntry.expiresAt,
  };
}

/**
 * Find similar articles from a list of articles with embeddings
 * 
 * This is the core similarity search function that implements Property 12.
 * 
 * @param sourceArticle - The article to find similar articles for
 * @param allArticles - All articles with embeddings to search through
 * @param options - Search options (threshold, maxResults, excludeIds, feedIds)
 * @returns Array of similar articles sorted by similarity score
 */
export function findSimilarArticlesFromList(
  sourceArticle: ArticleWithEmbedding,
  allArticles: ArticleWithEmbedding[],
  options: {
    threshold?: number;
    maxResults?: number;
    excludeArticleIds?: string[];
    feedIds?: string[];
  } = {}
): SimilarArticle[] {
  const {
    threshold = MIN_SIMILARITY_THRESHOLD,
    maxResults = MAX_RESULTS,
    excludeArticleIds = [],
    feedIds,
  } = options;
  
  // Create sets for efficient lookup
  const excludeSet = new Set([sourceArticle.id, ...excludeArticleIds]);
  const feedIdSet = feedIds ? new Set(feedIds) : null;
  
  const similarities: Array<{ article: ArticleWithEmbedding; score: number }> = [];
  
  for (const article of allArticles) {
    // Property 12(c): Exclude source article
    if (excludeSet.has(article.id)) {
      continue;
    }
    
    // Property 12(d): Only include articles from user's subscribed feeds
    if (feedIdSet && !feedIdSet.has(article.feedId)) {
      continue;
    }
    
    // Skip articles without valid embeddings
    if (!article.embedding || article.embedding.length === 0) {
      continue;
    }
    
    // Calculate cosine similarity
    try {
      const score = cosineSimilarity(sourceArticle.embedding, article.embedding);
      
      // Property 12(b): Only include if similarity >= threshold (0.7)
      if (score >= threshold) {
        similarities.push({ article, score });
      }
    } catch (error) {
      // Skip articles with incompatible embeddings
      console.warn(`Skipping article ${article.id} due to embedding error`);
      continue;
    }
  }
  
  // Sort by similarity score descending
  similarities.sort((a, b) => b.score - a.score);
  
  // Property 12(a): Return at most maxResults (5) articles
  return similarities.slice(0, maxResults).map(({ article, score }) => ({
    articleId: article.id,
    title: article.title,
    feedName: article.feedName,
    feedId: article.feedId,
    similarityScore: score,
    publishedAt: article.publishedAt,
    imageUrl: article.imageUrl,
  }));
}

/**
 * Similar Articles Service Manager
 * 
 * Provides a higher-level interface for similar articles operations
 */
export class SimilarArticlesService {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  /**
   * Find similar articles for a given article
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
   */
  async findSimilar(
    articleId: string,
    userId: string
  ): Promise<SimilarArticlesResult> {
    return findSimilarArticles(this.storage, articleId, userId);
  }
  
  /**
   * Invalidate cache when new embeddings are generated
   * Requirements: 4.6
   */
  invalidateCacheForArticle(articleId: string): void {
    invalidateSimilarArticlesCache(articleId);
  }
  
  /**
   * Invalidate all cache for a user
   */
  invalidateCacheForUser(userId: string): void {
    invalidateUserSimilarArticlesCache(userId);
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    return getCacheStats();
  }
  
  /**
   * Clean up expired cache entries
   */
  cleanupCache(): number {
    return cleanupExpiredCache();
  }
}

/**
 * Create a similar articles service instance
 */
export function createSimilarArticlesService(storage: IStorage): SimilarArticlesService {
  return new SimilarArticlesService(storage);
}
