/**
 * Debug script to investigate starred articles issue
 * Run with: npx tsx scripts/debug-starred-articles.ts
 */

import { createClient } from '@supabase/supabase-js';

// Production Supabase credentials
const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4';

console.log(`🔗 Connecting to: ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugStarredArticles() {
  console.log('🔍 Debugging starred articles...\n');

  // 1. Check all user_articles records
  console.log('1️⃣ Checking user_articles table...');
  const { data: allUserArticles, error: allError } = await supabase
    .from('user_articles')
    .select('*')
    .limit(20);
  
  if (allError) {
    console.error('❌ Error fetching user_articles:', allError.message);
  } else {
    console.log(`   Found ${allUserArticles?.length || 0} user_articles records`);
    if (allUserArticles && allUserArticles.length > 0) {
      console.log('   Sample records:');
      allUserArticles.slice(0, 5).forEach(ua => {
        console.log(`   - user_id: ${ua.user_id?.substring(0, 8)}..., article_id: ${ua.article_id?.substring(0, 8)}..., is_starred: ${ua.is_starred}, is_read: ${ua.is_read}`);
      });
    }
  }

  // 2. Check starred articles specifically
  console.log('\n2️⃣ Checking starred articles (is_starred = true)...');
  const { data: starredRecords, error: starredError } = await supabase
    .from('user_articles')
    .select('*')
    .eq('is_starred', true);
  
  if (starredError) {
    console.error('❌ Error fetching starred records:', starredError.message);
  } else {
    console.log(`   Found ${starredRecords?.length || 0} starred records`);
    if (starredRecords && starredRecords.length > 0) {
      console.log('   Starred records:');
      starredRecords.forEach(ua => {
        console.log(`   - user_id: ${ua.user_id?.substring(0, 8)}..., article_id: ${ua.article_id?.substring(0, 8)}..., starred_at: ${ua.starred_at}`);
      });
    }
  }

  // 3. Check if the join query works
  console.log('\n3️⃣ Testing join query for starred articles...');
  const { data: joinedData, error: joinError } = await supabase
    .from('user_articles')
    .select(`
      article_id,
      starred_at,
      is_starred,
      articles (
        id, title, url
      )
    `)
    .eq('is_starred', true)
    .limit(10);
  
  if (joinError) {
    console.error('❌ Error with join query:', joinError.message);
  } else {
    console.log(`   Join query returned ${joinedData?.length || 0} records`);
    if (joinedData && joinedData.length > 0) {
      console.log('   Joined records:');
      joinedData.forEach((item: any) => {
        console.log(`   - article_id: ${item.article_id?.substring(0, 8)}..., title: ${item.articles?.title?.substring(0, 50)}...`);
      });
    }
  }

  // 4. Check profiles table to see users
  console.log('\n4️⃣ Checking profiles table...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .limit(5);
  
  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError.message);
  } else {
    console.log(`   Found ${profiles?.length || 0} profiles`);
    if (profiles && profiles.length > 0) {
      profiles.forEach(p => {
        console.log(`   - id: ${p.id?.substring(0, 8)}..., email: ${p.email}`);
      });
    }
  }

  // 5. Check articles table
  console.log('\n5️⃣ Checking articles table...');
  const { data: articles, error: articlesError, count } = await supabase
    .from('articles')
    .select('id, title', { count: 'exact' })
    .limit(5);
  
  if (articlesError) {
    console.error('❌ Error fetching articles:', articlesError.message);
  } else {
    console.log(`   Total articles: ${count}`);
    if (articles && articles.length > 0) {
      console.log('   Sample articles:');
      articles.forEach(a => {
        console.log(`   - id: ${a.id?.substring(0, 8)}..., title: ${a.title?.substring(0, 50)}...`);
      });
    }
  }

  // 6. Check user_articles table schema
  console.log('\n6️⃣ Checking user_articles table columns...');
  const { data: schemaData, error: schemaError } = await supabase
    .rpc('get_table_columns', { table_name: 'user_articles' })
    .single();
  
  if (schemaError) {
    // Try alternative approach
    console.log('   (Using alternative schema check)');
    const { data: sampleRecord } = await supabase
      .from('user_articles')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleRecord) {
      console.log('   Columns:', Object.keys(sampleRecord).join(', '));
    } else {
      console.log('   No records to check schema');
    }
  } else {
    console.log('   Schema:', schemaData);
  }

  console.log('\n✅ Debug complete');
}

debugStarredArticles().catch(console.error);
