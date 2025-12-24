/**
 * Test the star article API endpoint logic directly
 */

import { createClient } from '@supabase/supabase-js';

// Production Supabase credentials
const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testStarAPI() {
  console.log('🔍 Testing star article API logic...\n');

  // 1. Get the actual user ID
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  
  const userId = profiles?.id;
  console.log(`User ID: ${userId}\n`);

  if (!userId) {
    console.error('No user found');
    return;
  }

  // 2. Get a sample article ID
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title')
    .limit(1)
    .single();
  
  const articleId = articles?.id;
  console.log(`Article ID: ${articleId}`);
  console.log(`Article Title: ${articles?.title?.substring(0, 50)}...\n`);

  if (!articleId) {
    console.error('No article found');
    return;
  }

  // 3. Check current user_article state
  console.log('3️⃣ Checking current user_article state...');
  const { data: currentState, error: stateError } = await supabase
    .from('user_articles')
    .select('*')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .single();
  
  if (stateError && stateError.code !== 'PGRST116') {
    console.error('Error checking state:', stateError);
  } else {
    console.log('Current state:', currentState || 'No record exists');
  }

  // 4. Try to update/create user_article state
  console.log('\n4️⃣ Testing update/create user_article state...');
  
  const updates = {
    is_starred: true,
    starred_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Try update first
  const { data: updateData, error: updateError } = await supabase
    .from('user_articles')
    .update(updates)
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .select()
    .single();
  
  if (updateError) {
    console.log('Update error:', updateError.code, updateError.message);
    
    if (updateError.code === 'PGRST116') {
      console.log('No existing record, trying insert...');
      
      const insertData = {
        user_id: userId,
        article_id: articleId,
        is_starred: true,
        starred_at: new Date().toISOString(),
        is_read: false
      };
      
      const { data: insertResult, error: insertError } = await supabase
        .from('user_articles')
        .insert(insertData)
        .select()
        .single();
      
      if (insertError) {
        console.error('Insert error:', insertError.code, insertError.message);
        console.error('Insert error details:', insertError);
      } else {
        console.log('Insert successful:', insertResult);
      }
    }
  } else {
    console.log('Update successful:', updateData);
  }

  // 5. Verify the state
  console.log('\n5️⃣ Verifying final state...');
  const { data: finalState, error: finalError } = await supabase
    .from('user_articles')
    .select('*')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .single();
  
  if (finalError) {
    console.error('Error verifying state:', finalError);
  } else {
    console.log('Final state:', finalState);
  }

  // 6. Check user_articles table schema
  console.log('\n6️⃣ Checking user_articles table columns...');
  const { data: sampleRecord } = await supabase
    .from('user_articles')
    .select('*')
    .limit(1)
    .single();
  
  if (sampleRecord) {
    console.log('Columns:', Object.keys(sampleRecord).join(', '));
  } else {
    console.log('No records to check schema');
  }
}

testStarAPI().catch(console.error);
