/**
 * Semantic Search Service
 * 
 * Provides natural language search using embeddings.
 * Implements Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 * 
 * Property 13: Semantic Search Result Constraints
 * - (a) Results sorted by similarity score descending
 * - (b) All articles belong to user's subscribed feeds
 * - (c) Each result includes a relevance score
 * - (d) Result set contains at most 50 articles
 * - (e) Date/feed filters correctly applied
 */

import { generateEmbedding, isEmbeddingServiceAvailable } from './embedding-service';
import { cosineSimilarity, type ArticleWithEmbedding } from './clustering-service';
import type { IStorage } from './storage';

// Constants
export const MAX_SEARCH_RESULTS = 50; // Requirements: 5.5
export const MIN_SEARCH_SIMILARITY = 0.5; // Default minimum similarity threshold
export const QUERY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache for query embeddings
export const MAX_QUERY_LENGTH = 500; // Maximum query length in characters

// Types
export interface SearchOptions {
  userId: string;
  maxResults?: number;
  minScore?: number;
  feedIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SearchResultArticle {
  id: string;
  title: string;
  excerpt: string | null;
  feedName: string;
  feedId: string;
  publishedAt: Date | null;
  relevanceScore: number;
  imageUrl?: string | null;
}

export interface SearchResult {
  articles: SearchResultArticle[];
  query: string;
  totalResults: number;
  processingTimeMs: number;
  fallbackUsed: boolean;
}

export interface QueryCacheEntry {
  query: string;
  embedding: number[];
  createdAt: Date;
  expiresAt: Date;
}

// ============================================================================
// Query Embedding Cache
// Requirements: 5.1 - Cache query embeddings for repeated searches
// ============================================================================

/**
 * In-memory cache for query embeddings
 * Key: normalized query string
 */
const queryEmbeddingCache = new Map<string, QueryCacheEntry>();

/**
 * Normalize query string for cache key
 */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Get cached query embedding if available and not expired
 * Requirements: 5.1 - Cache query embeddings for repeated searches
 */
export function getCachedQueryEmbedding(query: string): number[] | null {
  const normalizedQuery = normalizeQuery(query);
  const cached = queryEmbeddingCache.get(normalizedQuery);
  
  if (!cached) {
    return null;
  }
  
  // Check if cache has expired
  if (new Date() > cached.expiresAt) {
    queryEmbeddingCache.delete(normalizedQuery);
    return null;
  }
  
  return cached.embedding;
}

/**
 * Store query embedding in cache
 * Requirements: 5.1 - Cache query embeddings for repeated searches
 */
export function cacheQueryEmbedding(query: string, embedding: number[]): void {
  const normalizedQuery = normalizeQuery(query);
  const now = new Date();
  
  const entry: QueryCacheEntry = {
    query: normalizedQuery,
    embedding,
    createdAt: now,
    expiresAt: new Date(now.getTime() + QUERY_CACHE_TTL_MS),
  };
  
  queryEmbeddingCache.set(normalizedQuery, entry);
}

/**
 * Clear expired cache entries
 */
export function cleanupQueryCache(): number {
  const now = new Date();
  const keysToDelete: string[] = [];
  
  queryEmbeddingCache.forEach((entry, key) => {
    if (now > entry.expiresAt) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => queryEmbeddingCache.delete(key));
  return keysToDelete.length;
}

/**
 * Clear all cache entries (for testing)
 */
export function clearQueryCache(): void {
  queryEmbeddingCache.clear();
}

/**
 * Get cache statistics
 */
export function getQueryCacheStats(): {
  totalEntries: number;
  oldestEntry?: Date;
  newestEntry?: Date;
} {
  const entries = Array.from(queryEmbeddingCache.values());
  
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

// ============================================================================
// Query Embedding Generation
// Requirements: 5.1 - Convert search query to embedding using OpenAI
// ============================================================================

/**
 * Get embedding for a search query
 * Requirements: 5.1 - Convert search query to embedding using OpenAI
 * 
 * @param query - The search query string
 * @returns The embedding vector or null if unavailable
 */
export async function getQueryEmbedding(query: string): Promise<number[] | null> {
  // Validate query
  if (!query || query.trim().length === 0) {
    return null;
  }
  
  // Truncate long queries
  const truncatedQuery = query.slice(0, MAX_QUERY_LENGTH);
  
  // Check cache first
  const cached = getCachedQueryEmbedding(truncatedQuery);
  if (cached) {
    console.log(`📦 Query embedding cache hit for: "${truncatedQuery.slice(0, 50)}..."`);
    return cached;
  }
  
  // Check if embedding service is available
  if (!isEmbeddingServiceAvailable()) {
    console.warn('⚠️ Embedding service unavailable for query embedding');
    return null;
  }
  
  try {
    // Generate embedding using OpenAI
    const result = await generateEmbedding(truncatedQuery);
    
    if (!result) {
      return null;
    }
    
    // Cache the result
    cacheQueryEmbedding(truncatedQuery, result.embedding);
    
    console.log(`✅ Generated query embedding for: "${truncatedQuery.slice(0, 50)}..." (${result.tokenCount} tokens)`);
    
    return result.embedding;
  } catch (error) {
    console.error('❌ Failed to generate query embedding:', error);
    return null;
  }
}


// ============================================================================
// Semantic Search Logic
// Requirements: 5.2, 5.3, 5.5, 5.7
// Property 13: Semantic Search Result Constraints
// ============================================================================

/**
 * Perform semantic search on articles
 * 
 * Requirements: 5.2, 5.3, 5.5, 5.7
 * Property 13: Semantic Search Result Constraints
 * - (a) Results sorted by similarity score descending
 * - (b) All articles belong to user's subscribed feeds
 * - (c) Each result includes a relevance score
 * - (d) Result set contains at most 50 articles
 * - (e) Date/feed filters correctly applied
 * 
 * @param storage - Storage interface for database operations
 * @param query - The search query string
 * @param options - Search options (userId, filters, limits)
 * @returns Search results with relevance scores
 */
export async function semanticSearch(
  storage: IStorage,
  query: string,
  options: SearchOptions
): Promise<SearchResult> {
  const startTime = Date.now();
  const {
    userId,
    maxResults = MAX_SEARCH_RESULTS,
    minScore = MIN_SEARCH_SIMILARITY,
    feedIds,
    dateFrom,
    dateTo,
  } = options;
  
  // Get query embedding
  const queryEmbedding = await getQueryEmbedding(query);
  
  if (!queryEmbedding) {
    // Return empty result if embedding generation failed
    return {
      articles: [],
      query,
      totalResults: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: false,
    };
  }
  
  // Get user's subscribed feeds (Requirements: 5.3)
  const userFeeds = await storage.getUserFeeds(userId);
  
  if (userFeeds.length === 0) {
    return {
      articles: [],
      query,
      totalResults: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: false,
    };
  }
  
  // Determine which feed IDs to search
  // Property 13(e): Apply feed filter if specified
  let searchFeedIds: string[];
  if (feedIds && feedIds.length > 0) {
    // Filter to only include feeds the user is subscribed to
    const userFeedIdSet = new Set(userFeeds.map(f => f.id));
    searchFeedIds = feedIds.filter(id => userFeedIdSet.has(id));
    
    if (searchFeedIds.length === 0) {
      // User doesn't have access to any of the specified feeds
      return {
        articles: [],
        query,
        totalResults: 0,
        processingTimeMs: Date.now() - startTime,
        fallbackUsed: false,
      };
    }
  } else {
    searchFeedIds = userFeeds.map(f => f.id);
  }
  
  // Calculate hours back for date filtering
  let hoursBack = 168; // Default: 7 days
  if (dateFrom) {
    const now = new Date();
    const hoursDiff = Math.ceil((now.getTime() - dateFrom.getTime()) / (1000 * 60 * 60));
    hoursBack = Math.max(hoursDiff, 24); // At least 24 hours
  }
  
  // Get articles with embeddings from user's feeds
  const articlesWithEmbeddings = await storage.getArticlesWithEmbeddings(
    userId,
    searchFeedIds,
    hoursBack
  );
  
  if (articlesWithEmbeddings.length === 0) {
    return {
      articles: [],
      query,
      totalResults: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: false,
    };
  }
  
  // Calculate similarity scores and filter
  const scoredArticles: Array<{
    article: ArticleWithEmbedding;
    score: number;
  }> = [];
  
  for (const article of articlesWithEmbeddings) {
    // Skip articles without valid embeddings
    if (!article.embedding || article.embedding.length === 0) {
      continue;
    }
    
    // Property 13(e): Apply date range filter
    if (dateFrom && article.publishedAt && article.publishedAt < dateFrom) {
      continue;
    }
    if (dateTo && article.publishedAt && article.publishedAt > dateTo) {
      continue;
    }
    
    // Calculate cosine similarity
    try {
      const score = cosineSimilarity(queryEmbedding, article.embedding);
      
      // Only include if above minimum score threshold
      if (score >= minScore) {
        scoredArticles.push({ article, score });
      }
    } catch (error) {
      // Skip articles with incompatible embeddings
      console.warn(`Skipping article ${article.id} due to embedding error`);
      continue;
    }
  }
  
  // Property 13(a): Sort by similarity score descending
  scoredArticles.sort((a, b) => b.score - a.score);
  
  // Property 13(d): Limit to maxResults (default 50)
  const limitedResults = scoredArticles.slice(0, Math.min(maxResults, MAX_SEARCH_RESULTS));
  
  // Property 13(c): Map to result format with relevance scores
  const articles: SearchResultArticle[] = limitedResults.map(({ article, score }) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    feedName: article.feedName,
    feedId: article.feedId,
    publishedAt: article.publishedAt,
    relevanceScore: score,
    imageUrl: article.imageUrl,
  }));
  
  const processingTimeMs = Date.now() - startTime;
  
  console.log(`🔍 Semantic search for "${query.slice(0, 50)}..." found ${articles.length} results in ${processingTimeMs}ms`);
  
  return {
    articles,
    query,
    totalResults: articles.length,
    processingTimeMs,
    fallbackUsed: false,
  };
}


// ============================================================================
// Text Search Fallback
// Requirements: 5.8 - Fall back to text search when OpenAI unavailable
// ============================================================================

/**
 * Perform text-based search as fallback when semantic search is unavailable
 * 
 * Requirements: 5.8 - Fall back to text search when OpenAI unavailable
 * Uses simple text matching on title and excerpt fields
 * 
 * @param storage - Storage interface for database operations
 * @param query - The search query string
 * @param options - Search options (userId, filters, limits)
 * @returns Search results with relevance scores based on text matching
 */
export async function textSearchFallback(
  storage: IStorage,
  query: string,
  options: SearchOptions
): Promise<SearchResult> {
  const startTime = Date.now();
  const {
    userId,
    maxResults = MAX_SEARCH_RESULTS,
    feedIds,
    dateFrom,
    dateTo,
  } = options;
  
  // Get user's subscribed feeds
  const userFeeds = await storage.getUserFeeds(userId);
  
  if (userFeeds.length === 0) {
    return {
      articles: [],
      query,
      totalResults: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: true,
    };
  }
  
  // Determine which feed IDs to search
  let searchFeedIds: string[];
  if (feedIds && feedIds.length > 0) {
    const userFeedIdSet = new Set(userFeeds.map(f => f.id));
    searchFeedIds = feedIds.filter(id => userFeedIdSet.has(id));
    
    if (searchFeedIds.length === 0) {
      return {
        articles: [],
        query,
        totalResults: 0,
        processingTimeMs: Date.now() - startTime,
        fallbackUsed: true,
      };
    }
  } else {
    searchFeedIds = userFeeds.map(f => f.id);
  }
  
  // Get articles from user's feeds (without embeddings requirement)
  // We'll use the storage method to get articles and filter in memory
  const hoursBack = 168; // 7 days
  const articlesWithEmbeddings = await storage.getArticlesWithEmbeddings(
    userId,
    searchFeedIds,
    hoursBack
  );
  
  if (articlesWithEmbeddings.length === 0) {
    return {
      articles: [],
      query,
      totalResults: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: true,
    };
  }
  
  // Normalize query for text matching
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
  
  // Score articles based on text matching
  const scoredArticles: Array<{
    article: ArticleWithEmbedding;
    score: number;
  }> = [];
  
  for (const article of articlesWithEmbeddings) {
    // Apply date range filter
    if (dateFrom && article.publishedAt && article.publishedAt < dateFrom) {
      continue;
    }
    if (dateTo && article.publishedAt && article.publishedAt > dateTo) {
      continue;
    }
    
    // Calculate text match score
    const titleLower = article.title.toLowerCase();
    const excerptLower = (article.excerpt || '').toLowerCase();
    
    let score = 0;
    let matchedTerms = 0;
    
    for (const term of queryTerms) {
      // Title matches are weighted higher
      if (titleLower.includes(term)) {
        score += 0.3;
        matchedTerms++;
      }
      // Excerpt matches
      if (excerptLower.includes(term)) {
        score += 0.1;
        matchedTerms++;
      }
    }
    
    // Exact phrase match bonus
    if (titleLower.includes(queryLower)) {
      score += 0.4;
    }
    if (excerptLower.includes(queryLower)) {
      score += 0.2;
    }
    
    // Only include if there's at least one match
    if (score > 0) {
      // Normalize score to 0-1 range
      const normalizedScore = Math.min(score, 1);
      scoredArticles.push({ article, score: normalizedScore });
    }
  }
  
  // Sort by score descending
  scoredArticles.sort((a, b) => b.score - a.score);
  
  // Limit results
  const limitedResults = scoredArticles.slice(0, Math.min(maxResults, MAX_SEARCH_RESULTS));
  
  // Map to result format
  const articles: SearchResultArticle[] = limitedResults.map(({ article, score }) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    feedName: article.feedName,
    feedId: article.feedId,
    publishedAt: article.publishedAt,
    relevanceScore: score,
    imageUrl: article.imageUrl,
  }));
  
  const processingTimeMs = Date.now() - startTime;
  
  console.log(`📝 Text search fallback for "${query.slice(0, 50)}..." found ${articles.length} results in ${processingTimeMs}ms`);
  
  return {
    articles,
    query,
    totalResults: articles.length,
    processingTimeMs,
    fallbackUsed: true,
  };
}

// ============================================================================
// Search with Fallback
// Requirements: 5.8 - Fall back to text search when OpenAI unavailable
// ============================================================================

/**
 * Perform search with automatic fallback to text search
 * 
 * Requirements: 5.8 - Fall back to text search when OpenAI unavailable
 * Tries semantic search first, falls back to text search on failure
 * 
 * @param storage - Storage interface for database operations
 * @param query - The search query string
 * @param options - Search options (userId, filters, limits)
 * @returns Search results (semantic or text-based)
 */
export async function searchWithFallback(
  storage: IStorage,
  query: string,
  options: SearchOptions
): Promise<SearchResult> {
  // Check if embedding service is available
  if (!isEmbeddingServiceAvailable()) {
    console.warn('⚠️ Embedding service unavailable, using text search fallback');
    return textSearchFallback(storage, query, options);
  }
  
  try {
    // Try semantic search first
    const result = await semanticSearch(storage, query, options);
    
    // If semantic search returned results, use them
    if (result.articles.length > 0) {
      return result;
    }
    
    // If no results from semantic search, try text search as supplement
    console.log('🔄 No semantic search results, trying text search fallback');
    return textSearchFallback(storage, query, options);
    
  } catch (error) {
    console.error('❌ Semantic search failed, falling back to text search:', error);
    return textSearchFallback(storage, query, options);
  }
}


// ============================================================================
// Semantic Search Service Class
// ============================================================================

/**
 * Semantic Search Service Manager
 * 
 * Provides a higher-level interface for semantic search operations
 */
export class SemanticSearchService {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  /**
   * Perform semantic search
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7
   */
  async search(query: string, options: Omit<SearchOptions, 'userId'> & { userId: string }): Promise<SearchResult> {
    return searchWithFallback(this.storage, query, options);
  }
  
  /**
   * Get embedding for a query (for testing/debugging)
   * Requirements: 5.1
   */
  async getQueryEmbedding(query: string): Promise<number[] | null> {
    return getQueryEmbedding(query);
  }
  
  /**
   * Check if semantic search is available
   */
  isAvailable(): boolean {
    return isEmbeddingServiceAvailable();
  }
  
  /**
   * Get query cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    return getQueryCacheStats();
  }
  
  /**
   * Clean up expired cache entries
   */
  cleanupCache(): number {
    return cleanupQueryCache();
  }
}

/**
 * Create a semantic search service instance
 */
export function createSemanticSearchService(storage: IStorage): SemanticSearchService {
  return new SemanticSearchService(storage);
}
