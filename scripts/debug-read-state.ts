/**
 * Debug script to test read state persistence
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔗 Connecting to:', supabaseUrl?.substring(0, 30) + '...');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugReadState() {
  console.log('🔍 Debugging read state persistence...\n');

  // 1. Get a test user
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, email')
    .limit(1);

  if (usersError || !users?.length) {
    console.error('❌ No users found:', usersError?.message);
    return;
  }

  const testUser = users[0];
  console.log('👤 Test user:', testUser.email);

  // 2. Check user_articles table for this user
  const { data: userArticles, error: uaError } = await supabase
    .from('user_articles')
    .select('*')
    .eq('user_id', testUser.id)
    .limit(20);

  if (uaError) {
    console.error('❌ Error fetching user_articles:', uaError.message);
    return;
  }

  console.log(`\n📊 Found ${userArticles?.length || 0} user_article records`);
  
  if (userArticles && userArticles.length > 0) {
    const readCount = userArticles.filter(ua => ua.is_read).length;
    const starredCount = userArticles.filter(ua => ua.is_starred).length;
    
    console.log(`   - Read: ${readCount}`);
    console.log(`   - Starred: ${starredCount}`);
    
    console.log('\n📝 Sample records:');
    userArticles.slice(0, 5).forEach(ua => {
      console.log(`   article_id: ${ua.article_id?.substring(0, 8)}...`);
      console.log(`     is_read: ${ua.is_read}, is_starred: ${ua.is_starred}`);
      console.log(`     read_at: ${ua.read_at}, updated_at: ${ua.updated_at}`);
    });
  }

  // 3. Get an article to test with
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('id, title')
    .limit(1);

  if (articlesError || !articles?.length) {
    console.error('❌ No articles found:', articlesError?.message);
    return;
  }

  const testArticle = articles[0];
  console.log(`\n🧪 Testing with article: ${testArticle.title?.substring(0, 50)}...`);

  // 4. Check current state
  const { data: currentState } = await supabase
    .from('user_articles')
    .select('*')
    .eq('user_id', testUser.id)
    .eq('article_id', testArticle.id)
    .single();

  console.log('\n📖 Current state:', currentState || 'No record exists');

  // 5. Try to mark as read using upsert (simulating what the app does)
  const upsertData = {
    user_id: testUser.id,
    article_id: testArticle.id,
    is_read: true,
    is_starred: currentState?.is_starred ?? false,
    read_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('\n📝 Upserting:', upsertData);

  const { data: upsertResult, error: upsertError } = await supabase
    .from('user_articles')
    .upsert(upsertData, {
      onConflict: 'user_id,article_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (upsertError) {
    console.error('❌ Upsert error:', upsertError.message, upsertError.code);
  } else {
    console.log('✅ Upsert result:', upsertResult);
  }

  // 6. Verify the state was saved
  const { data: verifyState } = await supabase
    .from('user_articles')
    .select('*')
    .eq('user_id', testUser.id)
    .eq('article_id', testArticle.id)
    .single();

  console.log('\n✅ Verified state after upsert:', verifyState);

  // 7. Check RLS policies
  console.log('\n🔒 Checking RLS status...');
  const { data: rlsStatus } = await supabase.rpc('check_rls_status');
  console.log('RLS status:', rlsStatus);
}

debugReadState().catch(console.error);
