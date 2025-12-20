#!/usr/bin/env tsx

/**
 * Database Check Utility
 * 
 * This script provides a quick check of database contents with category mapping validation.
 * For more detailed analysis, use:
 * - npm run db:status (comprehensive database status)
 * - npm run category:distribution (detailed category analysis)
 * - npm run category:mapping:status (mapping validation)
 */

// Load environment variables
import '../server/env';
import { createClient } from '@supabase/supabase-js';
import { categoryMappingService } from '../shared/category-mapping';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('🔍 Checking database contents...');
  
  try {
    // Get total count
    const { count, error } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error querying database:', error);
      console.error(`   Error details: ${error.message}`);
      process.exit(1);
    }
    
    console.log(`📊 Total recommended feeds in database: ${count}`);
    
    if (count === 0) {
      console.log('⚠️  No feeds found in database');
      console.log('   Run: npm run db:seed (for development) or npm run db:seed:comprehensive (for production)');
      return;
    }
    
    // Determine environment based on count
    let environment = 'Unknown';
    if (count <= 20) {
      environment = 'Minimal/Test';
    } else if (count <= 150) {
      environment = 'Development (~105 feeds)';
    } else if (count >= 800) {
      environment = 'Production (~865 feeds)';
    } else {
      environment = 'Custom';
    }
    
    console.log(`🏷️  Detected environment: ${environment}`);
    
    // Get category distribution with mapping validation
    const { data: feeds, error: feedsError } = await supabase
      .from('recommended_feeds')
      .select('category, is_featured');
    
    if (feedsError) {
      console.error('❌ Error getting feeds:', feedsError);
      process.exit(1);
    }
    
    const categoryCount: Record<string, number> = {};
    const featuredCount: Record<string, number> = {};
    let unmappedCategories = 0;
    
    feeds?.forEach((feed: any) => {
      categoryCount[feed.category] = (categoryCount[feed.category] || 0) + 1;
      if (feed.is_featured) {
        featuredCount[feed.category] = (featuredCount[feed.category] || 0) + 1;
      }
      
      // Check if category has valid mapping
      if (!categoryMappingService.isValidDatabaseCategory(feed.category)) {
        unmappedCategories++;
      }
    });
    
    console.log('📊 Feed distribution by category:');
    Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
      const frontendId = categoryMappingService.databaseToFrontend(category);
      const featured = featuredCount[category] || 0;
      const status = frontendId ? '✅' : '❌';
      const percentage = ((count / (feeds?.length || 1)) * 100).toFixed(1);
      
      console.log(`   ${status} ${category.padEnd(15)} (${(frontendId || 'NO MAPPING').padEnd(12)}): ${count.toString().padStart(3)} feeds (${percentage}%) [${featured} featured]`);
    });
    
    // Summary
    console.log('\n📋 Summary:');
    console.log(`   Total categories: ${Object.keys(categoryCount).length}`);
    console.log(`   Mapped categories: ${Object.keys(categoryCount).length - (unmappedCategories > 0 ? 1 : 0)}`);
    console.log(`   Featured feeds: ${Object.values(featuredCount).reduce((sum, count) => sum + count, 0)}`);
    
    if (unmappedCategories > 0) {
      console.log(`   ❌ Unmapped categories found: ${unmappedCategories} feeds affected`);
      console.log('   Run: npm run validate:categories to see details');
    } else {
      console.log('   ✅ All categories have valid mappings');
    }
    
    console.log('\n💡 For detailed analysis, run:');
    console.log('   • npm run db:status (comprehensive database status)');
    console.log('   • npm run category:distribution (detailed category analysis)');
    console.log('   • npm run category:mapping:status (mapping validation)');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

checkDatabase();
