/**
 * Frontend Feed Filtering Logic
 * 
 * This module provides consistent feed filtering logic for the frontend
 * to match the backend validation logic. Enhanced with category mapping
 * to resolve frontend/database category mismatch issues.
 * 
 * Requirements addressed:
 * - 1.1: Feed filtering by user interests works correctly
 * - 1.5: Fallback behavior for unmapped categories with logging
 * - 2.3: Frontend requests translated to database category names
 */

import { type RecommendedFeed } from "@shared/schema";
import { categoryMappingService, CategoryMappingUtils } from "@shared/category-mapping";

export interface FeedFilterOptions {
  interests?: string[];
  search?: string;
  featured?: boolean;
  country?: string;
  language?: string;
}

export interface FilterResult {
  feeds: RecommendedFeed[];
  totalCount: number;
  filteredCount: number;
  appliedFilters: string[];
  warnings: string[];
}

/**
 * Filters feeds based on user interests with category mapping
 * Implements Requirements 1.1, 1.5, 2.3
 */
export function filterFeedsByInterests(
  feeds: RecommendedFeed[], 
  selectedInterests: string[]
): FilterResult {
  console.log('🔍 Frontend: Filtering feeds by interests with category mapping...');
  console.log(`📊 Input: ${feeds.length} feeds, ${selectedInterests.length} interests`);
  console.log(`📋 Frontend interests: ${selectedInterests.join(', ')}`);
  
  const result: FilterResult = {
    feeds: [],
    totalCount: feeds.length,
    filteredCount: 0,
    appliedFilters: [],
    warnings: []
  };
  
  // Handle empty interest selections (Requirement 3.5)
  if (selectedInterests.length === 0) {
    console.log('⚠️  Frontend: Empty interest selection - returning all feeds');
    result.feeds = feeds;
    result.filteredCount = feeds.length;
    result.appliedFilters.push('no-filter (empty interests)');
    result.warnings.push('No interests selected - showing all feeds');
    return result;
  }
  
  // Translate frontend categories to database categories using mapping service
  const databaseCategories: string[] = [];
  const unmappedCategories: string[] = [];
  
  for (const frontendCategory of selectedInterests) {
    const dbCategory = categoryMappingService.frontendToDatabase(frontendCategory);
    if (dbCategory) {
      databaseCategories.push(dbCategory);
      console.log(`✅ Frontend mapped: ${frontendCategory} → ${dbCategory}`);
    } else {
      unmappedCategories.push(frontendCategory);
      console.warn(`❌ Frontend: No mapping found for category: ${frontendCategory}`);
      
      // Requirement 1.5: Log warning for unmapped categories
      result.warnings.push(`No mapping found for category: ${frontendCategory}`);
    }
  }
  
  console.log(`📋 Frontend mapped database categories: ${databaseCategories.join(', ')}`);
  
  if (unmappedCategories.length > 0) {
    result.warnings.push(`Unmapped categories: ${unmappedCategories.join(', ')}`);
  }
  
  // If no categories could be mapped, return empty result
  if (databaseCategories.length === 0) {
    console.log('❌ Frontend: No categories could be mapped - returning empty result');
    result.warnings.push('No valid category mappings found');
    result.filteredCount = 0;
    result.appliedFilters.push('category-mapping (no valid mappings)');
    return result;
  }
  
  // Apply filtering using mapped database categories
  result.feeds = feeds.filter(feed => 
    databaseCategories.includes(feed.category)
  );
  
  result.filteredCount = result.feeds.length;
  result.appliedFilters.push(`interests-mapped (${selectedInterests.length} frontend → ${databaseCategories.length} database)`);
  
  // Validate filtering results
  if (result.filteredCount === 0 && feeds.length > 0 && databaseCategories.length > 0) {
    result.warnings.push('No feeds match mapped database categories');
  }
  
  // Check for available categories in feeds
  const availableCategories = new Set(feeds.map(feed => feed.category));
  const missingCategories = databaseCategories.filter(category => 
    !availableCategories.has(category)
  );
  
  if (missingCategories.length > 0) {
    result.warnings.push(`Some database categories not available in feeds: ${missingCategories.join(', ')}`);
  }
  
  console.log(`✅ Frontend: Interest filtering complete`);
  console.log(`📊 Result: ${result.filteredCount}/${result.totalCount} feeds`);
  
  return result;
}

/**
 * Applies comprehensive filtering with multiple criteria
 */
export function filterFeeds(
  feeds: RecommendedFeed[],
  options: FeedFilterOptions
): FilterResult {
  console.log('🔍 Frontend: Applying comprehensive filtering...');
  
  let filteredFeeds = [...feeds];
  const appliedFilters: string[] = [];
  const warnings: string[] = [];
  
  // Apply interest filtering first
  if (options.interests && options.interests.length > 0) {
    const interestResult = filterFeedsByInterests(filteredFeeds, options.interests);
    filteredFeeds = interestResult.feeds;
    appliedFilters.push(...interestResult.appliedFilters);
    warnings.push(...interestResult.warnings);
  } else if (!options.interests || options.interests.length === 0) {
    // Handle empty interests case
    appliedFilters.push('no-filter (empty interests)');
    warnings.push('No interests selected - showing all feeds');
  }
  
  // Apply search filtering
  if (options.search && options.search.trim().length > 0) {
    const beforeCount = filteredFeeds.length;
    const searchLower = options.search.toLowerCase();
    
    filteredFeeds = filteredFeeds.filter(feed => {
      const nameMatch = feed.name.toLowerCase().includes(searchLower);
      const descMatch = feed.description?.toLowerCase().includes(searchLower);
      const tagMatch = feed.tags && feed.tags.some(tag => tag.toLowerCase().includes(searchLower));
      return nameMatch || descMatch || tagMatch;
    });
    
    appliedFilters.push(`search ("${options.search}")`);
    console.log(`📊 Frontend: Search filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
  }
  
  // Apply featured filtering
  if (options.featured !== undefined) {
    const beforeCount = filteredFeeds.length;
    filteredFeeds = filteredFeeds.filter(feed => feed.is_featured === options.featured);
    appliedFilters.push(`featured (${options.featured})`);
    console.log(`📊 Frontend: Featured filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
  }
  
  // Apply country filtering
  if (options.country) {
    const beforeCount = filteredFeeds.length;
    filteredFeeds = filteredFeeds.filter(feed => 
      feed.country && feed.country.toUpperCase() === options.country!.toUpperCase()
    );
    appliedFilters.push(`country (${options.country})`);
    console.log(`📊 Frontend: Country filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
  }
  
  // Apply language filtering
  if (options.language) {
    const beforeCount = filteredFeeds.length;
    filteredFeeds = filteredFeeds.filter(feed => 
      feed.language.toLowerCase() === options.language!.toLowerCase()
    );
    appliedFilters.push(`language (${options.language})`);
    console.log(`📊 Frontend: Language filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
  }
  
  const result: FilterResult = {
    feeds: filteredFeeds,
    totalCount: feeds.length,
    filteredCount: filteredFeeds.length,
    appliedFilters,
    warnings
  };
  
  console.log(`✅ Frontend: Comprehensive filtering complete`);
  console.log(`📊 Final result: ${result.filteredCount}/${result.totalCount} feeds`);
  console.log(`🔧 Applied filters: ${result.appliedFilters.join(', ')}`);
  
  return result;
}

/**
 * Groups filtered feeds by category for display using category mapping
 */
export function groupFeedsByCategory(
  feeds: RecommendedFeed[],
  selectedInterests: string[]
): Record<string, RecommendedFeed[]> {
  const feedsByCategory: Record<string, RecommendedFeed[]> = {};
  
  // Map frontend interests to database categories
  const databaseCategories = CategoryMappingUtils.frontendArrayToDatabase(selectedInterests);
  
  // Group feeds by their database category, but use frontend category as key
  selectedInterests.forEach(frontendCategory => {
    const dbCategory = categoryMappingService.frontendToDatabase(frontendCategory);
    if (dbCategory) {
      const categoryFeeds = feeds.filter(feed => feed.category === dbCategory);
      
      if (categoryFeeds.length > 0) {
        feedsByCategory[frontendCategory] = categoryFeeds;
      }
    }
  });
  
  return feedsByCategory;
}

/**
 * Validates that frontend filtering matches expected backend behavior
 */
export function validateFilteringConsistency(
  feeds: RecommendedFeed[],
  options: FeedFilterOptions
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  try {
    const result = filterFeeds(feeds, options);
    
    // Basic validation checks
    if (result.filteredCount > result.totalCount) {
      issues.push('Filtered count exceeds total count');
    }
    
    if (result.filteredCount < 0) {
      issues.push('Filtered count is negative');
    }
    
    // Validate interest filtering consistency with category mapping
    if (options.interests && options.interests.length > 0) {
      const databaseCategories = CategoryMappingUtils.frontendArrayToDatabase(options.interests);
      const invalidFeeds = result.feeds.filter(feed => 
        !databaseCategories.includes(feed.category)
      );
      
      if (invalidFeeds.length > 0) {
        issues.push(`${invalidFeeds.length} feeds don't match mapped database categories`);
      }
      
      // Check if any frontend categories couldn't be mapped
      const unmappedCount = options.interests.length - databaseCategories.length;
      if (unmappedCount > 0) {
        issues.push(`${unmappedCount} frontend categories could not be mapped to database categories`);
      }
    }
    
    // Validate empty interests handling
    if ((!options.interests || options.interests.length === 0) && 
        !options.search && options.featured === undefined && 
        !options.country && !options.language) {
      
      if (result.filteredCount !== result.totalCount) {
        issues.push('Empty filter options should return all feeds');
      }
    }
    
  } catch (error) {
    issues.push(`Filtering threw an error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}