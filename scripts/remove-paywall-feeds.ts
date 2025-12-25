import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const paywallFeeds = [
  'https://www.forbes.com/real-time/feed2/',
  'https://www.economist.com/rss',
  'https://www.theaustralian.com.au/rss',
  'https://feeds.hbr.org/harvardbusiness',
  'https://www.motortrend.com/feed/', // Invalid XML
  'https://www.mayoclinic.org/rss', // Invalid XML
  'https://www.anandtech.com/rss/', // Invalid XML
];

async function main() {
  console.log('Removing paywall/broken feeds...');
  for (const url of paywallFeeds) {
    const { data, error } = await supabase
      .from('recommended_feeds')
      .delete()
      .eq('url', url)
      .select('name');
    
    if (error) {
      console.log('Error:', url, error.message);
    } else if (data && data.length > 0) {
      console.log('Removed:', data[0].name);
    } else {
      console.log('Not found:', url);
    }
  }
  console.log('Done!');
}
main();
