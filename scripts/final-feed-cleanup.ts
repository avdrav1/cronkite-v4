import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Remaining broken feeds to remove
const feedsToRemove = [
  'https://rsshub.app/apnews/topics/apf-topnews', // 403
  'https://rss.cnn.com/rss/cnn_topstories.rss', // Connection issues
  'https://www.france24.com/en/rss', // Invalid XML
  'https://www.reutersagency.com/feed/', // 404
  'https://www.scientificamerican.com/feed/', // 404
  'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/news/', // Empty
  // Stale feeds
  'https://www.seriouseats.com/feeds/atom', // Last article 2021
];

async function main() {
  console.log('Final feed cleanup...\n');
  
  let removed = 0;
  for (const url of feedsToRemove) {
    const { data, error } = await supabase
      .from('recommended_feeds')
      .delete()
      .eq('url', url)
      .select('name');
    
    if (error) {
      console.log('Error:', url, error.message);
    } else if (data && data.length > 0) {
      console.log('✅ Removed:', data[0].name);
      removed++;
    } else {
      console.log('⚠️  Not found:', url);
    }
  }
  
  // Get final count
  const { count } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Final count: ${count} recommended feeds`);
  console.log(`Removed: ${removed} feeds`);
}

main();
