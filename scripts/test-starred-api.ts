/**
 * Test the starred articles API endpoint logic
 */

import { createClient } from '@supabase/supabase-js';

// Production Supabase credentials
const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// The user ID from the debug output
const userId = '0f1817a7-5c8e-4e8a-9c8e-4e8a9c8e4e8a'; // Will get the actual one

async function testStarredArticlesAPI() {
  console.log('🔍 Testing starred articles API logic...\n');

  // 1. Get the actual user ID
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  
  const actualUserId = profiles?.id;
  console.log(`User ID: ${actualUserId}\n`);

  if (!actualUserId) {
    console.error('No user found');
    return;
  }

  // 2. Simulate getStarredArticles method
  console.log('2️⃣ Simulating getStarredArticles...');
  const { data: starredData, error: starredError } = await supabase
    .from('user_articles')
    .select(`
      article_id,
      starred_at,
      articles (
        id, feed_id, guid, title, url, author, excerpt, content, image_url,
        published_at, fetched_at, ai_summary, ai_summary_generated_at, cluster_id,
        embedding_status, embedding_generated_at, embedding_error, content_hash, created_at
      )
    `)
    .eq('user_id', actualUserId)
    .eq('is_starred', true)
    .order('starred_at', { ascending: false });

  if (starredError) {
    console.error('❌ Error:', starredError.message);
    return;
  }

  console.log(`   Found ${starredData?.length || 0} starred records`);

  // Extract articles
  const articles = (starredData || [])
    .map((item: any) => item.articles)
    .filter((article: any) => article !== null);

  console.log(`   Extracted ${articles.length} articles`);

  // 3. Get user feeds for feed info
  console.log('\n3️⃣ Getting user feeds...');
  const { data: userFeeds, error: feedsError } = await supabase
    .from('feeds')
    .select('*')
    .eq('user_id', actualUserId);

  if (feedsError) {
    console.error('❌ Error getting feeds:', feedsError.message);
  } else {
    console.log(`   Found ${userFeeds?.length || 0} user feeds`);
  }

  // 4. Map feed info to articles
  const feedMap = new Map((userFeeds || []).map((feed: any) => [feed.id, feed]));

  const articlesWithFeedInfo = articles.map((article: any) => {
    const feed = feedMap.get(article.feed_id);
    return {
      ...article,
      feed_name: feed?.name || 'Unknown Source',
      feed_url: feed?.site_url || feed?.url,
      feed_icon: feed?.icon_url,
      feed_category: feed?.folder_name || 'General',
      is_starred: true // Mark as starred
    };
  });

  console.log('\n4️⃣ Final response:');
  console.log(JSON.stringify({
    articles: articlesWithFeedInfo.map((a: any) => ({
      id: a.id,
      title: a.title?.substring(0, 50) + '...',
      feed_name: a.feed_name,
      is_starred: a.is_starred
    })),
    total: articlesWithFeedInfo.length
  }, null, 2));

  // 5. Check if articles have the correct feed_id that matches user feeds
  console.log('\n5️⃣ Checking feed_id matching...');
  const feedIds = new Set((userFeeds || []).map((f: any) => f.id));
  articles.forEach((article: any) => {
    const hasMatchingFeed = feedIds.has(article.feed_id);
    console.log(`   Article "${article.title?.substring(0, 30)}..." - feed_id: ${article.feed_id?.substring(0, 8)}... - matches user feed: ${hasMatchingFeed}`);
  });
}

testStarredArticlesAPI().catch(console.error);
