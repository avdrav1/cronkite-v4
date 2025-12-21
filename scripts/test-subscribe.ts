import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rpqhkfkbpwzqcsdafogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4'
);

async function testSubscribe() {
  const userId = '0f1817a7-b1b9-43ae-b1f0-01ed0b99ad5a';
  
  // Get a sample recommended feed
  console.log('=== Testing Feed Subscription ===');
  
  const { data: recommendedFeeds, error: fetchError } = await supabase
    .from('recommended_feeds')
    .select('*')
    .limit(3);
  
  if (fetchError) {
    console.log('Error fetching recommended feeds:', fetchError.message);
    return;
  }
  
  console.log('Sample recommended feeds:', recommendedFeeds?.map(f => ({ id: f.id, name: f.name, category: f.category })));
  
  // Check the feeds table schema
  console.log('\n=== Checking feeds table schema ===');
  const { data: existingFeeds, error: feedsError } = await supabase
    .from('feeds')
    .select('*')
    .eq('user_id', userId)
    .limit(1);
  
  if (feedsError) {
    console.log('Error fetching existing feeds:', feedsError.message);
  } else {
    console.log('Sample existing feed structure:', existingFeeds?.[0] ? Object.keys(existingFeeds[0]) : 'No feeds');
  }
  
  // Try to insert a test feed
  console.log('\n=== Testing feed insertion ===');
  const testFeed = recommendedFeeds?.[0];
  if (testFeed) {
    console.log('Attempting to insert feed:', testFeed.name);
    
    const insertData = {
      user_id: userId,
      name: testFeed.name + ' (TEST)',
      url: testFeed.url,
      site_url: testFeed.site_url,
      description: testFeed.description,
      icon_url: testFeed.icon_url,
      status: 'active',
      priority: 'medium'
    };
    
    console.log('Insert data:', JSON.stringify(insertData, null, 2));
    
    const { data: insertedFeed, error: insertError } = await supabase
      .from('feeds')
      .insert(insertData)
      .select()
      .single();
    
    if (insertError) {
      console.log('ERROR inserting feed:', insertError.message);
      console.log('Full error:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('SUCCESS! Feed inserted:', insertedFeed.id);
      
      // Clean up test feed
      await supabase.from('feeds').delete().eq('id', insertedFeed.id);
      console.log('Test feed cleaned up');
    }
  }
}

testSubscribe().catch(console.error);
