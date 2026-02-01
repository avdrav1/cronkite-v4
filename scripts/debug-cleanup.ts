/**
 * Debug script to diagnose cleanup issues
 * Run with: npx tsx scripts/debug-cleanup.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCleanup() {
  console.log('🔍 Debugging cleanup issues...\n');
  
  // 1. Get total article count
  const { count: totalArticles, error: countError } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total articles in database: ${totalArticles}`);
  
  // 2. Get articles per feed
  const { data: feedCounts, error: feedError } = await supabase
    .from('articles')
    .select('feed_id')
    .then(async (result) => {
      if (result.error) return { data: null, error: result.error };
      
      const counts: Record<string, number> = {};
      for (const article of result.data || []) {
        counts[article.feed_id] = (counts[article.feed_id] || 0) + 1;
      }
      return { data: counts, error: null };
    });
  
  if (feedCounts) {
    console.log('\n📁 Articles per feed:');
    const sortedFeeds = Object.entries(feedCounts).sort((a, b) => b[1] - a[1]);
    for (const [feedId, count] of sortedFeeds.slice(0, 10)) {
      // Get feed name
      const { data: feed } = await supabase
        .from('feeds')
        .select('title')
        .eq('id', feedId)
        .single();
      console.log(`   ${feed?.title || feedId}: ${count} articles`);
    }
  }
  
  // 3. Get protected articles count (starred or read)
  const { count: protectedCount, error: protectedError } = await supabase
    .from('user_articles')
    .select('*', { count: 'exact', head: true })
    .or('is_starred.eq.true,is_read.eq.true');
  
  console.log(`\n🛡️  Protected articles (starred or read): ${protectedCount}`);
  
  // 4. Get starred count
  const { count: starredCount } = await supabase
    .from('user_articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_starred', true);
  
  console.log(`   ⭐ Starred: ${starredCount}`);
  
  // 5. Get read count
  const { count: readCount } = await supabase
    .from('user_articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', true);
  
  console.log(`   📖 Read: ${readCount}`);
  
  // 6. Get articles with comments
  const { count: commentedCount } = await supabase
    .from('article_comments')
    .select('article_id', { count: 'exact', head: true })
    .is('deleted_at', null);
  
  console.log(`   💬 With comments: ${commentedCount}`);
  
  // 7. Check user settings
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('user_id, articles_per_feed, unread_article_age_days, enable_auto_cleanup')
    .limit(5);
  
  console.log('\n⚙️  User cleanup settings:');
  for (const settings of userSettings || []) {
    console.log(`   User ${settings.user_id.slice(0, 8)}...: articles_per_feed=${settings.articles_per_feed ?? 'default(100)'}, age_days=${settings.unread_article_age_days ?? 'default(30)'}, auto_cleanup=${settings.enable_auto_cleanup ?? 'default(true)'}`);
  }
  
  // 8. Check cleanup logs
  const { data: cleanupLogs, count: logCount } = await supabase
    .from('cleanup_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`\n📝 Cleanup logs (${logCount} total):`);
  if (cleanupLogs && cleanupLogs.length > 0) {
    for (const log of cleanupLogs) {
      console.log(`   ${log.created_at}: trigger=${log.trigger_type}, deleted=${log.articles_deleted}, duration=${log.duration_ms}ms${log.error_message ? `, error=${log.error_message}` : ''}`);
    }
  } else {
    console.log('   No cleanup logs found');
  }
  
  // 9. Calculate potential cleanup
  console.log('\n🧹 Potential cleanup analysis:');
  const LIMIT = 100; // Default articles per feed
  
  if (feedCounts) {
    let totalToDelete = 0;
    for (const [feedId, count] of Object.entries(feedCounts)) {
      if (count > LIMIT) {
        const excess = count - LIMIT;
        totalToDelete += excess;
        
        // Get feed name
        const { data: feed } = await supabase
          .from('feeds')
          .select('title')
          .eq('id', feedId)
          .single();
        
        console.log(`   ${feed?.title || feedId}: ${count} articles, ${excess} over limit`);
      }
    }
    console.log(`\n   Total articles over limit: ${totalToDelete}`);
    console.log(`   Protected articles: ${protectedCount}`);
    console.log(`   Potential deletions (if none protected): ${totalToDelete}`);
  }
}

debugCleanup().catch(console.error);
