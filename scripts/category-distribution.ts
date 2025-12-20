#!/usr/bin/env tsx

/**
 * Category Distribution Analysis Utility
 * 
 * This script provides detailed analysis of category distribution in the database,
 * including coverage analysis, mapping validation, and recommendations for
 * improving category balance.
 */

// Load environment variables
import '../server/env';
import { createClient } from '@supabase/supabase-js';
import { categoryMappingService } from '../shared/category-mapping';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Command line arguments
const args = process.argv.slice(2);
const format = args[0] || 'detailed'; // detailed, summary, csv

interface CategoryStats {
  databaseCategory: string;
  frontendId: string | null;
  feedCount: number;
  percentage: number;
  featuredCount: number;
  averagePopularity: number;
  isMapped: boolean;
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

async function getCategoryStats(): Promise<CategoryStats[]> {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: feeds, error } = await supabase
    .from('recommended_feeds')
    .select('category, is_featured, popularity_score');
  
  if (error) {
    throw new Error(`Error fetching feeds: ${error.message}`);
  }
  
  if (!feeds || feeds.length === 0) {
    return [];
  }
  
  // Group by category
  const categoryGroups: Record<string, any[]> = {};
  feeds.forEach((feed: any) => {
    if (!categoryGroups[feed.category]) {
      categoryGroups[feed.category] = [];
    }
    categoryGroups[feed.category].push(feed);
  });
  
  // Calculate stats for each category
  const stats: CategoryStats[] = Object.entries(categoryGroups).map(([category, categoryFeeds]) => {
    const feedCount = categoryFeeds.length;
    const percentage = (feedCount / feeds.length) * 100;
    const featuredCount = categoryFeeds.filter(feed => feed.is_featured).length;
    const averagePopularity = categoryFeeds.reduce((sum, feed) => sum + (feed.popularity_score || 0), 0) / feedCount;
    const frontendId = categoryMappingService.databaseToFrontend(category);
    const isMapped = frontendId !== null;
    
    return {
      databaseCategory: category,
      frontendId,
      feedCount,
      percentage,
      featuredCount,
      averagePopularity,
      isMapped
    };
  });
  
  return stats.sort((a, b) => b.feedCount - a.feedCount);
}

async function showDetailedDistribution(stats: CategoryStats[]) {
  printSection('Detailed Category Distribution');
  
  if (stats.length === 0) {
    console.log('⚠️  No feeds found in database');
    return;
  }
  
  const totalFeeds = stats.reduce((sum, stat) => sum + stat.feedCount, 0);
  
  console.log(`📊 Total feeds analyzed: ${totalFeeds}`);
  console.log(`📊 Categories found: ${stats.length}`);
  console.log(`📊 Mapped categories: ${stats.filter(s => s.isMapped).length}`);
  console.log(`📊 Unmapped categories: ${stats.filter(s => !s.isMapped).length}`);
  
  console.log('\nCategory Details:');
  console.log('Status | Database Category    | Frontend ID      | Feeds | %     | Featured | Avg Pop');
  console.log('-'.repeat(85));
  
  stats.forEach(stat => {
    const status = stat.isMapped ? '✅' : '❌';
    const frontendId = stat.frontendId || 'NO MAPPING';
    const percentage = stat.percentage.toFixed(1).padStart(5);
    const avgPop = stat.averagePopularity.toFixed(0).padStart(3);
    
    console.log(
      `${status}     | ${stat.databaseCategory.padEnd(20)} | ${frontendId.padEnd(16)} | ${stat.feedCount.toString().padStart(5)} | ${percentage}% | ${stat.featuredCount.toString().padStart(8)} | ${avgPop}`
    );
  });
}

async function showSummaryDistribution(stats: CategoryStats[]) {
  printSection('Category Distribution Summary');
  
  if (stats.length === 0) {
    console.log('⚠️  No feeds found in database');
    return;
  }
  
  const totalFeeds = stats.reduce((sum, stat) => sum + stat.feedCount, 0);
  const mappedStats = stats.filter(s => s.isMapped);
  const unmappedStats = stats.filter(s => !s.isMapped);
  
  console.log(`Total feeds: ${totalFeeds}`);
  console.log(`Categories: ${stats.length} (${mappedStats.length} mapped, ${unmappedStats.length} unmapped)`);
  
  if (mappedStats.length > 0) {
    console.log('\nTop 10 Categories by Feed Count:');
    mappedStats.slice(0, 10).forEach((stat, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${stat.databaseCategory} (${stat.frontendId}): ${stat.feedCount} feeds (${stat.percentage.toFixed(1)}%)`);
    });
  }
  
  if (unmappedStats.length > 0) {
    console.log('\n❌ Unmapped Categories:');
    unmappedStats.forEach(stat => {
      console.log(`   - ${stat.databaseCategory}: ${stat.feedCount} feeds`);
    });
  }
}

async function showCsvDistribution(stats: CategoryStats[]) {
  console.log('database_category,frontend_id,feed_count,percentage,featured_count,average_popularity,is_mapped');
  
  stats.forEach(stat => {
    console.log([
      stat.databaseCategory,
      stat.frontendId || '',
      stat.feedCount,
      stat.percentage.toFixed(2),
      stat.featuredCount,
      stat.averagePopularity.toFixed(2),
      stat.isMapped
    ].join(','));
  });
}

async function analyzeCoverage(stats: CategoryStats[]) {
  printSection('Coverage Analysis');
  
  try {
    // Get all expected frontend categories
    const { CATEGORIES } = await import('../client/src/data/categories.js');
    const expectedCategories = CATEGORIES.map((cat: any) => cat.id);
    
    const mappedFrontendIds = stats
      .filter(s => s.isMapped && s.frontendId)
      .map(s => s.frontendId as string);
    
    const coveredCategories = expectedCategories.filter(id => mappedFrontendIds.includes(id));
    const missingCategories = expectedCategories.filter(id => !mappedFrontendIds.includes(id));
    
    const coveragePercentage = (coveredCategories.length / expectedCategories.length) * 100;
    
    console.log(`📊 Frontend category coverage: ${coveragePercentage.toFixed(1)}% (${coveredCategories.length}/${expectedCategories.length})`);
    
    if (missingCategories.length > 0) {
      console.log('\n❌ Missing frontend categories (no feeds in database):');
      missingCategories.forEach(category => {
        const dbCategory = categoryMappingService.frontendToDatabase(category);
        console.log(`   - ${category} → ${dbCategory || 'NO MAPPING'}`);
      });
    } else {
      console.log('✅ All frontend categories are represented in the database');
    }
    
    // Analyze distribution balance
    if (stats.length > 0) {
      const feedCounts = stats.map(s => s.feedCount);
      const minFeeds = Math.min(...feedCounts);
      const maxFeeds = Math.max(...feedCounts);
      const avgFeeds = feedCounts.reduce((sum, count) => sum + count, 0) / feedCounts.length;
      
      console.log('\n📊 Distribution Balance:');
      console.log(`   Min feeds per category: ${minFeeds}`);
      console.log(`   Max feeds per category: ${maxFeeds}`);
      console.log(`   Average feeds per category: ${avgFeeds.toFixed(1)}`);
      console.log(`   Balance ratio: ${(minFeeds / maxFeeds * 100).toFixed(1)}%`);
      
      // Identify imbalanced categories
      const threshold = avgFeeds * 0.5; // Categories with less than 50% of average
      const underrepresented = stats.filter(s => s.feedCount < threshold && s.isMapped);
      
      if (underrepresented.length > 0) {
        console.log('\n⚠️  Underrepresented categories (< 50% of average):');
        underrepresented.forEach(stat => {
          console.log(`   - ${stat.databaseCategory} (${stat.frontendId}): ${stat.feedCount} feeds`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Error analyzing coverage:', error);
  }
}

async function showRecommendations(stats: CategoryStats[]) {
  printSection('Recommendations');
  
  const recommendations: string[] = [];
  
  // Check for unmapped categories
  const unmappedStats = stats.filter(s => !s.isMapped);
  if (unmappedStats.length > 0) {
    recommendations.push(`Fix ${unmappedStats.length} unmapped categories in category-mapping.ts`);
  }
  
  // Check for missing categories
  try {
    const { CATEGORIES } = await import('../client/src/data/categories.js');
    const expectedCategories = CATEGORIES.map((cat: any) => cat.id);
    const mappedFrontendIds = stats
      .filter(s => s.isMapped && s.frontendId)
      .map(s => s.frontendId as string);
    const missingCategories = expectedCategories.filter(id => !mappedFrontendIds.includes(id));
    
    if (missingCategories.length > 0) {
      recommendations.push(`Add feeds for ${missingCategories.length} missing frontend categories`);
    }
  } catch (error) {
    recommendations.push('Check frontend categories configuration');
  }
  
  // Check for balance issues
  if (stats.length > 0) {
    const feedCounts = stats.map(s => s.feedCount);
    const avgFeeds = feedCounts.reduce((sum, count) => sum + count, 0) / feedCounts.length;
    const underrepresented = stats.filter(s => s.feedCount < avgFeeds * 0.5 && s.isMapped);
    
    if (underrepresented.length > 0) {
      recommendations.push(`Balance distribution for ${underrepresented.length} underrepresented categories`);
    }
  }
  
  // Environment-specific recommendations
  const totalFeeds = stats.reduce((sum, stat) => sum + stat.feedCount, 0);
  if (totalFeeds < 50) {
    recommendations.push('Consider using comprehensive seeding: npm run db:seed:comprehensive');
  } else if (totalFeeds > 1000) {
    recommendations.push('Consider optimizing feed count for better performance');
  }
  
  if (recommendations.length === 0) {
    console.log('✅ No specific recommendations - distribution looks good');
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
}

async function showUsageHelp() {
  console.log('\nCategory Distribution Analysis Utility');
  console.log('Usage: npm run category:distribution [format]');
  console.log('\nFormats:');
  console.log('  detailed         Show detailed distribution table (default)');
  console.log('  summary          Show summary statistics');
  console.log('  csv              Output in CSV format');
  console.log('  help             Show this help message');
  console.log('\nExamples:');
  console.log('  npm run category:distribution');
  console.log('  npm run category:distribution summary');
  console.log('  npm run category:distribution csv > distribution.csv');
}

async function main() {
  if (format === 'help') {
    await showUsageHelp();
    return;
  }
  
  try {
    const stats = await getCategoryStats();
    
    switch (format) {
      case 'summary':
        printHeader('Category Distribution Summary');
        await showSummaryDistribution(stats);
        break;
        
      case 'csv':
        await showCsvDistribution(stats);
        return; // Don't show additional sections for CSV
        
      case 'detailed':
      default:
        printHeader('Category Distribution Analysis');
        await showDetailedDistribution(stats);
        await analyzeCoverage(stats);
        await showRecommendations(stats);
        break;
    }
    
    if (format !== 'csv') {
      console.log('\n' + '='.repeat(60));
    }
    
  } catch (error) {
    console.error('❌ Category distribution analysis failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});