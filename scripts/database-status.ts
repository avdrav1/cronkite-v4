#!/usr/bin/env tsx

/**
 * Database Status Utility
 * 
 * This script provides comprehensive database status information including:
 * - Connection status
 * - Feed counts and distribution
 * - Category mapping validation
 * - Data integrity checks
 */

// Load environment variables
import '../server/env';
import { createClient } from '@supabase/supabase-js';
import { categoryMappingService, CategoryMappingUtils } from '../shared/category-mapping';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function checkDatabaseConnection() {
  printSection('Database Connection');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Missing Supabase configuration');
    console.log('   SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
    return false;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test connection with a simple query
    const { data, error } = await supabase
      .from('recommended_feeds')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Database connection failed');
      console.log(`   Error: ${error.message}`);
      return false;
    }
    
    console.log('✅ Database connection successful');
    console.log(`   URL: ${supabaseUrl}`);
    return true;
    
  } catch (error) {
    console.log('❌ Database connection failed');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function checkFeedCounts() {
  printSection('Feed Statistics');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  Skipping feed statistics - database not configured');
    return;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get total count
    const { count, error } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Error getting feed count:', error.message);
      return;
    }
    
    console.log(`📊 Total feeds: ${count || 0}`);
    
    if (count === 0) {
      console.log('⚠️  No feeds found in database');
      console.log('   Run: npm run db:seed (for 105 feeds) or npm run db:seed:comprehensive (for 865 feeds)');
      return;
    }
    
    // Get featured feeds count
    const { count: featuredCount, error: featuredError } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('is_featured', true);
    
    if (!featuredError) {
      console.log(`⭐ Featured feeds: ${featuredCount || 0}`);
    }
    
    // Determine environment based on feed count
    let environment = 'Unknown';
    if (count <= 20) {
      environment = 'Minimal/Test';
    } else if (count <= 150) {
      environment = 'Development (105 feeds)';
    } else if (count >= 800) {
      environment = 'Production (865 feeds)';
    } else {
      environment = 'Custom';
    }
    
    console.log(`🏷️  Environment: ${environment}`);
    
  } catch (error) {
    console.log('❌ Error checking feed statistics:', error);
  }
}

async function checkCategoryDistribution() {
  printSection('Category Distribution');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  Skipping category distribution - database not configured');
    return;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: feeds, error } = await supabase
      .from('recommended_feeds')
      .select('category');
    
    if (error) {
      console.log('❌ Error getting category data:', error.message);
      return;
    }
    
    if (!feeds || feeds.length === 0) {
      console.log('⚠️  No feeds found for category analysis');
      return;
    }
    
    const categoryCount: Record<string, number> = {};
    feeds.forEach((feed: any) => {
      categoryCount[feed.category] = (categoryCount[feed.category] || 0) + 1;
    });
    
    console.log('📊 Feeds by category:');
    Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const frontendId = categoryMappingService.databaseToFrontend(category);
        const status = frontendId ? '✅' : '❌';
        const percentage = ((count / feeds.length) * 100).toFixed(1);
        console.log(`   ${status} ${category.padEnd(15)} (${frontendId || 'NO MAPPING'.padEnd(12)}): ${count.toString().padStart(3)} feeds (${percentage}%)`);
      });
    
    // Check for unmapped categories
    const unmappedCategories = Object.keys(categoryCount).filter(
      category => !categoryMappingService.databaseToFrontend(category)
    );
    
    if (unmappedCategories.length > 0) {
      console.log('\n❌ Categories without frontend mapping:');
      unmappedCategories.forEach(category => {
        console.log(`   - ${category} (${categoryCount[category]} feeds)`);
      });
    }
    
  } catch (error) {
    console.log('❌ Error checking category distribution:', error);
  }
}

async function checkMappingStatus() {
  printSection('Category Mapping Status');
  
  try {
    // Get all frontend categories from the categories data
    const { CATEGORIES } = await import('../client/src/data/categories.js');
    const expectedCategories = CATEGORIES.map((cat: any) => cat.id);
    
    const validation = CategoryMappingUtils.performStartupValidation(expectedCategories);
    
    console.log(`Status: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Errors: ${validation.errors.length}`);
    console.log(`Warnings: ${validation.warnings.length}`);
    
    const stats = validation.mappingValidation.stats;
    console.log(`Total mappings: ${stats.totalMappings}`);
    console.log(`Frontend categories: ${stats.frontendCategories}`);
    console.log(`Database categories: ${stats.databaseCategories}`);
    console.log(`Aliases: ${stats.aliasCount}`);
    
    if (validation.errors.length > 0) {
      console.log('\n❌ Mapping Errors:');
      validation.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      if (validation.errors.length > 5) {
        console.log(`   ... and ${validation.errors.length - 5} more errors`);
      }
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Mapping Warnings:');
      validation.warnings.slice(0, 3).forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
      if (validation.warnings.length > 3) {
        console.log(`   ... and ${validation.warnings.length - 3} more warnings`);
      }
    }
    
  } catch (error) {
    console.log('❌ Error checking mapping status:', error);
  }
}

async function checkDataIntegrity() {
  printSection('Data Integrity');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  Skipping data integrity checks - database not configured');
    return;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check for feeds with missing required fields
    const { data: feeds, error } = await supabase
      .from('recommended_feeds')
      .select('id, name, url, category, description');
    
    if (error) {
      console.log('❌ Error checking data integrity:', error.message);
      return;
    }
    
    if (!feeds || feeds.length === 0) {
      console.log('⚠️  No feeds to check');
      return;
    }
    
    let issues = 0;
    
    // Check for missing names
    const missingNames = feeds.filter((feed: any) => !feed.name || feed.name.trim() === '');
    if (missingNames.length > 0) {
      console.log(`❌ ${missingNames.length} feeds missing names`);
      issues += missingNames.length;
    }
    
    // Check for missing URLs
    const missingUrls = feeds.filter((feed: any) => !feed.url || feed.url.trim() === '');
    if (missingUrls.length > 0) {
      console.log(`❌ ${missingUrls.length} feeds missing URLs`);
      issues += missingUrls.length;
    }
    
    // Check for missing categories
    const missingCategories = feeds.filter((feed: any) => !feed.category || feed.category.trim() === '');
    if (missingCategories.length > 0) {
      console.log(`❌ ${missingCategories.length} feeds missing categories`);
      issues += missingCategories.length;
    }
    
    // Check for invalid categories
    const invalidCategories = feeds.filter((feed: any) => 
      feed.category && !categoryMappingService.isValidDatabaseCategory(feed.category)
    );
    if (invalidCategories.length > 0) {
      console.log(`❌ ${invalidCategories.length} feeds with invalid categories`);
      issues += invalidCategories.length;
    }
    
    if (issues === 0) {
      console.log('✅ No data integrity issues found');
    } else {
      console.log(`❌ Found ${issues} data integrity issues`);
    }
    
  } catch (error) {
    console.log('❌ Error checking data integrity:', error);
  }
}

async function showRecommendations() {
  printSection('Recommendations');
  
  const recommendations: string[] = [];
  
  // Check if database is configured
  if (!supabaseUrl || !supabaseServiceKey) {
    recommendations.push('Configure Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }
  
  // Check if database has data
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { count } = await supabase
        .from('recommended_feeds')
        .select('*', { count: 'exact', head: true });
      
      if (count === 0) {
        recommendations.push('Seed the database with feeds:');
        recommendations.push('  • npm run db:seed (for development - 105 feeds)');
        recommendations.push('  • npm run db:seed:comprehensive (for production - 865 feeds)');
      } else if (count && count < 50) {
        recommendations.push('Consider using comprehensive seeding for better testing:');
        recommendations.push('  • npm run db:seed:comprehensive');
      }
    } catch (error) {
      recommendations.push('Fix database connection issues before proceeding');
    }
  }
  
  // Always recommend validation
  recommendations.push('Run category mapping validation:');
  recommendations.push('  • npm run validate:categories:all');
  
  if (recommendations.length === 0) {
    console.log('✅ No specific recommendations - system appears healthy');
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
}

async function main() {
  printHeader('Database Status Report');
  
  const connectionOk = await checkDatabaseConnection();
  await checkFeedCounts();
  await checkCategoryDistribution();
  await checkMappingStatus();
  await checkDataIntegrity();
  await showRecommendations();
  
  printSection('Summary');
  console.log(`Database Connection: ${connectionOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  console.log('\n' + '='.repeat(60));
  
  if (!connectionOk) {
    console.log('❌ Database connection failed - check configuration');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Database status check failed:', error);
  process.exit(1);
});