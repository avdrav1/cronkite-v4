#!/usr/bin/env tsx

// Script to clean up fake/placeholder feeds from the production database
// This removes feeds like "History Feed 1", "Tech Feed 5", etc. from:
// 1. recommended_feeds table
// 2. feeds table (user subscriptions)

import '../server/env';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('   SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Pattern to identify fake feeds
function isFakeFeed(name: string, url: string): boolean {
  // Pattern: "Category Feed N" (e.g., "History Feed 1", "Tech Feed 5")
  if (/Feed \d+$/.test(name)) return true;
  
  // URLs with example.com or example-
  if (url?.includes('example.com') || url?.includes('example-')) return true;
  
  return false;
}

async function cleanupFakeFeeds() {
  console.log('🧹 Starting fake feed cleanup...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
  
  try {
    // ============================================
    // STEP 1: Clean up recommended_feeds table
    // ============================================
    console.log('\n📋 STEP 1: Checking recommended_feeds table...');
    
    const { data: recFeeds, error: recError } = await supabase
      .from('recommended_feeds')
      .select('id, name, url, category');
    
    if (recError) {
      console.error('❌ Error fetching recommended_feeds:', recError);
    } else {
      console.log(`   Total feeds in recommended_feeds: ${recFeeds?.length || 0}`);
      
      // Find fake feeds
      const fakeRecFeeds = recFeeds?.filter(f => isFakeFeed(f.name, f.url)) || [];
      
      console.log(`   Fake feeds found: ${fakeRecFeeds.length}`);
      
      if (fakeRecFeeds.length > 0) {
        console.log('\n   Sample fake feeds to delete:');
        fakeRecFeeds.slice(0, 10).forEach(f => 
          console.log(`     - "${f.name}" (${f.category}) - ${f.url?.substring(0, 40)}...`)
        );
        
        // Group by category for summary
        const byCategory: Record<string, number> = {};
        fakeRecFeeds.forEach(f => {
          byCategory[f.category] = (byCategory[f.category] || 0) + 1;
        });
        
        console.log('\n   Fake feeds by category:');
        Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
          console.log(`     ${cat}: ${count}`);
        });
        
        // Delete fake feeds from recommended_feeds
        console.log(`\n   🗑️  Deleting ${fakeRecFeeds.length} fake feeds from recommended_feeds...`);
        
        const fakeIds = fakeRecFeeds.map(f => f.id);
        const batchSize = 100;
        let deletedCount = 0;
        
        for (let i = 0; i < fakeIds.length; i += batchSize) {
          const batch = fakeIds.slice(i, i + batchSize);
          const { error: deleteError } = await supabase
            .from('recommended_feeds')
            .delete()
            .in('id', batch);
          
          if (deleteError) {
            console.error(`   ❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, deleteError);
          } else {
            deletedCount += batch.length;
            console.log(`   ✅ Deleted batch ${Math.floor(i / batchSize) + 1} (${deletedCount}/${fakeIds.length})`);
          }
        }
        
        console.log(`   ✅ Deleted ${deletedCount} fake feeds from recommended_feeds`);
      } else {
        console.log('   ✅ No fake feeds found in recommended_feeds');
      }
    }
    
    // ============================================
    // STEP 2: Clean up feeds table (user subscriptions)
    // ============================================
    console.log('\n📋 STEP 2: Checking feeds table (user subscriptions)...');
    
    const { data: userFeeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, name, url, user_id');
    
    if (feedsError) {
      console.error('❌ Error fetching feeds:', feedsError);
    } else {
      console.log(`   Total feeds in feeds table: ${userFeeds?.length || 0}`);
      
      // Find fake feeds
      const fakeUserFeeds = userFeeds?.filter(f => isFakeFeed(f.name, f.url)) || [];
      
      console.log(`   Fake feeds found: ${fakeUserFeeds.length}`);
      
      if (fakeUserFeeds.length > 0) {
        console.log('\n   Sample fake user feeds to delete:');
        fakeUserFeeds.slice(0, 10).forEach(f => 
          console.log(`     - "${f.name}" (user: ${f.user_id?.substring(0, 8)}...)`)
        );
        
        // Group by user
        const byUser: Record<string, number> = {};
        fakeUserFeeds.forEach(f => {
          byUser[f.user_id] = (byUser[f.user_id] || 0) + 1;
        });
        
        console.log('\n   Fake feeds by user:');
        Object.entries(byUser).forEach(([userId, count]) => {
          console.log(`     ${userId}: ${count} fake feeds`);
        });
        
        // Delete fake feeds from feeds table
        console.log(`\n   🗑️  Deleting ${fakeUserFeeds.length} fake feeds from feeds table...`);
        
        const fakeIds = fakeUserFeeds.map(f => f.id);
        const batchSize = 100;
        let deletedCount = 0;
        
        for (let i = 0; i < fakeIds.length; i += batchSize) {
          const batch = fakeIds.slice(i, i + batchSize);
          const { error: deleteError } = await supabase
            .from('feeds')
            .delete()
            .in('id', batch);
          
          if (deleteError) {
            console.error(`   ❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, deleteError);
          } else {
            deletedCount += batch.length;
            console.log(`   ✅ Deleted batch ${Math.floor(i / batchSize) + 1} (${deletedCount}/${fakeIds.length})`);
          }
        }
        
        console.log(`   ✅ Deleted ${deletedCount} fake feeds from feeds table`);
      } else {
        console.log('   ✅ No fake feeds found in feeds table');
      }
    }
    
    // ============================================
    // STEP 3: Verify final state
    // ============================================
    console.log('\n📋 STEP 3: Verifying final state...');
    
    // Check recommended_feeds
    const { data: finalRecFeeds } = await supabase
      .from('recommended_feeds')
      .select('id, name, url, category');
    
    const remainingFakeRec = finalRecFeeds?.filter(f => isFakeFeed(f.name, f.url)) || [];
    
    console.log(`   recommended_feeds: ${finalRecFeeds?.length || 0} total, ${remainingFakeRec.length} fake remaining`);
    
    if (remainingFakeRec.length > 0) {
      console.warn('   ⚠️  Some fake feeds still remain in recommended_feeds:');
      remainingFakeRec.slice(0, 5).forEach(f => console.warn(`     - ${f.name}`));
    }
    
    // Check feeds table
    const { data: finalUserFeeds } = await supabase
      .from('feeds')
      .select('id, name, url');
    
    const remainingFakeUser = finalUserFeeds?.filter(f => isFakeFeed(f.name, f.url)) || [];
    
    console.log(`   feeds: ${finalUserFeeds?.length || 0} total, ${remainingFakeUser.length} fake remaining`);
    
    if (remainingFakeUser.length > 0) {
      console.warn('   ⚠️  Some fake feeds still remain in feeds table:');
      remainingFakeUser.slice(0, 5).forEach(f => console.warn(`     - ${f.name}`));
    }
    
    // Show category distribution of remaining recommended feeds
    if (finalRecFeeds && finalRecFeeds.length > 0) {
      const categoryDist: Record<string, number> = {};
      finalRecFeeds.forEach(f => {
        categoryDist[f.category] = (categoryDist[f.category] || 0) + 1;
      });
      
      console.log('\n   📊 Remaining recommended feeds by category:');
      Object.entries(categoryDist).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`     ${cat}: ${count}`);
      });
    }
    
    // ============================================
    // Summary
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('🎉 CLEANUP COMPLETE');
    console.log('='.repeat(50));
    
    if (remainingFakeRec.length === 0 && remainingFakeUser.length === 0) {
      console.log('✅ All fake feeds have been removed!');
      console.log('\n📝 Next steps:');
      console.log('   1. Deploy the updated code to Netlify');
      console.log('   2. Users may need to re-do onboarding to get real feeds');
    } else {
      console.log('⚠️  Some fake feeds may still remain. Run this script again if needed.');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupFakeFeeds();
