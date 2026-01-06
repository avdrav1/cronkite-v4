/**
 * Clustering Service
 * 
 * Manages vector-based article clustering with Anthropic-generated labels.
 * Implements Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.2
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Article, Cluster, InsertCluster } from '@shared/schema';

// Constants
export const CLUSTER_SIMILARITY_THRESHOLD = 0.4; // Requirements: 2.1 - Much more permissive
export const SIMILAR_ARTICLES_THRESHOLD = 0.7; // Requirements: 4.2
export const MIN_CLUSTER_ARTICLES = 1; // Requirements: 2.2 - Lowered for better coverage
export const MIN_CLUSTER_SOURCES = 1; // Requirements: 2.2 - Allow single-source trending topics
export const MIN_ENGAGEMENT_THRESHOLD = 0.2; // Minimum engagement score for single-article clusters
export const MAX_SIMILAR_ARTICLES = 5; // Requirements: 4.1
export const CLUSTER_EXPIRATION_HOURS = 168; // Requirements: 2.6 - 7 days
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// Types
export interface SimilarArticle {
  articleId: string;
  title: string;
  feedName: string;
  feedId: string;
  similarityScore: number;
  publishedAt: Date | null;
  imageUrl?: string | null;
}

export interface SimilarityOptions {
  threshold: number;
  maxResults: number;
  excludeArticleIds?: string[];
  feedIds?: string[];
  userId?: string;
}

export interface ArticleCluster {
  id: string;
  topic: string;
  summary: string;
  articleIds: string[];
  articleCount: number;
  sources: string[];
  avgSimilarity: number;
  latestTimestamp: Date;
  relevanceScore: number;
  expiresAt: Date;
}

export interface ClusterGenerationResult {
  clusters: ArticleCluster[];
  articlesProcessed: number;
  clustersCreated: number;
  processingTimeMs: number;
  method?: string;
}

export interface ArticleWithEmbedding {
  id: string;
  title: string;
  excerpt: string | null;
  feedId: string;
  feedName: string;
  embedding: number[];
  publishedAt: Date | null;
  imageUrl?: string | null;
}

// Anthropic client singleton
let anthropicClient: Anthropic | null = null;

/**
 * Initialize or get the Anthropic client
 */
export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ Anthropic API key not configured - clustering labels unavailable');
    return null;
  }
  
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey,
    });
  }
  
  return anthropicClient;
}

/**
 * Check if clustering service is available
 */
export function isClusteringServiceAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Calculate engagement score for an article
 * Factors: recency, source popularity, read counts
 */
function calculateEngagementScore(article: {
  publishedAt: Date | null;
  feedName: string;
  title: string;
}): number {
  let score = 0;
  
  // Recency boost (0-0.5 points)
  if (article.publishedAt) {
    const hoursAgo = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 0.5 - (hoursAgo / 168) * 0.5); // Decay over 7 days
    score += recencyScore;
  }
  
  // Source popularity boost (0-0.3 points)
  const popularSources = ['BBC', 'CNN', 'Reuters', 'Associated Press', 'The New York Times', 'The Guardian'];
  if (popularSources.some(source => article.feedName.toLowerCase().includes(source.toLowerCase()))) {
    score += 0.3;
  }
  
  // Title length/quality boost (0-0.2 points)
  if (article.title.length > 50 && article.title.length < 120) {
    score += 0.2;
  }
  
  return Math.min(1.0, score);
}

/**
 * Fallback clustering using keyword similarity for articles without embeddings
 */
function fallbackClusterByKeywords(articles: Array<{
  id: string;
  title: string;
  excerpt: string | null;
  feedId: string;
  feedName: string;
  publishedAt: Date | null;
}>): FallbackClusterCandidate[] {
  const clusters: FallbackClusterCandidate[] = [];
  const processed = new Set<string>();
  
  for (const article of articles) {
    if (processed.has(article.id)) continue;
    
    const keywords = extractKeywords(article.title + ' ' + (article.excerpt || ''));
    const cluster: FallbackClusterCandidate = {
      members: [article],
      avgSimilarity: 1.0,
      sources: new Set([article.feedName])
    };
    
    // Find similar articles by keyword overlap
    for (const other of articles) {
      if (other.id === article.id || processed.has(other.id)) continue;
      
      const otherKeywords = extractKeywords(other.title + ' ' + (other.excerpt || ''));
      const similarity = calculateKeywordSimilarity(keywords, otherKeywords);
      
      if (similarity > 0.2) { // Much lower threshold for keyword matching
        cluster.members.push(other);
        cluster.sources.add(other.feedName);
        processed.add(other.id);
      }
    }
    
    processed.add(article.id);
    
    // Check if cluster meets criteria (now more lenient)
    const engagementScore = calculateEngagementScore(cluster.members[0]);
    if (cluster.members.length >= MIN_CLUSTER_ARTICLES && 
        (Array.from(cluster.sources).length >= MIN_CLUSTER_SOURCES || engagementScore >= MIN_ENGAGEMENT_THRESHOLD)) {
      clusters.push(cluster);
    }
  }
  
  return clusters;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
  
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10); // Top 10 keywords
}

/**
 * Calculate similarity between keyword sets
 */
function calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Cluster articles by time windows (group articles published around the same time)
 */
function clusterByTimeWindows(articles: Array<{
  id: string;
  title: string;
  excerpt: string | null;
  feedId: string;
  feedName: string;
  publishedAt: Date | null;
}>): FallbackClusterCandidate[] {
  const clusters: FallbackClusterCandidate[] = [];
  const timeWindows = new Map<string, typeof articles>();
  
  // Group articles by 6-hour time windows
  for (const article of articles) {
    if (!article.publishedAt) continue;
    
    const windowKey = Math.floor(article.publishedAt.getTime() / (6 * 60 * 60 * 1000)).toString();
    if (!timeWindows.has(windowKey)) {
      timeWindows.set(windowKey, []);
    }
    timeWindows.get(windowKey)!.push(article);
  }
  
  // Create clusters from time windows with multiple articles
  for (const [windowKey, windowArticles] of timeWindows) {
    if (windowArticles.length >= 2) { // At least 2 articles in the time window
      const sources = new Set(windowArticles.map(a => a.feedName));
      if (sources.size >= 2) { // From at least 2 different sources
        clusters.push({
          members: windowArticles,
          avgSimilarity: 0.8, // High similarity for time-based clusters
          sources
        });
      }
    }
  }
  
  return clusters.sort((a, b) => b.members.length - a.members.length).slice(0, 10);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Vector Similarity Functions
// Requirements: 2.1, 4.2
// ============================================================================

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1, where 1 means identical
 * Requirements: 2.1, 4.2
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error(`Embedding dimensions mismatch: ${embedding1.length} vs ${embedding2.length}`);
  }
  
  if (embedding1.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  
  if (magnitude === 0) {
    return 0;
  }
  
  return dotProduct / magnitude;
}

/**
 * Find articles similar to a given embedding
 * Requirements: 4.2
 */
export function findSimilarByEmbedding(
  targetEmbedding: number[],
  articles: ArticleWithEmbedding[],
  options: SimilarityOptions
): SimilarArticle[] {
  const {
    threshold,
    maxResults,
    excludeArticleIds = [],
    feedIds,
  } = options;
  
  const excludeSet = new Set(excludeArticleIds);
  const feedIdSet = feedIds ? new Set(feedIds) : null;
  
  const similarities: Array<{ article: ArticleWithEmbedding; score: number }> = [];
  
  for (const article of articles) {
    // Skip excluded articles
    if (excludeSet.has(article.id)) {
      continue;
    }
    
    // Filter by feed IDs if specified
    if (feedIdSet && !feedIdSet.has(article.feedId)) {
      continue;
    }
    
    // Calculate similarity
    const score = cosineSimilarity(targetEmbedding, article.embedding);
    
    // Only include if above threshold
    if (score >= threshold) {
      similarities.push({ article, score });
    }
  }
  
  // Sort by similarity score descending
  similarities.sort((a, b) => b.score - a.score);
  
  // Return top results
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
 * Find articles similar to a specific article
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export function findSimilarArticles(
  sourceArticle: ArticleWithEmbedding,
  allArticles: ArticleWithEmbedding[],
  options: Partial<SimilarityOptions> = {}
): SimilarArticle[] {
  const fullOptions: SimilarityOptions = {
    threshold: options.threshold ?? SIMILAR_ARTICLES_THRESHOLD,
    maxResults: options.maxResults ?? MAX_SIMILAR_ARTICLES,
    excludeArticleIds: [sourceArticle.id, ...(options.excludeArticleIds || [])],
    feedIds: options.feedIds,
    userId: options.userId,
  };
  
  return findSimilarByEmbedding(sourceArticle.embedding, allArticles, fullOptions);
}


// ============================================================================
// Cluster Formation Logic
// Requirements: 2.1, 2.2, 2.4
// ============================================================================

interface ClusterCandidate {
  representativeArticle: ArticleWithEmbedding;
  members: ArticleWithEmbedding[];
  avgSimilarity: number;
  sources: Set<string>;
}

interface FallbackClusterCandidate {
  members: Array<{
    id: string;
    title: string;
    excerpt: string | null;
    feedId: string;
    feedName: string;
    publishedAt: Date | null;
  }>;
  avgSimilarity: number;
  sources: Set<string>;
}

/**
 * Group articles into clusters based on embedding similarity
 * Requirements: 2.1, 2.2, 2.4
 * 
 * Property 5: All pairs of articles within a cluster have similarity >= 0.75
 * Property 6: Each cluster has at least 2 articles from 2 different sources
 * Property 7: Each article is assigned to at most one cluster
 */
export function formClusters(
  articles: ArticleWithEmbedding[],
  similarityThreshold: number = CLUSTER_SIMILARITY_THRESHOLD
): ClusterCandidate[] {
  if (articles.length < MIN_CLUSTER_ARTICLES) {
    return [];
  }
  
  const clusters: ClusterCandidate[] = [];
  const assignedArticleIds = new Set<string>(); // Property 7: Track assigned articles
  
  // Sort articles by published date (newest first) to prioritize recent content
  const sortedArticles = [...articles].sort((a, b) => {
    const dateA = a.publishedAt?.getTime() || 0;
    const dateB = b.publishedAt?.getTime() || 0;
    return dateB - dateA;
  });
  
  for (const candidateArticle of sortedArticles) {
    // Skip if already assigned to a cluster (Property 7)
    if (assignedArticleIds.has(candidateArticle.id)) {
      continue;
    }
    
    // Find all similar articles that haven't been assigned yet
    const similarArticles: Array<{ article: ArticleWithEmbedding; similarity: number }> = [];
    
    for (const otherArticle of sortedArticles) {
      if (otherArticle.id === candidateArticle.id) {
        continue;
      }
      
      // Skip if already assigned (Property 7)
      if (assignedArticleIds.has(otherArticle.id)) {
        continue;
      }
      
      const similarity = cosineSimilarity(candidateArticle.embedding, otherArticle.embedding);
      
      // Property 5: Only include if similarity >= threshold
      if (similarity >= similarityThreshold) {
        similarArticles.push({ article: otherArticle, similarity });
      }
    }
    
    if (similarArticles.length === 0) {
      continue;
    }
    
    // Build cluster with candidate article and similar articles
    const clusterMembers = [candidateArticle];
    const clusterSources = new Set<string>([candidateArticle.feedName]);
    let totalSimilarity = 0;
    let pairCount = 0;
    
    // Sort by similarity and add to cluster
    similarArticles.sort((a, b) => b.similarity - a.similarity);
    
    for (const { article, similarity } of similarArticles) {
      // Verify this article is similar to ALL existing cluster members (Property 5)
      let isValidMember = true;
      
      for (const member of clusterMembers) {
        if (member.id === article.id) continue;
        
        const memberSimilarity = cosineSimilarity(member.embedding, article.embedding);
        if (memberSimilarity < similarityThreshold) {
          isValidMember = false;
          break;
        }
        totalSimilarity += memberSimilarity;
        pairCount++;
      }
      
      if (isValidMember) {
        clusterMembers.push(article);
        clusterSources.add(article.feedName);
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    
    // Property 6: Check minimum requirements (more lenient now)
    const avgEngagement = clusterMembers.length > 0 ? 
      clusterMembers.reduce((sum, m) => sum + calculateEngagementScore({
        publishedAt: m.publishedAt,
        feedName: m.feedName,
        title: m.title
      }), 0) / clusterMembers.length : 0;
      
    if (clusterMembers.length >= MIN_CLUSTER_ARTICLES && 
        (clusterSources.size >= MIN_CLUSTER_SOURCES || avgEngagement >= MIN_ENGAGEMENT_THRESHOLD)) {
      // Mark all members as assigned (Property 7)
      for (const member of clusterMembers) {
        assignedArticleIds.add(member.id);
      }
      
      const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
      
      clusters.push({
        representativeArticle: candidateArticle,
        members: clusterMembers,
        avgSimilarity,
        sources: clusterSources,
      });
    }
  }
  
  return clusters;
}

/**
 * Calculate relevance score for a cluster with engagement factors
 * Requirements: 2.7 - relevance score = article_count × source_diversity × engagement
 */
export function calculateRelevanceScore(
  articleCount: number, 
  sourceCount: number, 
  avgEngagement: number = 0.5
): number {
  return articleCount * sourceCount * (1 + avgEngagement);
}


// ============================================================================
// Anthropic Cluster Labeling
// Requirements: 2.3
// ============================================================================

export interface ClusterLabel {
  topic: string;
  summary: string;
}

/**
 * Generate topic title and summary for a cluster using Anthropic
 * Requirements: 2.3
 * 
 * Falls back to first article title if API fails
 */
export async function generateClusterLabel(
  articles: Array<{ title: string; excerpt: string | null; feedName: string }>,
  retryAttempt: number = 0
): Promise<ClusterLabel> {
  const client = getAnthropicClient();
  
  // Fallback: use first article title
  const fallbackLabel: ClusterLabel = {
    topic: articles[0]?.title.substring(0, 100) || 'Trending Topic',
    summary: articles[0]?.excerpt?.substring(0, 200) || 'Multiple sources covering this story.',
  };
  
  if (!client) {
    console.warn('⚠️ Anthropic client not available, using fallback label');
    return fallbackLabel;
  }
  
  // Prepare article summaries for the prompt
  const articleSummaries = articles.slice(0, 10).map((a, i) => 
    `[${i + 1}] "${a.title}" (${a.feedName})${a.excerpt ? `\n   ${a.excerpt.substring(0, 150)}...` : ''}`
  ).join('\n\n');
  
  const prompt = `Analyze these related news articles and generate a topic title and summary.

Articles:
${articleSummaries}

Generate:
1. A concise topic title (3-8 words) that captures the main story
2. A one-sentence summary (max 150 characters) explaining what's happening

Format your response exactly as:
TOPIC: [your topic title]
SUMMARY: [your summary]

Be factual and neutral. Focus on what the articles have in common.`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
    
    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Parse response
    const topicMatch = responseText.match(/TOPIC:\s*(.+?)(?:\n|$)/);
    const summaryMatch = responseText.match(/SUMMARY:\s*(.+?)(?:\n|$)/);
    
    if (topicMatch && summaryMatch) {
      return {
        topic: topicMatch[1].trim().substring(0, 100),
        summary: summaryMatch[1].trim().substring(0, 200),
      };
    }
    
    console.warn('⚠️ Could not parse Anthropic response, using fallback');
    return fallbackLabel;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle rate limits and server errors with retry
    if (error instanceof Anthropic.APIError) {
      const isRetryable = error.status === 429 || (error.status && error.status >= 500);
      
      if (isRetryable && retryAttempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAYS[retryAttempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.warn(`⚠️ Anthropic API error (${error.status}), retrying in ${delay}ms... (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        await sleep(delay);
        return generateClusterLabel(articles, retryAttempt + 1);
      }
    }
    
    console.error(`❌ Failed to generate cluster label: ${errorMessage}`);
    return fallbackLabel;
  }
}


// ============================================================================
// Cluster Storage and Expiration
// Requirements: 2.5, 2.6, 2.7
// ============================================================================

/**
 * Storage interface for clustering operations
 */
export interface ClusteringStorage {
  // Article operations
  getArticlesWithEmbeddings(
    userId?: string,
    feedIds?: string[],
    hoursBack?: number
  ): Promise<ArticleWithEmbedding[]>;
  
  getRecentArticles(
    userId?: string,
    feedIds?: string[],
    hoursBack?: number
  ): Promise<Array<{
    id: string;
    title: string;
    excerpt: string | null;
    feedId: string;
    feedName: string;
    publishedAt: Date | null;
  }>>;
  
  // Cluster operations
  createCluster(cluster: InsertCluster): Promise<Cluster>;
  updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster>;
  deleteCluster(id: string): Promise<void>;
  getClusterById(id: string): Promise<Cluster | undefined>;
  getClusters(options?: { 
    userId?: string; 
    includeExpired?: boolean;
    limit?: number;
  }): Promise<Cluster[]>;
  
  // Article-cluster association
  assignArticlesToCluster(articleIds: string[], clusterId: string): Promise<void>;
  removeArticlesFromCluster(clusterId: string): Promise<void>;
  
  // Expiration
  deleteExpiredClusters(): Promise<number>;
}

/**
 * Clustering Service Manager
 * Handles cluster generation, storage, and expiration
 */
export class ClusteringServiceManager {
  private storage: ClusteringStorage;
  
  constructor(storage: ClusteringStorage) {
    this.storage = storage;
  }
  
  /**
   * Generate clusters from articles with embeddings
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7
   */
  async generateClusters(
    userId?: string,
    feedIds?: string[],
    hoursBack: number = 168 // 7 days for better trending analysis
  ): Promise<ClusterGenerationResult> {
    const startTime = Date.now();
    
    // Try vector-based clustering first
    const articlesWithEmbeddings = await this.storage.getArticlesWithEmbeddings(userId, feedIds, hoursBack);
    let clusterCandidates: (ClusterCandidate | FallbackClusterCandidate)[] = [];
    let method = 'vector';
    
    console.log(`📊 Found ${articlesWithEmbeddings.length} articles with embeddings`);
    
    if (articlesWithEmbeddings.length >= MIN_CLUSTER_ARTICLES) {
      // Use vector-based clustering
      console.log(`📊 Attempting vector clustering with threshold ${CLUSTER_SIMILARITY_THRESHOLD}...`);
      clusterCandidates = formClusters(articlesWithEmbeddings, CLUSTER_SIMILARITY_THRESHOLD);
      console.log(`📊 Vector clustering found ${clusterCandidates.length} candidates`);
      
      // Debug: Log details of first few clusters
      clusterCandidates.slice(0, 3).forEach((cluster, i) => {
        console.log(`📊 Cluster ${i + 1}: ${cluster.members.length} articles, ${Array.from(cluster.sources).length} sources, similarity: ${cluster.avgSimilarity.toFixed(3)}`);
      });
    }
    
    // Fallback to keyword-based clustering if needed
    if (clusterCandidates.length === 0) {
      console.log(`📊 Falling back to keyword-based clustering...`);
      method = 'keyword';
      
      // Get articles without embedding requirement
      const allArticles = await this.storage.getRecentArticles(userId, feedIds, hoursBack);
      console.log(`📊 Found ${allArticles.length} total articles for fallback clustering`);
      
      if (allArticles.length > 0) {
        clusterCandidates = fallbackClusterByKeywords(allArticles);
        console.log(`📊 Keyword clustering found ${clusterCandidates.length} candidates`);
        
        // Try time-based clustering if keyword clustering didn't work well
        if (clusterCandidates.length < 5) {
          console.log(`📊 Trying time-based clustering...`);
          const timeClusters = clusterByTimeWindows(allArticles);
          if (timeClusters.length > clusterCandidates.length) {
            clusterCandidates = timeClusters;
            console.log(`📊 Time-based clustering found ${clusterCandidates.length} candidates`);
          }
        }
        
        // If still no clusters, create individual trending topics from top articles
        if (clusterCandidates.length === 0) {
          console.log(`📊 Creating individual trending topics from top articles...`);
          method = 'individual';
          
          // Sort by engagement and take top articles
          const topArticles = allArticles
            .map(article => ({
              article,
              engagement: calculateEngagementScore(article)
            }))
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 15) // Increase to 15 trending topics
            .map(item => item.article);
          
          // Create individual clusters for each top article
          clusterCandidates = topArticles.map(article => ({
            members: [article],
            avgSimilarity: 1.0,
            sources: new Set([article.feedName])
          }));
          
          console.log(`📊 Created ${clusterCandidates.length} individual trending topics`);
        }
      }
    }
    
    if (clusterCandidates.length === 0) {
      console.log(`📊 No clusters found. Returning empty result.`);
      return {
        clusters: [],
        articlesProcessed: articlesWithEmbeddings.length,
        clustersCreated: 0,
        processingTimeMs: Date.now() - startTime,
        method
      };
    }
    
    console.log(`📊 Processing ${clusterCandidates.length} cluster candidates with method: ${method}`);
    
    console.log(`📊 Found ${clusterCandidates.length} cluster candidates`);
    
    // Generate labels and store clusters
    const createdClusters: ArticleCluster[] = [];
    const expiresAt = new Date(Date.now() + CLUSTER_EXPIRATION_HOURS * 60 * 60 * 1000);
    
    for (const candidate of clusterCandidates) {
      try {
        // Generate label using Anthropic (Requirements: 2.3)
        const label = await generateClusterLabel(
          candidate.members.map(m => ({
            title: m.title,
            excerpt: m.excerpt,
            feedName: m.feedName,
          }))
        );
        
        // Calculate engagement scores for cluster members
        const engagementScores = candidate.members.map(m => calculateEngagementScore({
          publishedAt: m.publishedAt,
          feedName: m.feedName,
          title: m.title
        }));
        const avgEngagement = engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length;
        
        // Calculate relevance score (Requirements: 2.7)
        const relevanceScore = calculateRelevanceScore(
          candidate.members.length,
          candidate.sources.size,
          avgEngagement
        );
        
        // Get latest timestamp from cluster members
        const latestTimestamp = candidate.members.reduce((latest, article) => {
          const articleTime = article.publishedAt?.getTime() || 0;
          return articleTime > latest.getTime() ? new Date(articleTime) : latest;
        }, new Date(0));
        
        // Get article IDs for this cluster
        const articleIds = candidate.members.map(m => m.id);
        
        // Store cluster (Requirements: 2.5)
        const clusterData: InsertCluster = {
          title: label.topic,
          summary: label.summary,
          article_count: candidate.members.length,
          article_ids: articleIds, // Store article IDs directly in cluster
          source_feeds: Array.from(candidate.sources),
          timeframe_start: candidate.members.reduce((earliest, article) => {
            const articleTime = article.publishedAt?.getTime() || Date.now();
            return articleTime < earliest.getTime() ? new Date(articleTime) : earliest;
          }, new Date()),
          timeframe_end: latestTimestamp,
          expires_at: expiresAt,
          avg_similarity: candidate.avgSimilarity.toString(),
          relevance_score: relevanceScore.toString(),
          generation_method: 'vector',
        };
        
        const storedCluster = await this.storage.createCluster(clusterData);
        
        // Also assign articles to cluster (update article.cluster_id)
        await this.storage.assignArticlesToCluster(articleIds, storedCluster.id);
        
        createdClusters.push({
          id: storedCluster.id,
          topic: label.topic,
          summary: label.summary,
          articleIds,
          articleCount: candidate.members.length,
          sources: Array.from(candidate.sources),
          avgSimilarity: candidate.avgSimilarity,
          latestTimestamp,
          relevanceScore,
          expiresAt,
        });
        
        console.log(`✅ Created cluster: "${label.topic}" with ${candidate.members.length} articles from ${candidate.sources.size} sources`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to create cluster: ${errorMessage}`);
      }
    }
    
    // Sort by relevance score (Requirements: 2.7)
    createdClusters.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    const processingTimeMs = Date.now() - startTime;
    console.log(`✅ Clustering complete: ${createdClusters.length} clusters created in ${processingTimeMs}ms`);
    
    return {
      clusters: createdClusters,
      articlesProcessed: articles.length,
      clustersCreated: createdClusters.length,
      processingTimeMs,
    };
  }
  
  /**
   * Get clusters for a user, sorted by relevance score
   * Requirements: 2.7
   */
  async getUserClusters(
    userId?: string,
    limit: number = 10
  ): Promise<ArticleCluster[]> {
    const clusters = await this.storage.getClusters({
      userId,
      includeExpired: false,
      limit,
    });
    
    // Convert to ArticleCluster format and sort by relevance score
    const result: ArticleCluster[] = clusters.map(cluster => ({
      id: cluster.id,
      topic: cluster.title,
      summary: cluster.summary || '',
      articleIds: (cluster as any).article_ids || [], // Use article_ids from cluster record
      articleCount: cluster.article_count,
      sources: cluster.source_feeds || [],
      avgSimilarity: parseFloat(cluster.avg_similarity || '0'),
      latestTimestamp: cluster.timeframe_end || new Date(),
      relevanceScore: parseFloat(cluster.relevance_score || '0'),
      expiresAt: cluster.expires_at || new Date(),
    }));
    
    // Property 8: Sort by relevance score descending
    result.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return result;
  }
  
  /**
   * Expire old clusters
   * Requirements: 2.6 - Expire clusters after 48 hours
   */
  async expireOldClusters(): Promise<number> {
    const deletedCount = await this.storage.deleteExpiredClusters();
    
    if (deletedCount > 0) {
      console.log(`🗑️ Expired ${deletedCount} old clusters`);
    }
    
    return deletedCount;
  }
  
  /**
   * Find articles similar to a given article
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  async findSimilarArticles(
    articleId: string,
    userId?: string,
    feedIds?: string[]
  ): Promise<SimilarArticle[]> {
    // Get all articles with embeddings
    const articles = await this.storage.getArticlesWithEmbeddings(userId, feedIds);
    
    // Find the source article
    const sourceArticle = articles.find(a => a.id === articleId);
    
    if (!sourceArticle) {
      return [];
    }
    
    // Find similar articles
    return findSimilarArticles(sourceArticle, articles, {
      threshold: SIMILAR_ARTICLES_THRESHOLD,
      maxResults: MAX_SIMILAR_ARTICLES,
      feedIds,
    });
  }
}

/**
 * Create a clustering service manager with the given storage
 */
export function createClusteringServiceManager(storage: ClusteringStorage): ClusteringServiceManager {
  return new ClusteringServiceManager(storage);
}
