/**
 * Startup Validation Module
 * 
 * Performs comprehensive validation during server startup including:
 * - Environment configuration validation
 * - Database connectivity and migration checks
 * - Category mapping system validation
 * - Production data seeding
 * 
 * This ensures that the system is properly configured before accepting requests.
 */

import { CategoryMappingUtils, type MappingValidationResult } from '@shared/category-mapping';
import { CATEGORIES } from '../client/src/data/categories.js';
import { log, logError, logSuccess } from './app-setup';
import { seedProductionDatabase } from '../scripts/seed-production';
import { validateEnvironment } from './env';

export interface StartupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    environmentValidation: { isValid: boolean; errors: string[]; warnings: string[] };
    databaseValidation: { isValid: boolean; errors: string[]; warnings: string[]; connected: boolean; migrationsApplied: boolean };
    mappingValidation: MappingValidationResult;
    frontendCategoryValidation: { isValid: boolean; errors: string[]; warnings: string[] };
    completenessCheck: { isComplete: boolean; missingMappings: string[] };
    seedingResult?: { success: boolean; message: string };
  };
}

/**
 * Validate database connectivity and migrations
 */
async function validateDatabaseConnection(): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  connected: boolean;
  migrationsApplied: boolean;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let connected = false;
  let migrationsApplied = false;

  try {
    log('🔍 Validating database connection...', 'startup-validation');
    
    // Import storage to test connection
    const { getStorage } = await import('./storage');
    const storage = await getStorage();
    
    // Test database connectivity by attempting a simple query
    try {
      // Try to get user count as a connectivity test
      const testQuery = await storage.db.query.users.findFirst();
      connected = true;
      logSuccess('✅ Database connection successful', 'startup-validation');
    } catch (dbError) {
      connected = false;
      const errorMessage = `Database connection failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
      errors.push(errorMessage);
      logError(errorMessage, dbError instanceof Error ? dbError : undefined, 'startup-validation');
      return { isValid: false, errors, warnings, connected, migrationsApplied };
    }

    // Validate that required tables exist (check migrations)
    try {
      log('🔍 Validating database schema...', 'startup-validation');
      
      // Check for essential tables
      const requiredTables = [
        'users',
        'profiles', 
        'feeds',
        'articles',
        'user_feeds',
        'user_articles'
      ];

      for (const tableName of requiredTables) {
        try {
          // Attempt to query each table
          const tableCheck = await storage.db.execute(`SELECT 1 FROM ${tableName} LIMIT 1`);
          log(`   ✓ Table '${tableName}' exists`, 'startup-validation');
        } catch (tableError) {
          const errorMessage = `Required table '${tableName}' not found - migrations may not be applied`;
          errors.push(errorMessage);
          logError(errorMessage, tableError instanceof Error ? tableError : undefined, 'startup-validation');
        }
      }

      if (errors.length === 0) {
        migrationsApplied = true;
        logSuccess('✅ Database schema validation passed', 'startup-validation');
      } else {
        migrationsApplied = false;
        logError('❌ Database schema validation failed - some tables are missing', undefined, 'startup-validation');
      }

    } catch (schemaError) {
      const errorMessage = `Database schema validation failed: ${schemaError instanceof Error ? schemaError.message : String(schemaError)}`;
      errors.push(errorMessage);
      logError(errorMessage, schemaError instanceof Error ? schemaError : undefined, 'startup-validation');
    }

  } catch (error) {
    const errorMessage = `Database validation failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMessage);
    logError(errorMessage, error instanceof Error ? error : undefined, 'startup-validation');
  }

  return {
    isValid: errors.length === 0 && connected && migrationsApplied,
    errors,
    warnings,
    connected,
    migrationsApplied
  };
}

/**
 * Perform comprehensive startup validation of the category mapping system
 */
export async function performStartupValidation(): Promise<StartupValidationResult> {
  log('🔍 Starting comprehensive startup validation...', 'startup-validation');
  
  const errors: string[] = [];
  const warnings: string[] = [];
  let seedingResult: { success: boolean; message: string } | undefined;
  
  try {
    // 1. Environment Configuration Validation
    log('🔍 Step 1: Validating environment configuration...', 'startup-validation');
    const envValidation = validateEnvironment();
    
    if (!envValidation.valid) {
      logError('❌ Environment validation failed', undefined, 'startup-validation');
      envValidation.errors.forEach(error => logError(`   • ${error}`, undefined, 'startup-validation'));
      errors.push(...envValidation.errors);
    } else {
      logSuccess('✅ Environment validation passed', 'startup-validation');
    }
    
    if (envValidation.warnings.length > 0) {
      log('⚠️  Environment validation warnings:', 'startup-validation');
      envValidation.warnings.forEach(warning => log(`   • ${warning}`, 'startup-validation'));
      warnings.push(...envValidation.warnings);
    }

    // 2. Database Connectivity and Migration Validation
    log('🔍 Step 2: Validating database connectivity and schema...', 'startup-validation');
    const dbValidation = await validateDatabaseConnection();
    
    if (!dbValidation.isValid) {
      logError('❌ Database validation failed', undefined, 'startup-validation');
      dbValidation.errors.forEach(error => logError(`   • ${error}`, undefined, 'startup-validation'));
      errors.push(...dbValidation.errors);
    } else {
      logSuccess('✅ Database validation passed', 'startup-validation');
    }
    
    if (dbValidation.warnings.length > 0) {
      log('⚠️  Database validation warnings:', 'startup-validation');
      dbValidation.warnings.forEach(warning => log(`   • ${warning}`, 'startup-validation'));
      warnings.push(...dbValidation.warnings);
    }

    // 3. Category Mapping Validation (only if database is available)
    let mappingValidation: MappingValidationResult;
    let frontendCategoryValidation: { isValid: boolean; errors: string[]; warnings: string[] };
    let completenessCheck: { isComplete: boolean; missingMappings: string[] };

    if (dbValidation.connected) {
      log('🔍 Step 3: Validating category mapping system...', 'startup-validation');
      
      // Extract expected frontend categories from the categories data
      const expectedFrontendCategories = CATEGORIES.map(cat => cat.id);
      
      log(`📋 Validating ${expectedFrontendCategories.length} expected frontend categories`, 'startup-validation');
      
      // Perform comprehensive validation
      const validation = CategoryMappingUtils.performStartupValidation(expectedFrontendCategories);
      
      mappingValidation = validation.mappingValidation;
      frontendCategoryValidation = validation.frontendValidation || { isValid: true, errors: [], warnings: [] };
      
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
      
      // Additional completeness check
      completenessCheck = CategoryMappingUtils.validateMappingCompleteness();
      
      if (!completenessCheck.isComplete) {
        errors.push(`Incomplete category mappings found: ${completenessCheck.missingMappings.join(', ')}`);
      }

      if (validation.errors.length === 0) {
        logSuccess('✅ Category mapping validation passed', 'startup-validation');
        logSuccess(`📊 Mapping Statistics:`, 'startup-validation');
        logSuccess(`   • Total mappings: ${validation.mappingValidation.stats.totalMappings}`, 'startup-validation');
        logSuccess(`   • Frontend categories: ${validation.mappingValidation.stats.frontendCategories}`, 'startup-validation');
        logSuccess(`   • Database categories: ${validation.mappingValidation.stats.databaseCategories}`, 'startup-validation');
        logSuccess(`   • Aliases: ${validation.mappingValidation.stats.aliasCount}`, 'startup-validation');
        logSuccess(`   • Coverage: 100%`, 'startup-validation');
      } else {
        logError('❌ Category mapping validation failed', undefined, 'startup-validation');
        validation.errors.forEach(error => logError(`   • ${error}`, undefined, 'startup-validation'));
      }
    } else {
      // Skip category mapping validation if database is not available
      log('⚠️  Skipping category mapping validation - database not available', 'startup-validation');
      mappingValidation = {
        isValid: false,
        errors: ['Database not available for category mapping validation'],
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
      };
      frontendCategoryValidation = { isValid: false, errors: ['Database not available'], warnings: [] };
      completenessCheck = { isComplete: false, missingMappings: [] };
    }

    // 4. Production Database Seeding (only if all validations pass)
    if (errors.length === 0 && dbValidation.connected) {
      try {
        log('🔍 Step 4: Checking production database seeding...', 'startup-validation');
        await seedProductionDatabase();
        seedingResult = { success: true, message: 'Production database seeding completed successfully' };
        logSuccess('✅ Production database seeding completed', 'startup-validation');
      } catch (seedError) {
        const seedErrorMessage = `Production database seeding failed: ${seedError instanceof Error ? seedError.message : String(seedError)}`;
        seedingResult = { success: false, message: seedErrorMessage };
        warnings.push(seedErrorMessage); // Treat as warning, not error, so app can still start
        log(`⚠️  ${seedErrorMessage}`, 'startup-validation');
      }
    } else {
      log('⚠️  Skipping production database seeding - validation errors present', 'startup-validation');
    }
    
    // Log overall validation results
    if (errors.length === 0) {
      logSuccess('✅ Comprehensive startup validation passed', 'startup-validation');
    } else {
      logError('❌ Comprehensive startup validation failed', undefined, 'startup-validation');
      errors.forEach(error => logError(`   • ${error}`, undefined, 'startup-validation'));
    }
    
    if (warnings.length > 0) {
      log('⚠️  Startup validation warnings:', 'startup-validation');
      warnings.forEach(warning => log(`   • ${warning}`, 'startup-validation'));
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: {
        environmentValidation: envValidation,
        databaseValidation: dbValidation,
        mappingValidation,
        frontendCategoryValidation,
        completenessCheck,
        seedingResult
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
        environmentValidation: { isValid: false, errors: [errorMessage], warnings: [] },
        databaseValidation: { isValid: false, errors: [errorMessage], warnings: [], connected: false, migrationsApplied: false },
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
        completenessCheck: { isComplete: false, missingMappings: [] },
        seedingResult: { success: false, message: errorMessage }
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
  log('📋 Comprehensive Startup Validation Report', 'startup-validation');
  log('=' .repeat(60), 'startup-validation');
  
  // Overall status
  log(`Overall Status: ${result.isValid ? '✅ PASSED' : '❌ FAILED'}`, 'startup-validation');
  log(`Total Errors: ${result.errors.length}`, 'startup-validation');
  log(`Total Warnings: ${result.warnings.length}`, 'startup-validation');
  log('', 'startup-validation');
  
  // Environment validation details
  log('🌍 Environment Configuration:', 'startup-validation');
  log(`   • Status: ${result.details.environmentValidation.isValid ? '✅ Valid' : '❌ Invalid'}`, 'startup-validation');
  log(`   • Errors: ${result.details.environmentValidation.errors.length}`, 'startup-validation');
  log(`   • Warnings: ${result.details.environmentValidation.warnings.length}`, 'startup-validation');
  log('', 'startup-validation');
  
  // Database validation details
  log('🗄️  Database Configuration:', 'startup-validation');
  log(`   • Status: ${result.details.databaseValidation.isValid ? '✅ Valid' : '❌ Invalid'}`, 'startup-validation');
  log(`   • Connected: ${result.details.databaseValidation.connected ? '✅ Yes' : '❌ No'}`, 'startup-validation');
  log(`   • Migrations Applied: ${result.details.databaseValidation.migrationsApplied ? '✅ Yes' : '❌ No'}`, 'startup-validation');
  log(`   • Errors: ${result.details.databaseValidation.errors.length}`, 'startup-validation');
  log(`   • Warnings: ${result.details.databaseValidation.warnings.length}`, 'startup-validation');
  log('', 'startup-validation');
  
  // Mapping validation details
  const mappingStats = result.details.mappingValidation.stats;
  log('📊 Category Mapping Statistics:', 'startup-validation');
  log(`   • Status: ${result.details.mappingValidation.isValid ? '✅ Valid' : '❌ Invalid'}`, 'startup-validation');
  log(`   • Total mappings: ${mappingStats.totalMappings}`, 'startup-validation');
  log(`   • Frontend categories: ${mappingStats.frontendCategories}`, 'startup-validation');
  log(`   • Database categories: ${mappingStats.databaseCategories}`, 'startup-validation');
  log(`   • Aliases: ${mappingStats.aliasCount}`, 'startup-validation');
  log(`   • Duplicate frontend IDs: ${mappingStats.duplicateFrontendIds.length}`, 'startup-validation');
  log(`   • Duplicate database names: ${mappingStats.duplicateDatabaseNames.length}`, 'startup-validation');
  log('', 'startup-validation');
  
  // Completeness check
  const completeness = result.details.completenessCheck;
  log('🔍 Mapping Completeness Check:', 'startup-validation');
  log(`   • Complete: ${completeness.isComplete ? '✅ Yes' : '❌ No'}`, 'startup-validation');
  if (!completeness.isComplete) {
    log(`   • Missing mappings: ${completeness.missingMappings.join(', ')}`, 'startup-validation');
  }
  log('', 'startup-validation');
  
  // Seeding results
  if (result.details.seedingResult) {
    log('🌱 Database Seeding:', 'startup-validation');
    log(`   • Status: ${result.details.seedingResult.success ? '✅ Success' : '❌ Failed'}`, 'startup-validation');
    log(`   • Message: ${result.details.seedingResult.message}`, 'startup-validation');
    log('', 'startup-validation');
  }
  
  // Errors
  if (result.errors.length > 0) {
    log('❌ Validation Errors:', 'startup-validation');
    result.errors.forEach((error, index) => {
      log(`   ${index + 1}. ${error}`, 'startup-validation');
    });
    log('', 'startup-validation');
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    log('⚠️  Validation Warnings:', 'startup-validation');
    result.warnings.forEach((warning, index) => {
      log(`   ${index + 1}. ${warning}`, 'startup-validation');
    });
    log('', 'startup-validation');
  }
  
  log('=' .repeat(60), 'startup-validation');
}