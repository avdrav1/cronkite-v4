/**
 * Production RSS Sync Service
 * 
 * Enhanced RSS synchronization service with production-grade error handling,
 * retry logic, batch processing, and rate limiting.
 * 
 * Requirements: 3.2, 3.3, 3.5
 */

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { storage } from './storage.js';
import type { Feed, Article, InsertArticle } from '@shared/schema';
import type { ProductionFeedConfig } from './production-feeds';
import { validateFeedUrl, validateFeedContent } from './feed-validation';

// Enhanced RSS parser configuration for production
const parser = new Parser({
  timeout: 30000, // 30 second timeout for production
  headers: {
    'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
    'Accept-Encoding': 'gzip, deflate',
    'Cache-Control': 'no-cache'
  },
  customFields: {
    feed: ['language', 'generator', 'docs', 'managingEditor', 'webMaster'],
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['description', 'description'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
      ['dc:date', 'dcDate'],
      ['category', 'categories']
    ]
  }
});

export interface ProductionSyncResult {
  success: boolean;
  articlesFound: number;
  articlesNew: number;
  articlesUpdated: number;
  articlesSkipped: number;
  error?: string;
  httpStatusCode?: number;
  feedSizeBytes?: number;
  etag?: string;
  lastModified?: string;
  syncDuration: number;
  retryCount: number;
  validationPassed: boolean;
}

export interface ProductionSyncOptions {
  maxArticles?: number;
  respectEtag?: boolean;
  respectLastModified?: boolean;
  validateContent?: boolean;
  skipDuplicates?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface BatchSyncOptions extends ProductionSyncOptions {
  batchSize?: number;
  delayMs?: number;
  maxConcurrent?: number;
  failFast?: boolean;
  onProgress?: (completed: number, total: number, current: string) => void;
  onError?: (feed: Feed | ProductionFeedConfig, error: string) => void;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

/**
 * Rate limiter for production RSS sync
 */
class RateLimiter {
  private requests: number[] = [];
  private burstCount = 0;
  private lastReset = Date.now();
  
  constructor(private config: RateLimitConfig) {}
  
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    
    // Reset burst count every minute
    if (now - this.lastReset > 60000) {
      this.burstCount = 0;
      this.lastReset = now;
      this.requests = [];
    }
    
    // Remove requests older than 1 minute
    this.requests = this.requests.filter(time => now - time < 60000);
    
    // Check if we need to wait
    if (this.requests.length >= this.config.requestsPerMinute || 
        this.burstCount >= this.config.burstLimit) {
      
      const oldestRequest = Math.min(...this.requests);
      const waitTime = Math.min(
        60000 - (now - oldestRequest), // Wait until oldest request expires
        this.config.maxBackoffMs
      );
      
      if (waitTime > 0) {
        console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Record this request
    this.requests.push(now);
    this.burstCount++;
  }
}

/**
 * Default rate limit configuration for production
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerMinute: 30, // Conservative rate limit
  burstLimit: 10,       // Allow bursts of up to 10 requests
  backoffMultiplier: 1.5,
  maxBackoffMs: 30000   // Max 30 second wait
};

/**
 * Production-grade RSS feed synchronization with enhanced error handling
 */
export async function syncFeedProduction(
  feed: Feed | ProductionFeedConfig, 
  options: ProductionSyncOptions = {}
): Promise<ProductionSyncResult> {
  const startTime = Date.now();
  const syncLogId = await storage.startFeedSync(feed.id);
  let retryCount = 0;
  
  const {
    maxArticles = 100,
    respectEtag = true,
    respectLastModified = true,
    validateContent = true,
    skipDuplicates = true,
    maxRetries = 3,
    retryDelayMs = 1000,
    timeoutMs = 30000
  } = options;
  
  try {
    console.log(`🔄 Starting production sync for feed: ${feed.name} (${feed.url})`);
    
    // Pre-sync validation if enabled
    let validationPassed = true;
    if (validateContent) {
      console.log(`🔍 Validating feed content before sync...`);
      const healthCheck = await validateFeedUrl(feed.url);
      const contentCheck = await validateFeedContent(feed.url);
      
      if (!healthCheck.healthy || !contentCheck.isValid) {
        validationPassed = false;
        const error = `Validation failed: ${healthCheck.error || contentCheck.errors.join(', ')}`;
        
        await storage.completeFeedSyncError(syncLogId, error, healthCheck.statusCode);
        
        return {
          success: false,
          articlesFound: 0,
          articlesNew: 0,
          articlesUpdated: 0,
          articlesSkipped: 0,
          error,
          httpStatusCode: healthCheck.statusCode,
          syncDuration: Date.now() - startTime,
          retryCount: 0,
          validationPassed: false
        };
      }
    }
    
    // Sync with retry logic
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      retryCount = attempt - 1;
      
      try {
        console.log(`📡 Sync attempt ${attempt}/${maxRetries} for ${feed.name}`);
        
        // Parse the RSS feed with enhanced error handling
        const parseResult = await parseRSSFeedProduction(feed.url, {
          etag: respectEtag ? ('etag' in feed ? feed.etag : null) : null,
          lastModified: respectLastModified ? ('last_modified' in feed ? feed.last_modified : null) : null,
          timeoutMs
        });
        
        if (!parseResult.success) {
          throw new Error(parseResult.error || 'Failed to parse RSS feed');
        }
        
        const { feedData, httpStatusCode, feedSizeBytes, etag, lastModified } = parseResult;
        
        // Process articles with enhanced duplicate handling
        const processResult = await processArticlesProduction(
          feed, 
          feedData.items || [], 
          { maxArticles, skipDuplicates }
        );
        
        // Complete sync successfully
        await storage.completeFeedSyncSuccess(syncLogId, {
          httpStatusCode,
          articlesFound: processResult.articlesFound,
          articlesNew: processResult.articlesNew,
          articlesUpdated: processResult.articlesUpdated,
          etagReceived: etag,
          lastModifiedReceived: lastModified,
          feedSizeBytes
        });
        
        const syncDuration = Date.now() - startTime;
        
        console.log(`✅ Production sync completed for ${feed.name}: ${processResult.articlesNew} new, ${processResult.articlesUpdated} updated (${syncDuration}ms)`);
        
        return {
          success: true,
          articlesFound: processResult.articlesFound,
          articlesNew: processResult.articlesNew,
          articlesUpdated: processResult.articlesUpdated,
          articlesSkipped: processResult.articlesSkipped,
          httpStatusCode,
          feedSizeBytes,
          etag,
          lastModified,
          syncDuration,
          retryCount,
          validationPassed
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          // Final attempt failed
          break;
        }
        
        // Calculate exponential backoff delay
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`⚠️ Attempt ${attempt} failed for ${feed.name}, retrying in ${delay}ms: ${lastError.message}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All retries failed
    const errorMessage = lastError?.message || 'All retry attempts failed';
    console.error(`❌ Production sync failed for ${feed.name} after ${maxRetries} attempts: ${errorMessage}`);
    
    await storage.completeFeedSyncError(syncLogId, errorMessage);
    
    return {
      success: false,
      articlesFound: 0,
      articlesNew: 0,
      articlesUpdated: 0,
      articlesSkipped: 0,
      error: errorMessage,
      syncDuration: Date.now() - startTime,
      retryCount,
      validationPassed
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`❌ Critical error in production sync for ${feed.name}: ${errorMessage}`);
    
    await storage.completeFeedSyncError(syncLogId, errorMessage);
    
    return {
      success: false,
      articlesFound: 0,
      articlesNew: 0,
      articlesUpdated: 0,
      articlesSkipped: 0,
      error: errorMessage,
      syncDuration: Date.now() - startTime,
      retryCount,
      validationPassed: false
    };
  }
}

/**
 * Production batch synchronization with advanced rate limiting and error resilience
 */
export async function syncFeedsProduction(
  feeds: (Feed | ProductionFeedConfig)[], 
  options: BatchSyncOptions = {}
): Promise<ProductionSyncResult[]> {
  
  const {
    batchSize = 3,           // Smaller batch size for production
    delayMs = 5000,          // Longer delay between batches
    maxConcurrent = 2,       // Limit concurrent requests
    failFast = false,        // Continue on errors by default
    onProgress,
    onError,
    ...syncOptions
  } = options;
  
  const results: ProductionSyncResult[] = [];
  const rateLimiter = new RateLimiter(DEFAULT_RATE_LIMIT);
  
  console.log(`🚀 Starting production batch sync for ${feeds.length} feeds`);
  console.log(`📊 Configuration: batchSize=${batchSize}, delayMs=${delayMs}, maxConcurrent=${maxConcurrent}`);
  
  // Process feeds in batches with rate limiting
  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(feeds.length / batchSize);
    
    console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} feeds)`);
    
    // Process batch with concurrency control
    const batchPromises = batch.map(async (feed, index) => {
      try {
        // Rate limiting
        await rateLimiter.waitForSlot();
        
        // Progress callback
        if (onProgress) {
          onProgress(i + index + 1, feeds.length, feed.name);
        }
        
        // Sync the feed
        const result = await syncFeedProduction(feed, syncOptions);
        
        // Log result
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${feed.name}: ${result.articlesNew} new, ${result.articlesUpdated} updated (${result.syncDuration}ms)`);
        
        if (!result.success && onError) {
          onError(feed, result.error || 'Unknown error');
        }
        
        return result;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Batch processing error for ${feed.name}: ${errorMessage}`);
        
        if (onError) {
          onError(feed, errorMessage);
        }
        
        if (failFast) {
          throw error;
        }
        
        // Return error result
        return {
          success: false,
          articlesFound: 0,
          articlesNew: 0,
          articlesUpdated: 0,
          articlesSkipped: 0,
          error: errorMessage,
          syncDuration: 0,
          retryCount: 0,
          validationPassed: false
        } as ProductionSyncResult;
      }
    });
    
    // Wait for batch to complete
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Log batch summary
      const batchSuccess = batchResults.filter(r => r.success).length;
      const batchNew = batchResults.reduce((sum, r) => sum + r.articlesNew, 0);
      console.log(`📦 Batch ${batchNumber} completed: ${batchSuccess}/${batch.length} successful, ${batchNew} new articles`);
      
    } catch (error) {
      if (failFast) {
        console.error(`❌ Batch processing failed, stopping due to failFast mode`);
        throw error;
      }
      
      console.error(`❌ Batch ${batchNumber} had errors, continuing...`);
    }
    
    // Add delay between batches (except for the last batch)
    if (i + batchSize < feeds.length && delayMs > 0) {
      console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Final summary
  const totalSuccess = results.filter(r => r.success).length;
  const totalNew = results.reduce((sum, r) => sum + r.articlesNew, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.articlesUpdated, 0);
  const avgDuration = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.syncDuration, 0) / results.length) : 0;
  
  console.log(`🎉 Production batch sync completed:`);
  console.log(`   📊 Success rate: ${totalSuccess}/${feeds.length} (${Math.round(totalSuccess / feeds.length * 100)}%)`);
  console.log(`   📰 Articles: ${totalNew} new, ${totalUpdated} updated`);
  console.log(`   ⏱️  Average duration: ${avgDuration}ms per feed`);
  
  return results;
}

/**
 * Enhanced RSS feed parsing with production-grade error handling
 */
async function parseRSSFeedProduction(url: string, options: {
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
} = {}): Promise<{
  success: boolean;
  feedData?: any;
  httpStatusCode?: number;
  feedSizeBytes?: number;
  etag?: string;
  lastModified?: string;
  error?: string;
}> {
  
  const { etag, lastModified, timeoutMs = 30000 } = options;
  
  try {
    // Create fetch options with enhanced headers
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      signal: AbortSignal.timeout(timeoutMs)
    };
    
    // Add conditional headers if available
    if (etag) {
      (fetchOptions.headers as Record<string, string>)['If-None-Match'] = etag;
    }
    if (lastModified) {
      (fetchOptions.headers as Record<string, string>)['If-Modified-Since'] = lastModified;
    }
    
    const response = await fetch(url, fetchOptions);
    
    // Handle 304 Not Modified
    if (response.status === 304) {
      return {
        success: true,
        feedData: { items: [] }, // No new content
        httpStatusCode: 304,
        feedSizeBytes: 0
      };
    }
    
    // Handle non-OK responses
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        httpStatusCode: response.status
      };
    }
    
    // Read response content
    const feedContent = await response.text();
    const feedSizeBytes = Buffer.byteLength(feedContent, 'utf8');
    
    // Validate content size
    if (feedSizeBytes === 0) {
      return {
        success: false,
        error: 'Feed content is empty',
        httpStatusCode: response.status
      };
    }
    
    if (feedSizeBytes > 50 * 1024 * 1024) { // 50MB limit
      return {
        success: false,
        error: 'Feed content is too large (>50MB)',
        httpStatusCode: response.status
      };
    }
    
    // Extract caching headers
    const responseEtag = response.headers.get('etag');
    const responseLastModified = response.headers.get('last-modified');
    
    // Parse the RSS content with enhanced error handling
    let feedData: any;
    try {
      feedData = await parser.parseString(feedContent);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Parse error';
      return {
        success: false,
        error: `Failed to parse RSS feed: ${errorMessage}`,
        httpStatusCode: response.status
      };
    }
    
    // Validate parsed data
    if (!feedData) {
      return {
        success: false,
        error: 'Parsed feed data is null or undefined',
        httpStatusCode: response.status
      };
    }
    
    if (!feedData.items || !Array.isArray(feedData.items)) {
      return {
        success: false,
        error: 'Feed contains no valid items array',
        httpStatusCode: response.status
      };
    }
    
    return {
      success: true,
      feedData,
      httpStatusCode: response.status,
      feedSizeBytes,
      etag: responseEtag || undefined,
      lastModified: responseLastModified || undefined
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Enhanced article processing with better duplicate handling and validation
 */
async function processArticlesProduction(
  feed: Feed | ProductionFeedConfig, 
  items: any[], 
  options: { maxArticles?: number; skipDuplicates?: boolean } = {}
): Promise<{
  articlesFound: number;
  articlesNew: number;
  articlesUpdated: number;
  articlesSkipped: number;
}> {
  
  const { maxArticles, skipDuplicates = true } = options;
  const articlesToProcess = maxArticles ? items.slice(0, maxArticles) : items;
  
  let articlesNew = 0;
  let articlesUpdated = 0;
  let articlesSkipped = 0;
  
  console.log(`📝 Processing ${articlesToProcess.length} articles for ${feed.name}`);
  
  for (let index = 0; index < articlesToProcess.length; index++) {
    const item = articlesToProcess[index];
    try {
      // Extract and validate article data
      const articleData = extractArticleDataProduction(item, feed.id);
      
      // Skip invalid articles
      if (!articleData) {
        articlesSkipped++;
        console.warn(`⚠️ Skipped invalid article ${index + 1} from ${feed.name}`);
        continue;
      }
      
      // Check for existing article
      const existingArticle = await storage.getArticleByGuid(feed.id, articleData.guid);
      
      if (existingArticle) {
        if (skipDuplicates) {
          // Check if article needs updating
          const hasChanges = 
            existingArticle.title !== articleData.title ||
            existingArticle.content !== articleData.content ||
            existingArticle.excerpt !== articleData.excerpt ||
            existingArticle.image_url !== articleData.image_url;
          
          if (hasChanges) {
            await storage.updateArticle(existingArticle.id, {
              title: articleData.title,
              content: articleData.content,
              excerpt: articleData.excerpt,
              image_url: articleData.image_url,
              author: articleData.author
            });
            articlesUpdated++;
          } else {
            articlesSkipped++;
          }
        } else {
          articlesSkipped++;
        }
      } else {
        // Create new article
        await storage.createArticle(articleData);
        articlesNew++;
      }
      
    } catch (error) {
      console.error(`❌ Failed to process article ${index + 1} from ${feed.name}:`, error);
      articlesSkipped++;
      // Continue processing other articles
    }
  }
  
  return {
    articlesFound: articlesToProcess.length,
    articlesNew,
    articlesUpdated,
    articlesSkipped
  };
}

/**
 * Enhanced article data extraction with better validation
 */
function extractArticleDataProduction(item: any, feedId: string): InsertArticle | null {
  try {
    // Extract and validate GUID
    const guid = item.guid || item.id || item.link || generateGuidFromContent(item);
    if (!guid) {
      console.warn('⚠️ Article missing GUID, skipping');
      return null;
    }
    
    // Extract and validate title
    const title = cleanText(item.title || 'Untitled');
    if (!title || title.length < 3) {
      console.warn('⚠️ Article has invalid title, skipping');
      return null;
    }
    
    // Extract and validate URL
    const url = item.link || item.guid || '';
    if (!url || !isValidUrl(url)) {
      console.warn('⚠️ Article has invalid URL, skipping');
      return null;
    }
    
    // Extract optional fields
    const author = item.creator || item['dc:creator'] || item.author || null;
    const publishedAt = extractPublishedDate(item);
    const { content, excerpt } = extractContentProduction(item);
    const imageUrl = extractImageUrlProduction(item);
    
    // Generate mock embedding (will be replaced with real AI embeddings later)
    const embedding = generateMockEmbedding();
    
    return {
      feed_id: feedId,
      guid,
      title,
      url,
      author,
      excerpt,
      content,
      image_url: imageUrl,
      published_at: publishedAt,
      fetched_at: new Date(),
      embedding
    };
    
  } catch (error) {
    console.error('❌ Error extracting article data:', error);
    return null;
  }
}

/**
 * Enhanced content extraction with better HTML handling
 */
function extractContentProduction(item: any): { content: string | null; excerpt: string | null } {
  // Try different content fields in order of preference
  let rawContent = item.contentEncoded || 
                   item['content:encoded'] || 
                   item.content || 
                   item.description || 
                   item.summary || 
                   '';
  
  if (!rawContent) {
    return { content: null, excerpt: null };
  }
  
  try {
    // Clean HTML content
    const $ = cheerio.load(rawContent);
    
    // Remove unwanted elements
    $('script, style, iframe, object, embed, form, input, button').remove();
    
    // Extract clean text content
    const cleanContent = $.text().trim();
    
    // Validate content length
    if (cleanContent.length < 10) {
      return { content: null, excerpt: null };
    }
    
    // Generate excerpt (first 300 characters, break at word boundary)
    let excerpt = cleanContent.substring(0, 300);
    if (cleanContent.length > 300) {
      const lastSpace = excerpt.lastIndexOf(' ');
      if (lastSpace > 200) {
        excerpt = excerpt.substring(0, lastSpace) + '...';
      } else {
        excerpt = excerpt + '...';
      }
    }
    
    return {
      content: cleanContent || null,
      excerpt: excerpt || null
    };
    
  } catch (error) {
    console.warn('⚠️ Error extracting content:', error);
    return { content: null, excerpt: null };
  }
}

/**
 * Enhanced image URL extraction with validation
 */
function extractImageUrlProduction(item: any): string | null {
  try {
    // Try different image sources in order of preference
    const imageSources = [
      // Media RSS
      item.enclosure?.url,
      item.mediaContent?.$?.url,
      item.mediaThumbnail?.$?.url,
      
      // Extract from content
      ...(extractImagesFromContent(item.content || item.description || ''))
    ].filter(Boolean);
    
    // Validate and return first valid image URL
    for (const imageUrl of imageSources) {
      if (imageUrl && isValidUrl(imageUrl) && isImageUrl(imageUrl)) {
        return imageUrl;
      }
    }
    
    return null;
    
  } catch (error) {
    console.warn('⚠️ Error extracting image URL:', error);
    return null;
  }
}

/**
 * Extract images from HTML content
 */
function extractImagesFromContent(content: string): string[] {
  try {
    const $ = cheerio.load(content);
    const images: string[] = [];
    
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        images.push(src);
      }
    });
    
    return images;
    
  } catch (error) {
    return [];
  }
}

/**
 * Enhanced published date extraction
 */
function extractPublishedDate(item: any): Date | null {
  const dateFields = [
    item.pubDate,
    item.isoDate,
    item.date,
    item.dcDate,
    item['dc:date']
  ];
  
  for (const dateField of dateFields) {
    if (dateField) {
      try {
        const date = new Date(dateField);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (error) {
        // Continue to next date field
      }
    }
  }
  
  return null;
}

// Helper functions (reused from original implementation)

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .trim();
}

function generateGuidFromContent(item: any): string {
  const content = `${item.title || ''}${item.link || ''}${item.pubDate || ''}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `generated-${Math.abs(hash)}`;
}

function generateMockEmbedding(): string {
  const embedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  return JSON.stringify(embedding);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('image') || 
         lowerUrl.includes('photo') ||
         lowerUrl.includes('picture');
}