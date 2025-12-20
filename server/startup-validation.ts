/**
 * Startup Validation Module
 * 
 * Performs comprehensive validation of the category mapping system during server startup.
 * This ensures that all frontend categories have proper mappings and that the system
 * is configured correctly before accepting requests.
 */

import { CategoryMappingUtils, type MappingValidationResult } from '@shared/category-mapping';
import { CATEGORIES } from '../client/src/data/categories.js';
import { log, logError, logSuccess } from './app-setup';

export interface StartupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    mappingValidation: MappingValidationResult;
    frontendCategoryValidation: { isValid: boolean; errors: string[]; warnings: string[] };
    completenessCheck: { isComplete: boolean; missingMappings: string[] };
  };
}

/**
 * Perform comprehensive startup validation of the category mapping system
 */
export async function performStartupValidation(): Promise<StartupValidationResult> {
  log('🔍 Starting category mapping validation...', 'startup-validation');
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Extract expected frontend categories from the categories data
    const expectedFrontendCategories = CATEGORIES.map(cat => cat.id);
    
    log(`📋 Validating ${expectedFrontendCategories.length} expected frontend categories`, 'startup-validation');
    
    // Perform comprehensive validation
    const validation = CategoryMappingUtils.performStartupValidation(expectedFrontendCategories);
    
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
    
    // Additional completeness check
    const completenessCheck = CategoryMappingUtils.validateMappingCompleteness();
    
    if (!completenessCheck.isComplete) {
      errors.push(`Incomplete category mappings found: ${completenessCheck.missingMappings.join(', ')}`);
    }
    
    // Log validation results
    if (errors.length === 0) {
      logSuccess('✅ Category mapping validation passed', 'startup-validation');
      logSuccess(`📊 Mapping Statistics:`, 'startup-validation');
      logSuccess(`   • Total mappings: ${validation.mappingValidation.stats.totalMappings}`, 'startup-validation');
      logSuccess(`   • Frontend categories: ${validation.mappingValidation.stats.frontendCategories}`, 'startup-validation');
      logSuccess(`   • Database categories: ${validation.mappingValidation.stats.databaseCategories}`, 'startup-validation');
      logSuccess(`   • Aliases: ${validation.mappingValidation.stats.aliasCount}`, 'startup-validation');
      logSuccess(`   • Coverage: 100%`, 'startup-validation');
    } else {
      logError('❌ Category mapping validation failed', undefined, 'startup-validation');
      errors.forEach(error => logError(`   • ${error}`, undefined, 'startup-validation'));
    }
    
    if (warnings.length > 0) {
      log('⚠️  Category mapping warnings:', 'startup-validation');
      warnings.forEach(warning => log(`   • ${warning}`, 'startup-validation'));
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: {
        mappingValidation: validation.mappingValidation,
        frontendCategoryValidation: validation.frontendValidation || { isValid: true, errors: [], warnings: [] },
        completenessCheck
      }
    };
    
  } catch (error) {
    const errorMessage = `Failed to perform startup validation: ${error instanceof Error ? error.message : String(error)}`;
    logError(errorMessage, error instanceof Error ? error : undefined, 'startup-validation');
    
    return {
      isValid: false,
      errors: [errorMessage],
      warnings,
      details: {
        mappingValidation: {
          isValid: false,
          errors: [errorMessage],
          warnings: [],
          stats: {
            totalMappings: 0,
            frontendCategories: 0,
            databaseCategories: 0,
            aliasCount: 0,
            duplicateFrontendIds: [],
            duplicateDatabaseNames: [],
            circularMappings: []
          }
        },
        frontendCategoryValidation: { isValid: false, errors: [errorMessage], warnings: [] },
        completenessCheck: { isComplete: false, missingMappings: [] }
      }
    };
  }
}

/**
 * Validate seeded data coverage against frontend categories
 */
export async function validateSeededDataCoverage(seededCategories: string[]): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  coveragePercentage: number;
}> {
  log('🔍 Validating seeded data category coverage...', 'startup-validation');
  
  try {
    const validation = CategoryMappingUtils.validateSeededDataCoverage(seededCategories);
    
    if (validation.isValid) {
      logSuccess(`✅ Seeded data coverage validation passed (${validation.coverage.coveragePercentage.toFixed(1)}%)`, 'startup-validation');
      logSuccess(`📊 Coverage Details:`, 'startup-validation');
      logSuccess(`   • Total frontend categories: ${validation.coverage.totalFrontendCategories}`, 'startup-validation');
      logSuccess(`   • Covered categories: ${validation.coverage.coveredCategories.length}`, 'startup-validation');
      logSuccess(`   • Coverage percentage: ${validation.coverage.coveragePercentage.toFixed(1)}%`, 'startup-validation');
    } else {
      logError('❌ Seeded data coverage validation failed', undefined, 'startup-validation');
      validation.errors.forEach(error => logError(`   • ${error}`, undefined, 'startup-validation'));
    }
    
    if (validation.warnings.length > 0) {
      log('⚠️  Seeded data coverage warnings:', 'startup-validation');
      validation.warnings.forEach(warning => log(`   • ${warning}`, 'startup-validation'));
    }
    
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      coveragePercentage: validation.coverage.coveragePercentage
    };
    
  } catch (error) {
    const errorMessage = `Failed to validate seeded data coverage: ${error instanceof Error ? error.message : String(error)}`;
    logError(errorMessage, error instanceof Error ? error : undefined, 'startup-validation');
    
    return {
      isValid: false,
      errors: [errorMessage],
      warnings: [],
      coveragePercentage: 0
    };
  }
}

/**
 * Log detailed validation report for debugging
 */
export function logValidationReport(result: StartupValidationResult): void {
  log('📋 Detailed Category Mapping Validation Report', 'startup-validation');
  log('=' .repeat(50), 'startup-validation');
  
  // Overall status
  log(`Overall Status: ${result.isValid ? '✅ PASSED' : '❌ FAILED'}`, 'startup-validation');
  log(`Total Errors: ${result.errors.length}`, 'startup-validation');
  log(`Total Warnings: ${result.warnings.length}`, 'startup-validation');
  log('', 'startup-validation');
  
  // Mapping validation details
  const mappingStats = result.details.mappingValidation.stats;
  log('📊 Mapping Statistics:', 'startup-validation');
  log(`   • Total mappings: ${mappingStats.totalMappings}`, 'startup-validation');
  log(`   • Frontend categories: ${mappingStats.frontendCategories}`, 'startup-validation');
  log(`   • Database categories: ${mappingStats.databaseCategories}`, 'startup-validation');
  log(`   • Aliases: ${mappingStats.aliasCount}`, 'startup-validation');
  log(`   • Duplicate frontend IDs: ${mappingStats.duplicateFrontendIds.length}`, 'startup-validation');
  log(`   • Duplicate database names: ${mappingStats.duplicateDatabaseNames.length}`, 'startup-validation');
  log('', 'startup-validation');
  
  // Completeness check
  const completeness = result.details.completenessCheck;
  log('🔍 Completeness Check:', 'startup-validation');
  log(`   • Complete: ${completeness.isComplete ? '✅ Yes' : '❌ No'}`, 'startup-validation');
  if (!completeness.isComplete) {
    log(`   • Missing mappings: ${completeness.missingMappings.join(', ')}`, 'startup-validation');
  }
  log('', 'startup-validation');
  
  // Errors
  if (result.errors.length > 0) {
    log('❌ Errors:', 'startup-validation');
    result.errors.forEach((error, index) => {
      log(`   ${index + 1}. ${error}`, 'startup-validation');
    });
    log('', 'startup-validation');
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    log('⚠️  Warnings:', 'startup-validation');
    result.warnings.forEach((warning, index) => {
      log(`   ${index + 1}. ${warning}`, 'startup-validation');
    });
    log('', 'startup-validation');
  }
  
  log('=' .repeat(50), 'startup-validation');
}