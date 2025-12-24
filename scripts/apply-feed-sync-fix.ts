/**
 * Script to apply the feed sync and priority fix to production database
 * 
 * This script fixes two issues:
 * 1. Feeds showing "Never synced" even though they have been synced
 * 2. All feeds showing "Medium" priority instead of appropriate priorities
 * 
 * Run with: npx tsx scripts/apply-feed-sync-fix.ts
 * 
 * For production, set these environment variables:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables - try .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Allow override from command line
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nFor production, run with:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co \\');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-key \\');
  console.error('  npx tsx scripts/apply-feed-sync-fix.ts');
  process.exit(1);
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch {
  console.error('❌ Invalid SUPABASE_URL format:', supabaseUrl);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFix() {
  console.log('🔧 Applying feed sync and priority fixes...\n');

  try {
    // Step 1: Update the complete_feed_sync_success function
    console.log('1️⃣ Updating complete_feed_sync_success function...');
    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION complete_feed_sync_success(
          p_sync_log_id UUID,
          p_http_status_code INTEGER DEFAULT NULL,
          p_articles_found INTEGER DEFAULT 0,
          p_articles_new INTEGER DEFAULT 0,
          p_articles_updated INTEGER DEFAULT 0,
          p_etag_received TEXT DEFAULT NULL,
          p_last_modified_received TEXT DEFAULT NULL,
          p_feed_size_bytes INTEGER DEFAULT NULL
        )
        RETURNS VOID AS $$
        DECLARE
          v_feed_id UUID;
        BEGIN
          UPDATE feed_sync_log 
          SET 
            sync_completed_at = NOW(),
            status = 'success',
            http_status_code = p_http_status_code,
            articles_found = p_articles_found,
            articles_new = p_articles_new,
            articles_updated = p_articles_updated,
            etag_received = p_etag_received,
            last_modified_received = p_last_modified_received,
            feed_size_bytes = p_feed_size_bytes
          WHERE id = p_sync_log_id
          RETURNING feed_id INTO v_feed_id;
          
          IF v_feed_id IS NOT NULL THEN
            UPDATE feeds 
            SET 
              last_fetched_at = NOW(),
              etag = COALESCE(p_etag_received, etag),
              last_modified = COALESCE(p_last_modified_received, last_modified),
              article_count = article_count + p_articles_new,
              updated_at = NOW()
            WHERE id = v_feed_id;
          END IF;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });

    if (funcError) {
      // Try direct SQL if exec_sql doesn't exist
      console.log('   ⚠️ exec_sql not available, will need manual migration');
    } else {
      console.log('   ✅ Function updated');
    }

    // Step 2: Set default_priority for recommended_feeds
    console.log('\n2️⃣ Setting default_priority for recommended_feeds...');
    
    // High priority for major news sources
    const { error: highError } = await supabase
      .from('recommended_feeds')
      .update({ default_priority: 'high' })
      .or('url.ilike.%bbc%,url.ilike.%reuters%,url.ilike.%apnews%,url.ilike.%cnn%,url.ilike.%nytimes%,article_frequency.eq.hourly');
    
    if (highError) {
      console.log('   ⚠️ Could not update high priority feeds:', highError.message);
    } else {
      console.log('   ✅ High priority feeds updated');
    }

    // Low priority for weekly sources
    const { error: lowError } = await supabase
      .from('recommended_feeds')
      .update({ default_priority: 'low' })
      .eq('article_frequency', 'weekly');
    
    if (lowError) {
      console.log('   ⚠️ Could not update low priority feeds:', lowError.message);
    } else {
      console.log('   ✅ Low priority feeds updated');
    }

    // Medium priority for everything else
    const { error: medError } = await supabase
      .from('recommended_feeds')
      .update({ default_priority: 'medium' })
      .or('default_priority.is.null,default_priority.eq.');
    
    if (medError) {
      console.log('   ⚠️ Could not update medium priority feeds:', medError.message);
    } else {
      console.log('   ✅ Medium priority feeds updated');
    }

    // Step 3: Update existing user feeds with proper priorities
    console.log('\n3️⃣ Updating existing user feeds with proper priorities...');
    
    // Get all feeds and their recommended feed counterparts
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, url, priority');
    
    if (feedsError) {
      console.log('   ⚠️ Could not fetch feeds:', feedsError.message);
    } else if (feeds) {
      const { data: recommendedFeeds } = await supabase
        .from('recommended_feeds')
        .select('url, default_priority');
      
      const recommendedMap = new Map(
        (recommendedFeeds || []).map(rf => [rf.url, rf.default_priority])
      );
      
      let updated = 0;
      for (const feed of feeds) {
        let newPriority = recommendedMap.get(feed.url);
        
        // Fallback: check URL patterns for news sites
        if (!newPriority) {
          const url = feed.url.toLowerCase();
          if (url.includes('bbc') || url.includes('reuters') || url.includes('apnews') ||
              url.includes('cnn') || url.includes('nytimes') || url.includes('wsj') ||
              url.includes('bloomberg') || url.includes('espn')) {
            newPriority = 'high';
          }
        }
        
        if (newPriority && newPriority !== feed.priority) {
          const syncIntervalHours = newPriority === 'high' ? 1 : newPriority === 'low' ? 168 : 24;
          
          const { error: updateError } = await supabase
            .from('feeds')
            .update({ 
              priority: newPriority,
              sync_priority: newPriority,
              sync_interval_hours: syncIntervalHours
            })
            .eq('id', feed.id);
          
          if (!updateError) {
            updated++;
          }
        }
      }
      console.log(`   ✅ Updated ${updated} feeds with proper priorities`);
    }

    // Step 4: Backfill last_fetched_at from feed_sync_log
    console.log('\n4️⃣ Backfilling last_fetched_at from sync logs...');
    
    const { data: feedsToUpdate, error: fetchError } = await supabase
      .from('feeds')
      .select('id')
      .is('last_fetched_at', null);
    
    if (fetchError) {
      console.log('   ⚠️ Could not fetch feeds:', fetchError.message);
    } else if (feedsToUpdate) {
      let backfilled = 0;
      
      for (const feed of feedsToUpdate) {
        // Get the latest successful sync for this feed
        const { data: syncLog } = await supabase
          .from('feed_sync_log')
          .select('sync_completed_at')
          .eq('feed_id', feed.id)
          .eq('status', 'success')
          .order('sync_completed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (syncLog?.sync_completed_at) {
          const { error: updateError } = await supabase
            .from('feeds')
            .update({ last_fetched_at: syncLog.sync_completed_at })
            .eq('id', feed.id);
          
          if (!updateError) {
            backfilled++;
          }
        }
      }
      console.log(`   ✅ Backfilled last_fetched_at for ${backfilled} feeds`);
    }

    // Step 5: Show summary
    console.log('\n📊 Summary:');
    
    const { data: priorityStats } = await supabase
      .from('feeds')
      .select('priority');
    
    if (priorityStats) {
      const counts = priorityStats.reduce((acc, f) => {
        acc[f.priority] = (acc[f.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`   High priority feeds: ${counts.high || 0}`);
      console.log(`   Medium priority feeds: ${counts.medium || 0}`);
      console.log(`   Low priority feeds: ${counts.low || 0}`);
    }
    
    const { data: syncedFeeds } = await supabase
      .from('feeds')
      .select('id')
      .not('last_fetched_at', 'is', null);
    
    console.log(`   Feeds with last_fetched_at: ${syncedFeeds?.length || 0}`);

    console.log('\n✅ Fix applied successfully!');
    console.log('\n📝 Note: The complete_feed_sync_success function update may need to be');
    console.log('   applied manually via the Supabase SQL Editor if exec_sql is not available.');
    console.log('   See: supabase/migrations/20240119000000_fix_feed_sync_and_priority.sql');

  } catch (error) {
    console.error('❌ Error applying fix:', error);
    process.exit(1);
  }
}

applyFix();
