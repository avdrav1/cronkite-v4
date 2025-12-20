#!/usr/bin/env tsx

/**
 * Category Mapping Validation Utility
 * 
 * This script provides comprehensive validation and reporting for the category mapping system.
 * It can be used to check mapping completeness, validate seeded data, and generate reports.
 */

// Load environment variables
import '../server/env.js';
import { createClient } from '@supabase/supabase-js';
import { CategoryMappingUtils, categoryMappingService } from '../shared/category-mapping.js';
import { CATEGORIES } from '../client/src/data/categories.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'all';

function printHeader(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printSection(title: string) {
  console.log('\n' + '-'.repeat(40));
  console.log(`  ${title}`);
  console.log('-'.repeat(40));
}

async function validateMappingCompleteness() {
  printSection('Category Mapping Completeness');
  
  const expectedCategories = CATEGORIES.map(cat => cat.id);
  const validation = CategoryMappingUtils.performStartupValidation(expectedCategories);
  
  console.log(`Status: ${validation.isValid ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Total Errors: ${validation.errors.length}`);
  console.log(`Total Warnings: ${validation.warnings.length}`);
  
  if (validation.errors.length > 0) {
    console.log('\n❌ Errors:');
    validation.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  // Mapping statistics
  const stats = validation.mappingValidation.stats;
  console.log('\n📊 Mapping Statistics:');
  console.log(`   • Total mappings: ${stats.totalMappings}`);
  console.log(`   • Frontend categories: ${stats.frontendCategories}`);
  console.log(`   • Database categories: ${stats.databaseCategories}`);
  console.log(`   • Aliases: ${stats.aliasCount}`);
  
  return validation.isValid;
}

async function validateFrontendCategories() {
  printSection('Frontend Category Validation');
  
  const expectedCategories = CATEGORIES.map(cat => cat.id);
  const mappedCategories = categoryMappingService.getAllFrontendCategories();
  
  console.log(`Expected categories: ${expectedCategories.length}`);
  console.log(`Mapped categories: ${mappedCategories.length}`);
  
  // Check for missing mappings
  const missingMappings = expectedCategories.filter(cat => !mappedCategories.includes(cat));
  const extraMappings = mappedCategories.filter(cat => !expectedCategories.includes(cat));
  
  if (missingMappings.length === 0 && extraMappings.length === 0) {
    console.log('✅ All frontend categories have valid mappings');
    return true;
  }
  
  if (missingMappings.length > 0) {
    console.log('\n❌ Missing mappings for frontend categories:');
    missingMappings.forEach(cat => console.log(`   - ${cat}`));
  }
  
  if (extraMappings.length > 0) {
    console.log('\n⚠️  Extra mappings not in frontend categories:');
    extraMappings.forEach(cat => console.log(`   - ${cat}`));
  }
  
  return missingMappings.length === 0;
}

async function showMappingTable() {
  printSection('Category Mapping Table');
  
  const expectedCategories = CATEGORIES.map(cat => cat.id);
  
  console.log('Frontend ID → Database Category');
  console.log('-'.repeat(40));
  
  expectedCategories.forEach(frontendId => {
    const dbCategory = categoryMappingService.frontendToDatabase(frontendId);
    const status = dbCategory ? '✅' : '❌';
    console.log(`${status} ${frontendId.padEnd(15)} → ${dbCategory || 'NO MAPPING'}`);
  });
  
  // Show reverse mappings for verification
  console.log('\nDatabase Category → Frontend ID');
  console.log('-'.repeat(40));
  
  const dbCategories = categoryMappingService.getAllDatabaseCategories();
  dbCategories.forEach(dbCategory => {
    const frontendId = categoryMappingService.databaseToFrontend(dbCategory);
    const status = frontendId ? '✅' : '❌';
    console.log(`${status} ${dbCategory.padEnd(15)} → ${frontendId || 'NO MAPPING'}`);
  });
}

async function validateSeededDataCoverage(seededCategories: string[]): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  coveragePercentage: number;
}> {
  console.log('🔍 Validating seeded data category coverage...');
  
  try {
    const validation = CategoryMappingUtils.validateSeededDataCoverage(seededCategories);
    
    if (validation.isValid) {
      console.log(`✅ Seeded data coverage validation passed (${validation.coverage.coveragePercentage.toFixed(1)}%)`);
      console.log(`📊 Coverage Details:`);
      console.log(`   • Total frontend categories: ${validation.coverage.totalFrontendCategories}`);
      console.log(`   • Covered categories: ${validation.coverage.coveredCategories.length}`);
      console.log(`   • Coverage percentage: ${validation.coverage.coveragePercentage.toFixed(1)}%`);
    } else {
      console.log('❌ Seeded data coverage validation failed');
      validation.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('⚠️  Seeded data coverage warnings:');
      validation.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      coveragePercentage: validation.coverage.coveragePercentage
    };
    
  } catch (error) {
    const errorMessage = `Failed to validate seeded data coverage: ${error instanceof Error ? error.message : String(error)}`;
    console.log(errorMessage);
    
    return {
      isValid: false,
      errors: [errorMessage],
      warnings: [],
      coveragePercentage: 0
    };
  }
}

async function validateSeededData() {
  printSection('Seeded Data Validation');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  Skipping seeded data validation - Supabase configuration not available');
    return true;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔍 Fetching seeded data from database...');
    const { data, error } = await supabase
      .from('recommended_feeds')
      .select('category');
    
    if (error) {
      console.error('❌ Error fetching seeded data:', error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️  No seeded data found in database');
      return true;
    }
    
    const seededCategories = [...new Set(data.map((row: any) => row.category))];
    console.log(`📊 Found ${data.length} feeds across ${seededCategories.length} categories`);
    
    // Validate coverage
    const validation = await validateSeededDataCoverage(seededCategories);
    
    console.log(`Status: ${validation.isValid ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Coverage: ${validation.coveragePercentage.toFixed(1)}%`);
    
    if (validation.errors.length > 0) {
      console.log('\n❌ Errors:');
      validation.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }
    
    // Show category distribution
    const categoryCount: Record<string, number> = {};
    data.forEach((row: any) => {
      categoryCount[row.category] = (categoryCount[row.category] || 0) + 1;
    });
    
    console.log('\n📊 Category distribution in database:');
    Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const frontendId = categoryMappingService.databaseToFrontend(category);
        const status = frontendId ? '✅' : '❌';
        console.log(`   ${status} ${category} (${frontendId || 'NO MAPPING'}): ${count} feeds`);
      });
    
    return validation.isValid;
    
  } catch (error) {
    console.error('❌ Error validating seeded data:', error);
    return false;
  }
}

async function showUsageHelp() {
  console.log('\nCategory Mapping Validation Utility');
  console.log('Usage: npm run validate:categories [command]');
  console.log('\nCommands:');
  console.log('  all              Run all validations (default)');
  console.log('  mapping          Validate mapping completeness');
  console.log('  frontend         Validate frontend categories');
  console.log('  table            Show mapping table');
  console.log('  seeded           Validate seeded data coverage');
  console.log('  help             Show this help message');
  console.log('\nExamples:');
  console.log('  npm run validate:categories');
  console.log('  npm run validate:categories mapping');
  console.log('  npm run validate:categories table');
}

async function main() {
  printHeader('Category Mapping Validation Utility');
  
  let allPassed = true;
  
  switch (command) {
    case 'mapping':
      allPassed = await validateMappingCompleteness();
      break;
      
    case 'frontend':
      allPassed = await validateFrontendCategories();
      break;
      
    case 'table':
      await showMappingTable();
      break;
      
    case 'seeded':
      allPassed = await validateSeededData();
      break;
      
    case 'help':
      await showUsageHelp();
      break;
      
    case 'all':
    default:
      console.log('Running comprehensive validation...');
      
      const mappingPassed = await validateMappingCompleteness();
      const frontendPassed = await validateFrontendCategories();
      const seededPassed = await validateSeededData();
      
      await showMappingTable();
      
      allPassed = mappingPassed && frontendPassed && seededPassed;
      
      printSection('Summary');
      console.log(`Mapping Completeness: ${mappingPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Frontend Categories: ${frontendPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Seeded Data Coverage: ${seededPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Overall Status: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
      break;
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (!allPassed && command !== 'help' && command !== 'table') {
    console.log('❌ Validation failed - please fix the issues above');
    process.exit(1);
  } else if (command !== 'help' && command !== 'table') {
    console.log('✅ All validations passed successfully');
  }
}

main().catch(error => {
  console.error('❌ Validation script failed:', error);
  process.exit(1);
});