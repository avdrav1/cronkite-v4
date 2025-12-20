#!/usr/bin/env tsx

/**
 * Category Mapping Status Utility
 * 
 * This script provides comprehensive status information about the category mapping system,
 * including mapping completeness, validation results, and health checks.
 */

// Load environment variables
import '../server/env';
import { createClient } from '@supabase/supabase-js';
import { categoryMappingService, CategoryMappingUtils } from '../shared/category-mapping';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Command line arguments
const args = process.argv.slice(2);
const format = args[0] || 'detailed'; // detailed, summary, json

interface MappingStatus {
  isValid: boolean;
  totalMappings: number;
  frontendCategories: number;
  databaseCategories: number;
  aliasCount: number;
  errors: string[];
  warnings: string[];
  coverage: {
    percentage: number;
    covered: string[];
    missing: string[];
  };
  databaseStatus: {
    connected: boolean;
    feedCount: number;
    categoriesInUse: string[];
    unmappedInDatabase: string[];
  };
}

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

async function getMappingStatus(): Promise<MappingStatus> {
  // Get frontend categories
  let expectedCategories: string[] = [];
  try {
    const { CATEGORIES } = await import('../client/src/data/categories.js');
    expectedCategories = CATEGORIES.map((cat: any) => cat.id);
  } catch (error) {
    console.warn('⚠️  Could not load frontend categories');
  }
  
  // Validate mapping
  const validation = CategoryMappingUtils.performStartupValidation(expectedCategories);
  const stats = validation.mappingValidation.stats;
  
  // Calculate coverage
  const mappedCategories = categoryMappingService.getAllFrontendCategories();
  const covered = expectedCategories.filter(cat => mappedCategories.includes(cat));
  const missing = expectedCategories.filter(cat => !mappedCategories.includes(cat));
  const coveragePercentage = expectedCategories.length > 0 ? (covered.length / expectedCategories.length) * 100 : 0;
  
  // Check database status
  let databaseStatus = {
    connected: false,
    feedCount: 0,
    categoriesInUse: [] as string[],
    unmappedInDatabase: [] as string[]
  };
  
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Test connection and get feed count
      const { count, error: countError } = await supabase
        .from('recommended_feeds')
        .select('*', { count: 'exact', head: true });
      
      if (!countError) {
        databaseStatus.connected = true;
        databaseStatus.feedCount = count || 0;
        
        // Get categories in use
        const { data: feeds, error: feedsError } = await supabase
          .from('recommended_feeds')
          .select('category');
        
        if (!feedsError && feeds) {
          const categoriesInUse = [...new Set(feeds.map((feed: any) => feed.category))];
          databaseStatus.categoriesInUse = categoriesInUse;
          databaseStatus.unmappedInDatabase = categoriesInUse.filter(
            category => !categoryMappingService.isValidDatabaseCategory(category)
          );
        }
      }
    } catch (error) {
      // Database connection failed, but that's okay for this status check
    }
  }
  
  return {
    isValid: validation.isValid,
    totalMappings: stats.totalMappings,
    frontendCategories: stats.frontendCategories,
    databaseCategories: stats.databaseCategories,
    aliasCount: stats.aliasCount,
    errors: validation.errors,
    warnings: validation.warnings,
    coverage: {
      percentage: coveragePercentage,
      covered,
      missing
    },
    databaseStatus
  };
}

async function showDetailedStatus(status: MappingStatus) {
  printSection('Mapping Validation');
  
  console.log(`Status: ${status.isValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`Total mappings: ${status.totalMappings}`);
  console.log(`Frontend categories: ${status.frontendCategories}`);
  console.log(`Database categories: ${status.databaseCategories}`);
  console.log(`Aliases defined: ${status.aliasCount}`);
  
  if (status.errors.length > 0) {
    console.log('\n❌ Validation Errors:');
    status.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (status.warnings.length > 0) {
    console.log('\n⚠️  Validation Warnings:');
    status.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  printSection('Coverage Analysis');
  
  console.log(`Coverage: ${status.coverage.percentage.toFixed(1)}% (${status.coverage.covered.length}/${status.coverage.covered.length + status.coverage.missing.length})`);
  
  if (status.coverage.missing.length > 0) {
    console.log('\n❌ Missing mappings for frontend categories:');
    status.coverage.missing.forEach(category => {
      console.log(`   - ${category}`);
    });
  } else {
    console.log('✅ All frontend categories have mappings');
  }
  
  printSection('Database Integration');
  
  console.log(`Database connection: ${status.databaseStatus.connected ? '✅ Connected' : '❌ Not connected'}`);
  
  if (status.databaseStatus.connected) {
    console.log(`Feed count: ${status.databaseStatus.feedCount}`);
    console.log(`Categories in use: ${status.databaseStatus.categoriesInUse.length}`);
    
    if (status.databaseStatus.unmappedInDatabase.length > 0) {
      console.log('\n❌ Database categories without mappings:');
      status.databaseStatus.unmappedInDatabase.forEach(category => {
        console.log(`   - ${category}`);
      });
    } else if (status.databaseStatus.categoriesInUse.length > 0) {
      console.log('✅ All database categories have valid mappings');
    }
    
    // Show category usage
    if (status.databaseStatus.categoriesInUse.length > 0) {
      console.log('\n📊 Categories in database:');
      status.databaseStatus.categoriesInUse.forEach(category => {
        const frontendId = categoryMappingService.databaseToFrontend(category);
        const status = frontendId ? '✅' : '❌';
        console.log(`   ${status} ${category} → ${frontendId || 'NO MAPPING'}`);
      });
    }
  } else {
    console.log('⚠️  Database not configured or not accessible');
  }
  
  printSection('Mapping Table');
  
  const allFrontendCategories = categoryMappingService.getAllFrontendCategories();
  console.log('Frontend ID → Database Category');
  console.log('-'.repeat(40));
  
  allFrontendCategories.forEach(frontendId => {
    const dbCategory = categoryMappingService.frontendToDatabase(frontendId);
    const inUse = status.databaseStatus.categoriesInUse.includes(dbCategory || '');
    const usageIndicator = inUse ? '🔵' : '⚪';
    console.log(`${usageIndicator} ${frontendId.padEnd(15)} → ${dbCategory || 'ERROR'}`);
  });
  
  console.log('\nLegend: 🔵 = In use in database, ⚪ = Not in use');
}

async function showSummaryStatus(status: MappingStatus) {
  printSection('Category Mapping Status Summary');
  
  console.log(`Overall Status: ${status.isValid ? '✅ HEALTHY' : '❌ ISSUES FOUND'}`);
  console.log(`Mappings: ${status.totalMappings} total (${status.frontendCategories} frontend → ${status.databaseCategories} database)`);
  console.log(`Coverage: ${status.coverage.percentage.toFixed(1)}% (${status.coverage.missing.length} missing)`);
  console.log(`Database: ${status.databaseStatus.connected ? `✅ ${status.databaseStatus.feedCount} feeds` : '❌ Not connected'}`);
  console.log(`Issues: ${status.errors.length} errors, ${status.warnings.length} warnings`);
  
  if (status.errors.length > 0) {
    console.log('\n❌ Critical Issues:');
    status.errors.slice(0, 3).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    if (status.errors.length > 3) {
      console.log(`   ... and ${status.errors.length - 3} more errors`);
    }
  }
  
  if (status.coverage.missing.length > 0) {
    console.log('\n⚠️  Missing Mappings:');
    status.coverage.missing.slice(0, 5).forEach(category => {
      console.log(`   - ${category}`);
    });
    if (status.coverage.missing.length > 5) {
      console.log(`   ... and ${status.coverage.missing.length - 5} more`);
    }
  }
}

async function showJsonStatus(status: MappingStatus) {
  console.log(JSON.stringify(status, null, 2));
}

async function showHealthCheck(status: MappingStatus) {
  printSection('Health Check');
  
  const checks = [
    {
      name: 'Mapping Validation',
      passed: status.isValid,
      message: status.isValid ? 'All mappings are valid' : `${status.errors.length} validation errors`
    },
    {
      name: 'Coverage Completeness',
      passed: status.coverage.percentage >= 100,
      message: `${status.coverage.percentage.toFixed(1)}% coverage (${status.coverage.missing.length} missing)`
    },
    {
      name: 'Database Connection',
      passed: status.databaseStatus.connected,
      message: status.databaseStatus.connected ? 'Database accessible' : 'Database not accessible'
    },
    {
      name: 'Database Category Mapping',
      passed: status.databaseStatus.unmappedInDatabase.length === 0,
      message: status.databaseStatus.unmappedInDatabase.length === 0 
        ? 'All database categories mapped' 
        : `${status.databaseStatus.unmappedInDatabase.length} unmapped categories in database`
    }
  ];
  
  const passedChecks = checks.filter(check => check.passed).length;
  const totalChecks = checks.length;
  
  console.log(`Health Score: ${passedChecks}/${totalChecks} (${((passedChecks / totalChecks) * 100).toFixed(0)}%)`);
  
  checks.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    console.log(`${status} ${check.name}: ${check.message}`);
  });
  
  if (passedChecks === totalChecks) {
    console.log('\n🎉 All health checks passed - system is healthy!');
  } else {
    console.log(`\n⚠️  ${totalChecks - passedChecks} health check(s) failed - attention needed`);
  }
}

async function showUsageHelp() {
  console.log('\nCategory Mapping Status Utility');
  console.log('Usage: npm run category:mapping:status [format]');
  console.log('\nFormats:');
  console.log('  detailed         Show detailed status information (default)');
  console.log('  summary          Show summary status');
  console.log('  json             Output in JSON format');
  console.log('  health           Show health check results');
  console.log('  help             Show this help message');
  console.log('\nExamples:');
  console.log('  npm run category:mapping:status');
  console.log('  npm run category:mapping:status summary');
  console.log('  npm run category:mapping:status json > mapping-status.json');
}

async function main() {
  if (format === 'help') {
    await showUsageHelp();
    return;
  }
  
  try {
    const status = await getMappingStatus();
    
    switch (format) {
      case 'summary':
        printHeader('Category Mapping Status Summary');
        await showSummaryStatus(status);
        break;
        
      case 'json':
        await showJsonStatus(status);
        return; // Don't show additional sections for JSON
        
      case 'health':
        printHeader('Category Mapping Health Check');
        await showHealthCheck(status);
        break;
        
      case 'detailed':
      default:
        printHeader('Category Mapping Status Report');
        await showDetailedStatus(status);
        await showHealthCheck(status);
        break;
    }
    
    if (format !== 'json') {
      console.log('\n' + '='.repeat(60));
    }
    
    // Exit with error code if there are critical issues
    if (!status.isValid || status.coverage.percentage < 100) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Category mapping status check failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});