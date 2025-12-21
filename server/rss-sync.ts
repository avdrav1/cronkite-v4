import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { storage } from './storage.js';
import type { Feed, InsertArticle } from '@shared/schema';

// RSS parser configuration
const parser = new Parser({
  timeout: 10000, // 10 second timeout
  headers: {
    'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
    'Accept': 'application/rss+xml, application/xml, text/xml'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['description', 'description'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

export interface SyncResult {
  success: boolean;
  articlesFound: number;
  articlesNew: number;
  articlesUpdated: number;
  error?: string;
  httpStatusCode?: number;
  feedSizeBytes?: number;
  etag?: string;
  lastModified?: string;
}

export interface SyncOptions {
  maxArticles?: number;
  respectEtag?: boolean;
  respectLastModified?: boolean;
}

/**
 * Synchronizes a single RSS feed
 */
export async function syncFeed(feed: Feed, options: SyncOptions = {}): Promise<SyncResult> {
  const syncLogId = await storage.startFeedSync(feed.id);
  
  try {
    console.log(`Starting sync for feed: ${feed.name} (${feed.url})`);
    
    // Parse the RSS feed
    const parseResult = await parseRSSFeed(feed.url, {
      etag: options.respectEtag ? feed.etag : undefined,
      lastModified: options.respectLastModified ? feed.last_modified : undefined
    });
    
    if (!parseResult.success) {
      await storage.completeFeedSyncError(syncLogId, parseResult.error || 'Failed to parse RSS feed', parseResult.httpStatusCode);
      return {
        success: false,
        articlesFound: 0,
        articlesNew: 0,
        articlesUpdated: 0,
        error: parseResult.error,
        httpStatusCode: parseResult.httpStatusCode
      };
    }
    
    const { feedData, httpStatusCode, feedSizeBytes, etag, lastModified } = parseResult;
    
    // Process articles
    const processResult = await processArticles(feed, feedData.items || [], options.maxArticles);
    
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
    
    console.log(`Sync completed for feed: ${feed.name} - ${processResult.articlesNew} new, ${processResult.articlesUpdated} updated`);
    
    return {
      success: true,
      articlesFound: processResult.articlesFound,
      articlesNew: processResult.articlesNew,
      articlesUpdated: processResult.articlesUpdated,
      httpStatusCode,
      feedSizeBytes,
      etag,
      lastModified
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Sync failed for feed: ${feed.name} - ${errorMessage}`);
    
    await storage.completeFeedSyncError(syncLogId, errorMessage);
    
    return {
      success: false,
      articlesFound: 0,
      articlesNew: 0,
      articlesUpdated: 0,
      error: errorMessage
    };
  }
}

/**
 * Synchronizes multiple feeds in batches
 */
export async function syncFeeds(feeds: Feed[], options: SyncOptions & { batchSize?: number; delayMs?: number } = {}): Promise<SyncResult[]> {
  const { batchSize = 5, delayMs = 1000, ...syncOptions } = options;
  const results: SyncResult[] = [];
  
  console.log(`Starting batch sync for ${feeds.length} feeds (batch size: ${batchSize})`);
  
  // Process feeds in batches to avoid overwhelming servers
  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    
    // Process batch concurrently
    const batchPromises = batch.map(feed => syncFeed(feed, syncOptions));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Collect results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('Batch sync error:', result.reason);
        results.push({
          success: false,
          articlesFound: 0,
          articlesNew: 0,
          articlesUpdated: 0,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown batch error'
        });
      }
    }
    
    // Add delay between batches to be respectful to servers
    if (i + batchSize < feeds.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const totalNew = results.reduce((sum, r) => sum + r.articlesNew, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.articlesUpdated, 0);
  const successCount = results.filter(r => r.success).length;
  
  console.log(`Batch sync completed: ${successCount}/${feeds.length} feeds successful, ${totalNew} new articles, ${totalUpdated} updated`);
  
  return results;
}

/**
 * Parses an RSS feed from a URL
 */
async function parseRSSFeed(url: string, options: { etag?: string | null; lastModified?: string | null } = {}): Promise<{
  success: boolean;
  feedData?: any;
  httpStatusCode?: number;
  feedSizeBytes?: number;
  etag?: string;
  lastModified?: string;
  error?: string;
}> {
  try {
    // Create fetch options with conditional headers
    const fetchOptions: RequestInit = {
      headers: {
        'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    };
    
    // Add conditional headers if available
    if (options.etag) {
      (fetchOptions.headers as Record<string, string>)['If-None-Match'] = options.etag;
    }
    if (options.lastModified) {
      (fetchOptions.headers as Record<string, string>)['If-Modified-Since'] = options.lastModified;
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
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        httpStatusCode: response.status
      };
    }
    
    const feedContent = await response.text();
    const feedSizeBytes = Buffer.byteLength(feedContent, 'utf8');
    
    // Extract caching headers
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    
    // Parse the RSS content
    const feedData = await parser.parseString(feedContent);
    
    return {
      success: true,
      feedData,
      httpStatusCode: response.status,
      feedSizeBytes,
      etag: etag || undefined,
      lastModified: lastModified || undefined
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse RSS feed'
    };
  }
}

/**
 * Processes RSS items into articles
 */
async function processArticles(feed: Feed, items: any[], maxArticles?: number): Promise<{
  articlesFound: number;
  articlesNew: number;
  articlesUpdated: number;
}> {
  const articlesToProcess = maxArticles ? items.slice(0, maxArticles) : items;
  let articlesNew = 0;
  let articlesUpdated = 0;
  
  for (const item of articlesToProcess) {
    try {
      const articleData = extractArticleData(item, feed.id);
      
      // Check if article already exists
      const existingArticle = await storage.getArticleByGuid(feed.id, articleData.guid);
      
      if (existingArticle) {
        // Update existing article if content has changed
        const hasChanges = 
          existingArticle.title !== articleData.title ||
          existingArticle.content !== articleData.content ||
          existingArticle.excerpt !== articleData.excerpt;
        
        if (hasChanges) {
          await storage.updateArticle(existingArticle.id, {
            title: articleData.title,
            content: articleData.content,
            excerpt: articleData.excerpt,
            image_url: articleData.image_url,
            author: articleData.author
          });
          articlesUpdated++;
        }
      } else {
        // Create new article
        await storage.createArticle(articleData);
        articlesNew++;
      }
      
    } catch (error) {
      console.error(`Failed to process article from feed ${feed.name}:`, error);
      // Continue processing other articles
    }
  }
  
  return {
    articlesFound: articlesToProcess.length,
    articlesNew,
    articlesUpdated
  };
}

/**
 * Extracts article data from RSS item
 */
function extractArticleData(item: any, feedId: string): InsertArticle {
  // Extract GUID (unique identifier)
  const guid = item.guid || item.id || item.link || generateGuidFromContent(item);
  
  // Extract title
  const title = cleanText(item.title || 'Untitled');
  
  // Extract URL
  const url = item.link || item.guid || '';
  
  // Extract author
  const author = item.creator || item['dc:creator'] || item.author || null;
  
  // Extract published date
  const publishedAt = item.pubDate || item.isoDate || item.date ? new Date(item.pubDate || item.isoDate || item.date) : null;
  
  // Extract content and excerpt
  const { content, excerpt } = extractContent(item);
  
  // Extract image URL
  const imageUrl = extractImageUrl(item);
  
  // NOTE: Embeddings are disabled due to database index size limitations
  // The idx_articles_ai_summary_embedding btree index cannot handle large embedding vectors
  // Set to null for now - embeddings can be generated later via a background job
  // when the index is properly configured (e.g., using pgvector extension)
  
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
    embedding: null
  };
}

/**
 * Extracts content and excerpt from RSS item
 */
function extractContent(item: any): { content: string | null; excerpt: string | null } {
  // Try different content fields in order of preference
  let rawContent = item.contentEncoded || item['content:encoded'] || item.content || item.description || item.summary || '';
  
  if (!rawContent) {
    return { content: null, excerpt: null };
  }
  
  // Clean HTML content
  const $ = cheerio.load(rawContent);
  
  // Remove script and style elements
  $('script, style').remove();
  
  // Extract clean text content
  const cleanContent = $.text().trim();
  
  // Generate excerpt (first 200 characters)
  const excerpt = cleanContent.length > 200 
    ? cleanContent.substring(0, 200).trim() + '...'
    : cleanContent;
  
  return {
    content: cleanContent || null,
    excerpt: excerpt || null
  };
}

/**
 * Extracts image URL from RSS item
 */
function extractImageUrl(item: any): string | null {
  // Try different image sources
  if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
    return item.enclosure.url;
  }
  
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  
  // Try to extract image from content
  if (item.content || item.description) {
    const $ = cheerio.load(item.content || item.description);
    const firstImg = $('img').first();
    if (firstImg.length) {
      return firstImg.attr('src') || null;
    }
  }
  
  return null;
}

/**
 * Cleans text content
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs with spaces
    .trim();
}

/**
 * Generates a GUID from content when no GUID is available
 */
function generateGuidFromContent(item: any): string {
  const content = `${item.title || ''}${item.link || ''}${item.pubDate || ''}`;
  // Simple hash function for generating consistent GUIDs
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `generated-${Math.abs(hash)}`;
}

/**
 * Retry mechanism for failed operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}