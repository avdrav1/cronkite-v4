/**
 * Category Mapping Service
 * 
 * Provides bidirectional mapping between frontend category IDs (lowercase)
 * and database category names (capitalized). This service resolves the
 * category mismatch issue that prevents feeds from appearing in the onboarding flow.
 */

export interface CategoryMapping {
  frontendId: string;
  databaseName: string;
  aliases?: string[];
}

/**
 * Complete mapping configuration between frontend IDs and database categories
 */
const CATEGORY_MAPPINGS: CategoryMapping[] = [
  { frontendId: 'tech', databaseName: 'Technology' },
  { frontendId: 'business', databaseName: 'Business' },
  { frontendId: 'gaming', databaseName: 'Gaming' },
  { frontendId: 'sports', databaseName: 'Sports' },
  { frontendId: 'science', databaseName: 'Science' },
  { frontendId: 'space', databaseName: 'Space' },
  { frontendId: 'news', databaseName: 'News' },
  { frontendId: 'movies', databaseName: 'Entertainment', aliases: ['Movies'] },
  { frontendId: 'music', databaseName: 'Music' },
  { frontendId: 'books', databaseName: 'Books' },
  { frontendId: 'food', databaseName: 'Food' },
  { frontendId: 'travel', databaseName: 'Travel' },
  { frontendId: 'programming', databaseName: 'Programming' },
  { frontendId: 'design', databaseName: 'Design' },
  { frontendId: 'cars', databaseName: 'Automotive', aliases: ['Cars'] },
  { frontendId: 'diy', databaseName: 'DIY' },
  { frontendId: 'android', databaseName: 'Android' },
  { frontendId: 'apple', databaseName: 'Apple' },
  { frontendId: 'history', databaseName: 'History' },
  { frontendId: 'funny', databaseName: 'Humor', aliases: ['Funny'] },
  { frontendId: 'beauty', databaseName: 'Beauty' },
  { frontendId: 'fashion', databaseName: 'Fashion' },
  { frontendId: 'startups', databaseName: 'Startups' },
  { frontendId: 'cricket', databaseName: 'Cricket' },
  { frontendId: 'football', databaseName: 'Football' },
  { frontendId: 'tennis', databaseName: 'Tennis' },
  { frontendId: 'photography', databaseName: 'Photography' },
  { frontendId: 'interior', databaseName: 'Interior' }
];

export interface CategoryMappingService {
  // Convert frontend category ID to database category name
  frontendToDatabase(frontendId: string): string | null;
  
  // Convert database category name to frontend category ID
  databaseToFrontend(databaseName: string): string | null;
  
  // Get all valid frontend category IDs
  getAllFrontendCategories(): string[];
  
  // Get all valid database category names
  getAllDatabaseCategories(): string[];
  
  // Validate if a category mapping exists
  isValidFrontendCategory(frontendId: string): boolean;
  isValidDatabaseCategory(databaseName: string): boolean;
}

/**
 * Implementation of the category mapping service
 */
class CategoryMappingServiceImpl implements CategoryMappingService {
  private frontendToDbMap: Map<string, string>;
  private dbToFrontendMap: Map<string, string>;
  private aliasToDbMap: Map<string, string>;

  constructor() {
    this.frontendToDbMap = new Map();
    this.dbToFrontendMap = new Map();
    this.aliasToDbMap = new Map();
    
    this.initializeMappings();
  }

  private initializeMappings(): void {
    for (const mapping of CATEGORY_MAPPINGS) {
      // Primary mappings
      this.frontendToDbMap.set(mapping.frontendId, mapping.databaseName);
      this.dbToFrontendMap.set(mapping.databaseName, mapping.frontendId);
      
      // Alias mappings
      if (mapping.aliases) {
        for (const alias of mapping.aliases) {
          this.aliasToDbMap.set(alias.toLowerCase(), mapping.databaseName);
        }
      }
    }
  }

  frontendToDatabase(frontendId: string): string | null {
    if (!frontendId) return null;
    
    const normalized = frontendId.toLowerCase().trim();
    
    // Direct mapping
    const directMatch = this.frontendToDbMap.get(normalized);
    if (directMatch) {
      return directMatch;
    }

    // Fallback: case-insensitive matching with logging
    console.warn(`No direct mapping found for frontend category: ${frontendId}, attempting fallback`);
    
    // Try to find by case-insensitive comparison
    const entries = Array.from(this.frontendToDbMap.entries());
    for (const [key, value] of entries) {
      if (key.toLowerCase() === normalized) {
        console.warn(`Fallback match found: ${frontendId} -> ${value}`);
        return value;
      }
    }

    console.warn(`No mapping found for frontend category: ${frontendId}`);
    return null;
  }

  databaseToFrontend(databaseName: string): string | null {
    if (!databaseName) return null;
    
    const normalized = databaseName.trim();
    
    // Direct mapping
    const directMatch = this.dbToFrontendMap.get(normalized);
    if (directMatch) {
      return directMatch;
    }

    // Check aliases
    const aliasMatch = this.aliasToDbMap.get(normalized.toLowerCase());
    if (aliasMatch) {
      const frontendId = this.dbToFrontendMap.get(aliasMatch);
      if (frontendId) {
        return frontendId;
      }
    }

    // Fallback: case-insensitive matching with logging
    console.warn(`No direct mapping found for database category: ${databaseName}, attempting fallback`);
    
    // Try to find by case-insensitive comparison
    const entries = Array.from(this.dbToFrontendMap.entries());
    for (const [key, value] of entries) {
      if (key.toLowerCase() === normalized.toLowerCase()) {
        console.warn(`Fallback match found: ${databaseName} -> ${value}`);
        return value;
      }
    }

    console.warn(`No mapping found for database category: ${databaseName}`);
    return null;
  }

  getAllFrontendCategories(): string[] {
    return Array.from(this.frontendToDbMap.keys());
  }

  getAllDatabaseCategories(): string[] {
    return Array.from(this.dbToFrontendMap.keys());
  }

  isValidFrontendCategory(frontendId: string): boolean {
    if (!frontendId) return false;
    return this.frontendToDbMap.has(frontendId.toLowerCase().trim());
  }

  isValidDatabaseCategory(databaseName: string): boolean {
    if (!databaseName) return false;
    const normalized = databaseName.trim();
    
    // Check direct mapping
    if (this.dbToFrontendMap.has(normalized)) {
      return true;
    }
    
    // Check aliases
    const aliasMatch = this.aliasToDbMap.get(normalized.toLowerCase());
    return aliasMatch !== undefined;
  }
}

// Singleton instance
const categoryMappingService = new CategoryMappingServiceImpl();

export { categoryMappingService };

// Export the mappings for testing and validation
export { CATEGORY_MAPPINGS };

/**
 * Validation result interfaces
 */
export interface MappingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: MappingStats;
}

export interface MappingStats {
  totalMappings: number;
  frontendCategories: number;
  databaseCategories: number;
  aliasCount: number;
  duplicateFrontendIds: string[];
  duplicateDatabaseNames: string[];
  circularMappings: string[];
}

export interface SeededDataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  coverage: CategoryCoverage;
}

export interface CategoryCoverage {
  totalFrontendCategories: number;
  coveredCategories: string[];
  uncoveredCategories: string[];
  coveragePercentage: number;
  extraDatabaseCategories: string[];
}

/**
 * Utility functions for common operations
 */
export const CategoryMappingUtils = {
  /**
   * Convert an array of frontend category IDs to database category names
   */
  frontendArrayToDatabase(frontendIds: string[]): string[] {
    return frontendIds
      .map(id => categoryMappingService.frontendToDatabase(id))
      .filter((name): name is string => name !== null);
  },

  /**
   * Convert an array of database category names to frontend category IDs
   */
  databaseArrayToFrontend(databaseNames: string[]): string[] {
    return databaseNames
      .map(name => categoryMappingService.databaseToFrontend(name))
      .filter((id): id is string => id !== null);
  },

  /**
   * Validate that all frontend categories have database mappings
   */
  validateMappingCompleteness(): { isComplete: boolean; missingMappings: string[] } {
    const allFrontendCategories = categoryMappingService.getAllFrontendCategories();
    const missingMappings: string[] = [];

    for (const frontendId of allFrontendCategories) {
      const dbName = categoryMappingService.frontendToDatabase(frontendId);
      if (!dbName) {
        missingMappings.push(frontendId);
      }
    }

    return {
      isComplete: missingMappings.length === 0,
      missingMappings
    };
  },

  /**
   * Comprehensive validation of category mappings
   */
  validateMappingConsistency(): MappingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for duplicate frontend IDs
    const frontendIds = CATEGORY_MAPPINGS.map(m => m.frontendId);
    const duplicateFrontendIds = frontendIds.filter((id, index) => frontendIds.indexOf(id) !== index);
    
    // Check for duplicate database names
    const databaseNames = CATEGORY_MAPPINGS.map(m => m.databaseName);
    const duplicateDatabaseNames = databaseNames.filter((name, index) => databaseNames.indexOf(name) !== index);
    
    // Check for circular mappings (should not exist in current design but good to validate)
    const circularMappings: string[] = [];
    
    // Check for empty or invalid mappings
    for (const mapping of CATEGORY_MAPPINGS) {
      if (!mapping.frontendId || mapping.frontendId.trim() === '') {
        errors.push(`Empty frontend ID found in mapping: ${JSON.stringify(mapping)}`);
      }
      if (!mapping.databaseName || mapping.databaseName.trim() === '') {
        errors.push(`Empty database name found in mapping: ${JSON.stringify(mapping)}`);
      }
      
      // Check for whitespace issues
      if (mapping.frontendId !== mapping.frontendId.trim()) {
        warnings.push(`Frontend ID has leading/trailing whitespace: "${mapping.frontendId}"`);
      }
      if (mapping.databaseName !== mapping.databaseName.trim()) {
        warnings.push(`Database name has leading/trailing whitespace: "${mapping.databaseName}"`);
      }
      
      // Check for case consistency
      if (mapping.frontendId !== mapping.frontendId.toLowerCase()) {
        warnings.push(`Frontend ID is not lowercase: "${mapping.frontendId}"`);
      }
    }
    
    if (duplicateFrontendIds.length > 0) {
      errors.push(`Duplicate frontend IDs found: ${duplicateFrontendIds.join(', ')}`);
    }
    
    if (duplicateDatabaseNames.length > 0) {
      errors.push(`Duplicate database names found: ${duplicateDatabaseNames.join(', ')}`);
    }
    
    const aliasCount = CATEGORY_MAPPINGS.reduce((count, mapping) => {
      return count + (mapping.aliases?.length || 0);
    }, 0);

    const stats: MappingStats = {
      totalMappings: CATEGORY_MAPPINGS.length,
      frontendCategories: categoryMappingService.getAllFrontendCategories().length,
      databaseCategories: categoryMappingService.getAllDatabaseCategories().length,
      aliasCount,
      duplicateFrontendIds: [...new Set(duplicateFrontendIds)],
      duplicateDatabaseNames: [...new Set(duplicateDatabaseNames)],
      circularMappings
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats
    };
  },

  /**
   * Validate that seeded data covers all frontend categories
   */
  validateSeededDataCoverage(seededCategories: string[]): SeededDataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const allFrontendCategories = categoryMappingService.getAllFrontendCategories();
    const coveredCategories: string[] = [];
    const uncoveredCategories: string[] = [];
    const extraDatabaseCategories: string[] = [];
    
    // Check which frontend categories are covered by seeded data
    for (const frontendId of allFrontendCategories) {
      const dbName = categoryMappingService.frontendToDatabase(frontendId);
      if (dbName && seededCategories.includes(dbName)) {
        coveredCategories.push(frontendId);
      } else {
        uncoveredCategories.push(frontendId);
      }
    }
    
    // Check for extra database categories that don't map to frontend categories
    for (const seededCategory of seededCategories) {
      const frontendId = categoryMappingService.databaseToFrontend(seededCategory);
      if (!frontendId) {
        extraDatabaseCategories.push(seededCategory);
      }
    }
    
    const coveragePercentage = (coveredCategories.length / allFrontendCategories.length) * 100;
    
    if (uncoveredCategories.length > 0) {
      errors.push(`Frontend categories not covered by seeded data: ${uncoveredCategories.join(', ')}`);
    }
    
    if (extraDatabaseCategories.length > 0) {
      warnings.push(`Seeded categories without frontend mapping: ${extraDatabaseCategories.join(', ')}`);
    }
    
    if (coveragePercentage < 100) {
      errors.push(`Incomplete category coverage: ${coveragePercentage.toFixed(1)}% (${coveredCategories.length}/${allFrontendCategories.length})`);
    }
    
    const coverage: CategoryCoverage = {
      totalFrontendCategories: allFrontendCategories.length,
      coveredCategories,
      uncoveredCategories,
      coveragePercentage,
      extraDatabaseCategories
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      coverage
    };
  },

  /**
   * Validate that a specific set of frontend categories matches the expected categories
   */
  validateFrontendCategorySet(expectedCategories: string[]): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const mappedCategories = categoryMappingService.getAllFrontendCategories();
    
    // Check for missing categories in mapping
    for (const expected of expectedCategories) {
      if (!mappedCategories.includes(expected)) {
        errors.push(`Expected frontend category "${expected}" not found in mapping`);
      }
    }
    
    // Check for extra categories in mapping
    for (const mapped of mappedCategories) {
      if (!expectedCategories.includes(mapped)) {
        warnings.push(`Mapped frontend category "${mapped}" not found in expected categories`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  /**
   * Get mapping statistics for debugging
   */
  getMappingStats(): MappingStats {
    const validation = this.validateMappingConsistency();
    return validation.stats;
  },

  /**
   * Perform startup validation of the entire category mapping system
   */
  performStartupValidation(expectedFrontendCategories?: string[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    mappingValidation: MappingValidationResult;
    frontendValidation?: { isValid: boolean; errors: string[]; warnings: string[] };
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate mapping consistency
    const mappingValidation = this.validateMappingConsistency();
    errors.push(...mappingValidation.errors);
    warnings.push(...mappingValidation.warnings);
    
    // Validate against expected frontend categories if provided
    let frontendValidation: { isValid: boolean; errors: string[]; warnings: string[] } | undefined;
    if (expectedFrontendCategories) {
      frontendValidation = this.validateFrontendCategorySet(expectedFrontendCategories);
      errors.push(...frontendValidation.errors);
      warnings.push(...frontendValidation.warnings);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      mappingValidation,
      frontendValidation
    };
  }
};