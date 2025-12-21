/**
 * Feed Validation Service
 * 
 * Provides comprehensive validation and health checking for RSS feeds
 * in production environments.
 * 
 * Requirements: 3.1, 3.2, 6.6
 */

import Parser from 'rss-parser';
import { categoryMappingService } from "@shared/category-mapping";
import type { ProductionFeedConfig, FeedValidationResult } from './production-feeds';

export interface FeedHealthStatus {
  url: string;
  healthy: boolean;
  lastChecked: Date;
  statusCode?: number;
  error?: string;
  responseTime?: number;
  contentType?: string;
  feedSize?: number;
  itemCount?: number;
  lastModified?: string;
  etag?: string;
}

export interface FeedContentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  itemCount: number;
  hasValidItems: boolean;
  encoding?: string;
  feedType?: 'rss' | 'atom' | 'unknown';
}

/**
 * RSS parser for validation
 */
const validationParser = new Parser({
  timeout: 15000, // 15 second timeout for validation
  headers: {
    'User-Agent': 'Cronkite Feed Validator/1.0 (+https://cronkite.app)',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
  },
  customFields: {
    feed: ['language', 'generator', 'docs'],
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

/**
 * Validates feed URL accessibility and basic properties
 */
export async function validateFeedUrl(url: string): Promise<FeedHealthStatus> {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Validating feed URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cronkite Feed Validator/1.0 (+https://cronkite.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || undefined;
    const lastModified = response.headers.get('last-modified') || undefined;
    const etag = response.headers.get('etag') || undefined;
    
    if (!response.ok) {
      return {
        url,
        healthy: false,
        lastChecked: new Date(),
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
        contentType
      };
    }
    
    const content = await response.text();
    const feedSize = Buffer.byteLength(content, 'utf8');
    
    // Try to parse the feed to count items
    let itemCount = 0;
    try {
      const feedData = await validationParser.parseString(content);
      itemCount = feedData.items?.length || 0;
    } catch (parseError) {
      // If parsing fails, we'll still return the basic health info
      console.warn(`⚠️ Could not parse feed for item count: ${parseError}`);
    }
    
    return {
      url,
      healthy: true,
      lastChecked: new Date(),
      statusCode: response.status,
      responseTime,
      contentType,
      feedSize,
      itemCount,
      lastModified,
      etag
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      url,
      healthy: false,
      lastChecked: new Date(),
      error: errorMessage,
      responseTime
    };
  }
}

/**
 * Validates feed content structure and format
 */
export async function validateFeedContent(url: string): Promise<FeedContentValidation> {
  try {
    console.log(`📋 Validating feed content: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Cronkite Feed Validator/1.0 (+https://cronkite.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      return {
        isValid: false,
        errors: [`HTTP ${response.status}: ${response.statusText}`],
        warnings: [],
        itemCount: 0,
        hasValidItems: false
      };
    }
    
    const content = await response.text();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Detect encoding
    const encodingMatch = content.match(/encoding=["']([^"']+)["']/i);
    const encoding = encodingMatch ? encodingMatch[1] : 'UTF-8';
    
    // Detect feed type
    let feedType: 'rss' | 'atom' | 'unknown' = 'unknown';
    if (content.includes('<rss')) {
      feedType = 'rss';
    } else if (content.includes('<feed') && content.includes('xmlns="http://www.w3.org/2005/Atom"')) {
      feedType = 'atom';
    }
    
    // Parse the feed
    let feedData: any;
    try {
      feedData = await validationParser.parseString(content);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Parse error';
      return {
        isValid: false,
        errors: [`Failed to parse feed: ${errorMessage}`],
        warnings: [],
        itemCount: 0,
        hasValidItems: false,
        encoding,
        feedType
      };
    }
    
    // Validate feed structure
    if (!feedData.title) {
      errors.push('Feed is missing title');
    }
    
    if (!feedData.description) {
      warnings.push('Feed is missing description');
    }
    
    if (!feedData.link) {
      warnings.push('Feed is missing link');
    }
    
    // Validate items
    const items = feedData.items || [];
    const itemCount = items.length;
    let validItemCount = 0;
    
    if (itemCount === 0) {
      warnings.push('Feed contains no items');
    } else {
      // Validate first few items
      const itemsToCheck = Math.min(items.length, 5);
      
      for (let i = 0; i < itemsToCheck; i++) {
        const item = items[i];
        let itemValid = true;
        
        if (!item.title && !item.content) {
          warnings.push(`Item ${i + 1}: Missing both title and content`);
          itemValid = false;
        }
        
        if (!item.link && !item.guid) {
          warnings.push(`Item ${i + 1}: Missing both link and guid`);
          itemValid = false;
        }
        
        if (!item.pubDate && !item.isoDate && !item.date) {
          warnings.push(`Item ${i + 1}: Missing publication date`);
        }
        
        if (itemValid) {
          validItemCount++;
        }
      }
    }
    
    const hasValidItems = validItemCount > 0;
    
    // Additional content validation
    if (content.length < 100) {
      errors.push('Feed content is suspiciously short');
    }
    
    if (content.length > 10 * 1024 * 1024) { // 10MB
      warnings.push('Feed content is very large (>10MB)');
    }
    
    // Check for common issues
    if (content.includes('404') || content.includes('Not Found')) {
      errors.push('Feed content appears to be a 404 error page');
    }
    
    if (content.includes('<html') || content.includes('<!DOCTYPE html')) {
      errors.push('Feed content appears to be HTML instead of XML');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      itemCount,
      hasValidItems,
      encoding,
      feedType
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      isValid: false,
      errors: [`Validation failed: ${errorMessage}`],
      warnings: [],
      itemCount: 0,
      hasValidItems: false
    };
  }
}

/**
 * Performs comprehensive validation of a production feed
 */
export async function validateProductionFeed(feed: ProductionFeedConfig): Promise<{
  configValid: boolean;
  urlHealthy: boolean;
  contentValid: boolean;
  configResult: FeedValidationResult;
  healthResult: FeedHealthStatus;
  contentResult: FeedContentValidation;
  overallValid: boolean;
}> {
  console.log(`🔍 Performing comprehensive validation for feed: ${feed.name}`);
  
  // 1. Validate configuration
  const configResult = validateFeedConfig(feed);
  const configValid = configResult.isValid;
  
  // 2. Validate URL health
  const healthResult = await validateFeedUrl(feed.url);
  const urlHealthy = healthResult.healthy;
  
  // 3. Validate content (only if URL is healthy)
  let contentResult: FeedContentValidation;
  let contentValid = false;
  
  if (urlHealthy) {
    contentResult = await validateFeedContent(feed.url);
    contentValid = contentResult.isValid;
  } else {
    contentResult = {
      isValid: false,
      errors: ['Skipped content validation due to URL health issues'],
      warnings: [],
      itemCount: 0,
      hasValidItems: false
    };
  }
  
  const overallValid = configValid && urlHealthy && contentValid;
  
  console.log(`${overallValid ? '✅' : '❌'} ${feed.name}: Config=${configValid}, URL=${urlHealthy}, Content=${contentValid}`);
  
  return {
    configValid,
    urlHealthy,
    contentValid,
    configResult,
    healthResult,
    contentResult,
    overallValid
  };
}

/**
 * Validates feed configuration (imported from production-feeds.ts for consistency)
 */
function validateFeedConfig(feed: ProductionFeedConfig): FeedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required field validation
  if (!feed.id) errors.push('Feed ID is required');
  if (!feed.name) errors.push('Feed name is required');
  if (!feed.url) errors.push('Feed URL is required');
  if (!feed.description) errors.push('Feed description is required');
  if (!feed.category) errors.push('Feed category is required');
  if (!feed.language) errors.push('Feed language is required');
  
  // URL validation
  if (feed.url && !isValidUrl(feed.url)) {
    errors.push('Feed URL is not a valid URL');
  }
  
  if (feed.site_url && !isValidUrl(feed.site_url)) {
    errors.push('Site URL is not a valid URL');
  }
  
  // Category validation using category mapping service
  if (feed.category && !categoryMappingService.isValidDatabaseCategory(feed.category)) {
    errors.push(`Invalid category "${feed.category}" - not found in category mapping`);
  }
  
  // Priority validation
  if (!['high', 'medium', 'low'].includes(feed.priority)) {
    errors.push('Priority must be high, medium, or low');
  }
  
  // Sync interval validation
  if (!['hourly', 'daily', 'weekly'].includes(feed.syncInterval)) {
    errors.push('Sync interval must be hourly, daily, or weekly');
  }
  
  // Language validation
  if (feed.language && !isValidLanguageCode(feed.language)) {
    warnings.push(`Language code "${feed.language}" may not be valid`);
  }
  
  // Popularity score validation
  if (feed.popularity_score < 0 || feed.popularity_score > 100) {
    errors.push('Popularity score must be between 0 and 100');
  }
  
  // Tags validation
  if (!Array.isArray(feed.tags)) {
    errors.push('Tags must be an array');
  } else if (feed.tags.length === 0) {
    warnings.push('Feed has no tags - consider adding relevant tags');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Batch validation of multiple feeds with progress reporting
 */
export async function validateMultipleFeeds(
  feeds: ProductionFeedConfig[],
  options: {
    batchSize?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number, current: string) => void;
  } = {}
): Promise<{
  results: Array<{
    feed: ProductionFeedConfig;
    validation: Awaited<ReturnType<typeof validateProductionFeed>>;
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    configErrors: number;
    urlErrors: number;
    contentErrors: number;
  };
}> {
  const { batchSize = 3, delayMs = 2000, onProgress } = options;
  const results: Array<{
    feed: ProductionFeedConfig;
    validation: Awaited<ReturnType<typeof validateProductionFeed>>;
  }> = [];
  
  console.log(`🔍 Starting batch validation of ${feeds.length} feeds (batch size: ${batchSize})`);
  
  // Process feeds in batches to avoid overwhelming servers
  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    
    // Process batch concurrently
    const batchPromises = batch.map(async (feed) => {
      if (onProgress) {
        onProgress(i + 1, feeds.length, feed.name);
      }
      
      const validation = await validateProductionFeed(feed);
      return { feed, validation };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches
    if (i + batchSize < feeds.length && delayMs > 0) {
      console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Calculate summary
  const summary = {
    total: results.length,
    valid: results.filter(r => r.validation.overallValid).length,
    invalid: results.filter(r => !r.validation.overallValid).length,
    configErrors: results.filter(r => !r.validation.configValid).length,
    urlErrors: results.filter(r => !r.validation.urlHealthy).length,
    contentErrors: results.filter(r => !r.validation.contentValid).length
  };
  
  console.log(`✅ Batch validation completed: ${summary.valid}/${summary.total} feeds valid`);
  
  return { results, summary };
}

// Helper functions

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidLanguageCode(code: string): boolean {
  // Basic validation for common language codes
  const validCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'];
  return validCodes.includes(code) || /^[a-z]{2}(-[A-Z]{2})?$/.test(code);
}