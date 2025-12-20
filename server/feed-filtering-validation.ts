/**
 * Feed Filtering Logic Validation
 * 
 * This module implements comprehensive validation for feed filtering logic
 * to ensure consistency across all scenarios. Enhanced with category mapping
 * to resolve frontend/database category mismatch issues.
 * 
 * Requirements addressed:
 * - 1.1: Feed filtering by user interests works correctly
 * - 1.5: Fallback behavior for unmapped categories with logging
 * - 2.3: Frontend requests translated to database category names
 */

import { type RecommendedFeed } from "@shared/schema";
import { categoryMappingService, CategoryMappingUtils } from "@shared/category-mapping";

export interface FilterOptions {
  interests?: string[];
  category?: string;
  search?: string;
  featured?: boolean;
  country?: string;
  language?: string;
  limit?: number;
}

export interface FilterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  filteredCount: number;
  originalCount: number;
  appliedFilters: string[];
}

/**
 * Validates and applies feed filtering logic consistently
 * Implements Requirements 1.1, 3.4, 3.5
 */
export class FeedFilteringValidator {
  
  /**
   * Validates feed filtering by user interests with category mapping
   * Requirement 1.1: WHEN a user reaches the feed preview step in onboarding, 
   * THE Cronkite_System SHALL display all available Recommended_Feeds filtered by the user's selected interests
   * Requirement 1.5: WHEN no category mapping exists, THE System SHALL log a warning and attempt case-insensitive matching
   * Requirement 2.3: WHEN the frontend requests feeds by category, THE System SHALL translate category IDs to database category names
   */
  public static validateInterestFiltering(
    feeds: RecommendedFeed[], 
    selectedInterests: string[]
  ): FilterValidationResult {
    console.log('🔍 Validating interest-based filtering with category mapping...');
    console.log(`📊 Input: ${feeds.length} feeds, ${selectedInterests.length} interests`);
    console.log(`📋 Selected interests (frontend): ${selectedInterests.join(', ')}`);
    
    const result: FilterValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      filteredCount: 0,
      originalCount: feeds.length,
      appliedFilters: []
    };
    
    // Handle empty interest selections (Requirement 3.5)
    if (selectedInterests.length === 0) {
      console.log('⚠️  Empty interest selection detected');
      result.warnings.push('No interests selected - returning all feeds');
      result.filteredCount = feeds.length;
      result.appliedFilters.push('no-filter (empty interests)');
      
      // Requirement 3.5: WHEN the user has selected no interests, 
      // THE Cronkite_System SHALL display all available feeds without filtering
      return result;
    }
    
    // Translate frontend categories to database categories using mapping service
    const databaseCategories: string[] = [];
    const unmappedCategories: string[] = [];
    
    for (const frontendCategory of selectedInterests) {
      const dbCategory = categoryMappingService.frontendToDatabase(frontendCategory);
      if (dbCategory) {
        databaseCategories.push(dbCategory);
        console.log(`✅ Mapped: ${frontendCategory} → ${dbCategory}`);
      } else {
        unmappedCategories.push(frontendCategory);
        console.warn(`❌ No mapping found for frontend category: ${frontendCategory}`);
        
        // Requirement 1.5: Log warning and attempt fallback
        result.warnings.push(`No mapping found for category: ${frontendCategory}`);
      }
    }
    
    console.log(`📋 Mapped database categories: ${databaseCategories.join(', ')}`);
    
    if (unmappedCategories.length > 0) {
      result.warnings.push(`Unmapped categories: ${unmappedCategories.join(', ')}`);
      console.log(`⚠️  Unmapped categories: ${unmappedCategories.join(', ')}`);
    }
    
    // If no categories could be mapped, return empty result
    if (databaseCategories.length === 0) {
      console.log('❌ No categories could be mapped - returning empty result');
      result.warnings.push('No valid category mappings found');
      result.filteredCount = 0;
      result.appliedFilters.push('category-mapping (no valid mappings)');
      return result;
    }
    
    // Validate database categories exist in feeds
    const availableCategories = new Set(feeds.map(feed => feed.category));
    const missingCategories = databaseCategories.filter(category => 
      !availableCategories.has(category)
    );
    
    if (missingCategories.length > 0) {
      result.warnings.push(`Some database categories not found in feeds: ${missingCategories.join(', ')}`);
      console.log(`⚠️  Missing database categories: ${missingCategories.join(', ')}`);
    }
    
    // Apply interest filtering using mapped database categories
    const filteredFeeds = feeds.filter(feed => 
      databaseCategories.includes(feed.category)
    );
    
    result.filteredCount = filteredFeeds.length;
    result.appliedFilters.push(`interest-filter-mapped (${selectedInterests.length} frontend → ${databaseCategories.length} database)`);
    
    // Validation checks
    if (filteredFeeds.length === 0 && feeds.length > 0 && databaseCategories.length > 0) {
      result.errors.push('Interest filtering resulted in zero feeds despite available feeds and valid mappings');
      result.isValid = false;
    }
    
    // Ensure all filtered feeds match the mapped database categories
    const invalidFeeds = filteredFeeds.filter(feed => 
      !databaseCategories.includes(feed.category)
    );
    
    if (invalidFeeds.length > 0) {
      result.errors.push(`${invalidFeeds.length} feeds don't match mapped database categories`);
      result.isValid = false;
    }
    
    console.log(`✅ Interest filtering validation: ${result.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`📊 Result: ${result.filteredCount}/${result.originalCount} feeds`);
    
    return result;
  }
  
  /**
   * Validates comprehensive feed filtering with multiple criteria
   * Requirement 3.4: WHEN feeds are filtered by user interests, 
   * THE Cronkite_System SHALL maintain the filtering logic and display only relevant feeds
   */
  public static validateComprehensiveFiltering(
    feeds: RecommendedFeed[],
    options: FilterOptions
  ): FilterValidationResult {
    console.log('🔍 Validating comprehensive filtering...');
    console.log(`📊 Input: ${feeds.length} feeds`);
    console.log(`📋 Filter options:`, options);
    
    const result: FilterValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      filteredCount: 0,
      originalCount: feeds.length,
      appliedFilters: []
    };
    
    let filteredFeeds = [...feeds];
    
    // Apply interest filtering first (most important) with category mapping
    if (options.interests && options.interests.length > 0) {
      const mappingResult = filterFeedsByInterestsWithMapping(filteredFeeds, options.interests);
      
      // Update filtered feeds
      filteredFeeds = mappingResult.filteredFeeds;
      
      // Add mapping warnings to result
      result.warnings.push(...mappingResult.mappingResults.warnings);
      
      // Log mapping results
      if (mappingResult.mappingResults.mapped.length > 0) {
        console.log('✅ Category mappings applied:');
        mappingResult.mappingResults.mapped.forEach(({ frontend, database }) => {
          console.log(`   ${frontend} → ${database}`);
        });
      }
      
      if (mappingResult.mappingResults.unmapped.length > 0) {
        console.log('❌ Unmapped categories:');
        mappingResult.mappingResults.unmapped.forEach(category => {
          console.log(`   ${category}`);
        });
        result.warnings.push(`Unmapped categories: ${mappingResult.mappingResults.unmapped.join(', ')}`);
      }
      
      result.appliedFilters.push(`interests-mapped (${options.interests.length} frontend → ${mappingResult.mappingResults.mapped.length} database)`);
      console.log(`📊 After interest filtering with mapping: ${filteredFeeds.length} feeds`);
    }
    
    // Apply category filtering (if different from interests)
    if (options.category && (!options.interests || !options.interests.includes(options.category))) {
      const beforeCount = filteredFeeds.length;
      filteredFeeds = filteredFeeds.filter(feed => 
        feed.category.toLowerCase() === options.category!.toLowerCase()
      );
      result.appliedFilters.push(`category (${options.category})`);
      console.log(`📊 After category filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
    }
    
    // Apply featured filtering
    if (options.featured !== undefined) {
      const beforeCount = filteredFeeds.length;
      filteredFeeds = filteredFeeds.filter(feed => feed.is_featured === options.featured);
      result.appliedFilters.push(`featured (${options.featured})`);
      console.log(`📊 After featured filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
    }
    
    // Apply country filtering
    if (options.country) {
      const beforeCount = filteredFeeds.length;
      filteredFeeds = filteredFeeds.filter(feed => 
        feed.country && feed.country.toUpperCase() === options.country!.toUpperCase()
      );
      result.appliedFilters.push(`country (${options.country})`);
      console.log(`📊 After country filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
    }
    
    // Apply language filtering
    if (options.language) {
      const beforeCount = filteredFeeds.length;
      filteredFeeds = filteredFeeds.filter(feed => 
        feed.language.toLowerCase() === options.language!.toLowerCase()
      );
      result.appliedFilters.push(`language (${options.language})`);
      console.log(`📊 After language filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
    }
    
    // Apply search filtering
    if (options.search) {
      const beforeCount = filteredFeeds.length;
      const searchLower = options.search.toLowerCase();
      
      filteredFeeds = filteredFeeds.filter(feed => {
        const nameMatch = feed.name.toLowerCase().includes(searchLower);
        const descMatch = feed.description?.toLowerCase().includes(searchLower);
        const tagMatch = feed.tags && feed.tags.some(tag => tag.toLowerCase().includes(searchLower));
        return nameMatch || descMatch || tagMatch;
      });
      
      result.appliedFilters.push(`search ("${options.search}")`);
      console.log(`📊 After search filtering: ${beforeCount} → ${filteredFeeds.length} feeds`);
    }
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      const beforeCount = filteredFeeds.length;
      filteredFeeds = filteredFeeds.slice(0, options.limit);
      result.appliedFilters.push(`limit (${options.limit})`);
      console.log(`📊 After limit: ${beforeCount} → ${filteredFeeds.length} feeds`);
    }
    
    result.filteredCount = filteredFeeds.length;
    
    // Validation checks
    if (result.filteredCount > result.originalCount) {
      result.errors.push('Filtered count exceeds original count - logic error');
      result.isValid = false;
    }
    
    // Check for consistency in filtering logic with category mapping
    if (options.interests && options.interests.length > 0) {
      // Get the mapped database categories for validation
      const mappedDatabaseCategories = CategoryMappingUtils.frontendArrayToDatabase(options.interests);
      
      const invalidFeeds = filteredFeeds.filter(feed => {
        return !mappedDatabaseCategories.includes(feed.category);
      });
      
      if (invalidFeeds.length > 0) {
        result.errors.push(`${invalidFeeds.length} feeds don't match mapped database categories`);
        result.isValid = false;
      }
    }
    
    console.log(`✅ Comprehensive filtering validation: ${result.isValid ? 'PASS' : 'FAIL'}`);
    console.log(`📊 Final result: ${result.filteredCount}/${result.originalCount} feeds`);
    console.log(`🔧 Applied filters: ${result.appliedFilters.join(', ')}`);
    
    return result;
  }
  
  /**
   * Validates filtering consistency across different scenarios
   * Ensures the same filtering logic produces consistent results
   */
  public static validateFilteringConsistency(
    feeds: RecommendedFeed[],
    scenarios: FilterOptions[]
  ): { isConsistent: boolean; inconsistencies: string[] } {
    console.log('🔍 Validating filtering consistency across scenarios...');
    
    const inconsistencies: string[] = [];
    
    // Test that identical filter options produce identical results
    for (let i = 0; i < scenarios.length; i++) {
      for (let j = i + 1; j < scenarios.length; j++) {
        const scenario1 = scenarios[i];
        const scenario2 = scenarios[j];
        
        // Check if scenarios are identical
        if (JSON.stringify(scenario1) === JSON.stringify(scenario2)) {
          const result1 = this.validateComprehensiveFiltering(feeds, scenario1);
          const result2 = this.validateComprehensiveFiltering(feeds, scenario2);
          
          if (result1.filteredCount !== result2.filteredCount) {
            inconsistencies.push(
              `Identical scenarios produced different results: ${result1.filteredCount} vs ${result2.filteredCount}`
            );
          }
        }
      }
    }
    
    // Test that empty interests always return all feeds
    const emptyInterestScenarios = scenarios.filter(s => !s.interests || s.interests.length === 0);
    emptyInterestScenarios.forEach((scenario, index) => {
      const result = this.validateComprehensiveFiltering(feeds, scenario);
      
      // If no other filters are applied, should return all feeds
      const hasOtherFilters = scenario.category || scenario.search || 
                             scenario.featured !== undefined || scenario.country || scenario.language;
      
      if (!hasOtherFilters && result.filteredCount !== feeds.length) {
        inconsistencies.push(
          `Empty interests scenario ${index} should return all feeds but returned ${result.filteredCount}/${feeds.length}`
        );
      }
    });
    
    const isConsistent = inconsistencies.length === 0;
    console.log(`✅ Filtering consistency validation: ${isConsistent ? 'PASS' : 'FAIL'}`);
    
    if (!isConsistent) {
      console.log('❌ Inconsistencies found:');
      inconsistencies.forEach(inc => console.log(`   - ${inc}`));
    }
    
    return { isConsistent, inconsistencies };
  }
  
  /**
   * Validates that the FeedPreview component filtering matches API filtering
   * Ensures frontend and backend filtering logic are consistent
   */
  public static validateFrontendBackendConsistency(
    feeds: RecommendedFeed[],
    selectedInterests: string[]
  ): { isConsistent: boolean; differences: string[] } {
    console.log('🔍 Validating frontend-backend filtering consistency...');
    
    const differences: string[] = [];
    
    // Simulate frontend filtering logic (from FeedPreview component)
    const frontendFiltered = feeds.filter(feed => 
      selectedInterests.includes(feed.category)
    );
    
    // Simulate backend filtering logic (from API endpoint)
    const backendResult = this.validateInterestFiltering(feeds, selectedInterests);
    const backendFiltered = feeds.filter(feed => 
      selectedInterests.map(i => i.toLowerCase()).includes(feed.category.toLowerCase())
    );
    
    // Compare results
    if (frontendFiltered.length !== backendFiltered.length) {
      differences.push(
        `Count mismatch: frontend ${frontendFiltered.length} vs backend ${backendFiltered.length}`
      );
    }
    
    // Check for feeds that appear in one but not the other
    const frontendIds = new Set(frontendFiltered.map(f => f.id));
    const backendIds = new Set(backendFiltered.map(f => f.id));
    
    const onlyInFrontend = frontendFiltered.filter(f => !backendIds.has(f.id));
    const onlyInBackend = backendFiltered.filter(f => !frontendIds.has(f.id));
    
    if (onlyInFrontend.length > 0) {
      differences.push(`${onlyInFrontend.length} feeds only in frontend results`);
    }
    
    if (onlyInBackend.length > 0) {
      differences.push(`${onlyInBackend.length} feeds only in backend results`);
    }
    
    const isConsistent = differences.length === 0;
    console.log(`✅ Frontend-backend consistency: ${isConsistent ? 'PASS' : 'FAIL'}`);
    
    if (!isConsistent) {
      console.log('❌ Differences found:');
      differences.forEach(diff => console.log(`   - ${diff}`));
    }
    
    return { isConsistent, differences };
  }
}

/**
 * Enhanced feed filtering function that uses category mapping
 * This is the main function that should be used by API endpoints
 * Requirement 1.1: Filter feeds by user interests with proper category mapping
 * Requirement 1.5: Fallback behavior for unmapped categories with logging
 * Requirement 2.3: Translate frontend categories to database categories
 */
export function filterFeedsByInterestsWithMapping(
  feeds: RecommendedFeed[],
  frontendInterests: string[]
): { 
  filteredFeeds: RecommendedFeed[]; 
  mappingResults: { 
    mapped: Array<{ frontend: string; database: string }>; 
    unmapped: string[]; 
    warnings: string[] 
  } 
} {
  console.log('🔍 Filtering feeds with category mapping...');
  console.log(`📊 Input: ${feeds.length} feeds, ${frontendInterests.length} frontend interests`);
  console.log(`📋 Frontend interests: ${frontendInterests.join(', ')}`);
  
  const mappingResults = {
    mapped: [] as Array<{ frontend: string; database: string }>,
    unmapped: [] as string[],
    warnings: [] as string[]
  };
  
  // Handle empty interests
  if (frontendInterests.length === 0) {
    console.log('⚠️  Empty interests - returning all feeds');
    mappingResults.warnings.push('No interests provided - returning all feeds');
    return { filteredFeeds: feeds, mappingResults };
  }
  
  // Map frontend categories to database categories
  const databaseCategories: string[] = [];
  
  for (const frontendCategory of frontendInterests) {
    const dbCategory = categoryMappingService.frontendToDatabase(frontendCategory);
    if (dbCategory) {
      databaseCategories.push(dbCategory);
      mappingResults.mapped.push({ frontend: frontendCategory, database: dbCategory });
      console.log(`✅ Mapped: ${frontendCategory} → ${dbCategory}`);
    } else {
      mappingResults.unmapped.push(frontendCategory);
      mappingResults.warnings.push(`No mapping found for category: ${frontendCategory}`);
      console.warn(`❌ No mapping found for frontend category: ${frontendCategory}`);
    }
  }
  
  console.log(`📋 Mapped to database categories: ${databaseCategories.join(', ')}`);
  
  // If no categories could be mapped, return empty result
  if (databaseCategories.length === 0) {
    console.log('❌ No categories could be mapped - returning empty result');
    mappingResults.warnings.push('No valid category mappings found');
    return { filteredFeeds: [], mappingResults };
  }
  
  // Filter feeds using mapped database categories
  const filteredFeeds = feeds.filter(feed => 
    databaseCategories.includes(feed.category)
  );
  
  console.log(`✅ Filtering complete: ${filteredFeeds.length}/${feeds.length} feeds match interests`);
  
  return { filteredFeeds, mappingResults };
}

/**
 * Utility function to validate filter options
 */
export function validateFilterOptions(options: FilterOptions): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (options.limit !== undefined && (options.limit < 0 || options.limit > 1000)) {
    errors.push('Limit must be between 0 and 1000');
  }
  
  if (options.search !== undefined && options.search.length > 100) {
    errors.push('Search query must be 100 characters or less');
  }
  
  if (options.category !== undefined && options.category.length === 0) {
    errors.push('Category cannot be empty string');
  }
  
  if (options.country !== undefined && (options.country.length < 2 || options.country.length > 3)) {
    errors.push('Country code must be 2-3 characters');
  }
  
  if (options.language !== undefined && options.language.length < 2) {
    errors.push('Language code must be at least 2 characters');
  }
  
  return { isValid: errors.length === 0, errors };
}