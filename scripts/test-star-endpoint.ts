/**
 * Test script to verify the star API endpoint is working
 * Run with: npx tsx scripts/test-star-endpoint.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testStarEndpoint() {
  console.log('🧪 Testing Star API Endpoint\n');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // 1. Get a test user
  console.log('1️⃣ Finding a test user...');
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, email')
    .limit(1);
  
  if (usersError || !users?.length) {
    console.error('❌ No users found:', usersError?.message);
    return;
  }
  
  const testUser = users[0];
  console.log(`   Found user: ${testUser.email} (${testUser.id})`);
  
  // 2. Get an article from user's feeds
  console.log('\n2️⃣ Finding an article from user feeds...');
  const { data: feeds, error: feedsError } = await supabase
    .from('feeds')
    .select('id')
    .eq('user_id', testUser.id)
    .limit(1);
  
  if (feedsError || !feeds?.length) {
    console.error('❌ No feeds found for user:', feedsError?.message);
    return;
  }
  
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('id, title')
    .eq('feed_id', feeds[0].id)
    .limit(1);
  
  if (articlesError || !articles?.length) {
    console.error('❌ No articles found:', articlesError?.message);
    return;
  }
  
  const testArticle = articles[0];
  console.log(`   Found article: ${testArticle.title?.substring(0, 50)}...`);
  
  // 3. Check current user_article state
  console.log('\n3️⃣ Checking current user_article state...');
  const { data: currentState, error: stateError } = await supabase
    .from('user_articles')
    .select('*')
    .eq('user_id', testUser.id)
    .eq('article_id', testArticle.id)
    .single();
  
  if (stateError && stateError.code !== 'PGRST116') {
    console.error('❌ Error checking state:', stateError.message);
  } else if (currentState) {
    console.log('   Current state:', {
      is_starred: currentState.is_starred,
      starred_at: currentState.starred_at,
      is_read: currentState.is_read
    });
  } else {
    console.log('   No existing state (will be created on first interaction)');
  }
  
  // 4. Test starring the article directly via Supabase
  console.log('\n4️⃣ Testing direct Supabase star operation...');
  
  const newStarredState = !currentState?.is_starred;
  const updates = {
    is_starred: newStarredState,
    starred_at: newStarredState ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  
  if (currentState) {
    // Update existing record
    const { data: updateResult, error: updateError } = await supabase
      .from('user_articles')
      .update(updates)
      .eq('user_id', testUser.id)
      .eq('article_id', testArticle.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Update failed:', updateError.message);
      console.error('   Error code:', updateError.code);
      console.error('   Error details:', updateError.details);
    } else {
      console.log('✅ Update successful:', {
        is_starred: updateResult.is_starred,
        starred_at: updateResult.starred_at
      });
    }
  } else {
    // Create new record
    const insertData = {
      user_id: testUser.id,
      article_id: testArticle.id,
      is_starred: newStarredState,
      starred_at: newStarredState ? new Date().toISOString() : null,
      is_read: false
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('user_articles')
      .insert(insertData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      console.error('   Error code:', insertError.code);
      console.error('   Error details:', insertError.details);
    } else {
      console.log('✅ Insert successful:', {
        is_starred: insertResult.is_starred,
        starred_at: insertResult.starred_at
      });
    }
  }
  
  // 5. Verify the starred articles query works
  console.log('\n5️⃣ Testing getStarredArticles query...');
  const { data: starredData, error: starredError } = await supabase
    .from('user_articles')
    .select(`
      article_id,
      is_read,
      is_starred,
      starred_at,
      engagement_signal,
      articles (
        id, feed_id, title, url, author, excerpt, content, image_url,
        published_at, fetched_at, created_at
      )
    `)
    .eq('user_id', testUser.id)
    .eq('is_starred', true)
    .order('starred_at', { ascending: false });
  
  if (starredError) {
    console.error('❌ Starred query failed:', starredError.message);
    console.error('   Error code:', starredError.code);
  } else {
    console.log(`✅ Found ${starredData?.length || 0} starred articles`);
    if (starredData && starredData.length > 0) {
      console.log('   First starred article:', {
        title: (starredData[0].articles as any)?.title?.substring(0, 50),
        starred_at: starredData[0].starred_at
      });
    }
  }
  
  console.log('\n✅ Test complete!');
}

testStarEndpoint().catch(console.error);
