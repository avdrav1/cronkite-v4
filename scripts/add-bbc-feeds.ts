/**
 * Add BBC RSS Feeds to recommended_feeds
 * Checks for duplicates before adding
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('🔗 Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

// BBC RSS Feeds - comprehensive list
// Categories use lowercase frontend IDs to match the category mapping system
const bbcFeeds = [
  // Main News
  { name: 'BBC News Top Stories', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'news', description: 'BBC News - Top Stories' },
  { name: 'BBC World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'news', description: 'BBC World News' },
  { name: 'BBC UK News', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', category: 'news', description: 'BBC UK News' },
  { name: 'BBC England', url: 'https://feeds.bbci.co.uk/news/england/rss.xml', category: 'news', description: 'BBC England News' },
  { name: 'BBC Scotland', url: 'https://feeds.bbci.co.uk/news/scotland/rss.xml', category: 'news', description: 'BBC Scotland News' },
  { name: 'BBC Wales', url: 'https://feeds.bbci.co.uk/news/wales/rss.xml', category: 'news', description: 'BBC Wales News' },
  { name: 'BBC Northern Ireland', url: 'https://feeds.bbci.co.uk/news/northern_ireland/rss.xml', category: 'news', description: 'BBC Northern Ireland News' },
  { name: 'BBC Politics', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', category: 'news', description: 'BBC Politics' },

  // World Regions
  { name: 'BBC Africa', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', category: 'news', description: 'BBC Africa News' },
  { name: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', category: 'news', description: 'BBC Asia News' },
  { name: 'BBC Australia', url: 'https://feeds.bbci.co.uk/news/world/australia/rss.xml', category: 'news', description: 'BBC Australia News' },
  { name: 'BBC Europe', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', category: 'news', description: 'BBC Europe News' },
  { name: 'BBC Latin America', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', category: 'news', description: 'BBC Latin America News' },
  { name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', category: 'news', description: 'BBC Middle East News' },
  { name: 'BBC US & Canada', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', category: 'news', description: 'BBC US and Canada News' },

  // Topics
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'business', description: 'BBC Business News' },
  { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'tech', description: 'BBC Technology News' },
  { name: 'BBC Science & Environment', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'science', description: 'BBC Science and Environment' },
  { name: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', category: 'science', description: 'BBC Health News' },
  { name: 'BBC Education', url: 'https://feeds.bbci.co.uk/news/education/rss.xml', category: 'news', description: 'BBC Education News' },
  { name: 'BBC Entertainment & Arts', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', category: 'movies', description: 'BBC Entertainment and Arts' },

  // Sports - Main
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'sports', description: 'BBC Sport - All Sports' },
  { name: 'BBC Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', category: 'football', description: 'BBC Football/Soccer News' },
  { name: 'BBC Cricket', url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml', category: 'cricket', description: 'BBC Cricket News' },
  { name: 'BBC Tennis', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', category: 'tennis', description: 'BBC Tennis News' },
  { name: 'BBC Golf', url: 'https://feeds.bbci.co.uk/sport/golf/rss.xml', category: 'sports', description: 'BBC Golf News' },
  { name: 'BBC Rugby Union', url: 'https://feeds.bbci.co.uk/sport/rugby-union/rss.xml', category: 'sports', description: 'BBC Rugby Union News' },
  { name: 'BBC Rugby League', url: 'https://feeds.bbci.co.uk/sport/rugby-league/rss.xml', category: 'sports', description: 'BBC Rugby League News' },
  { name: 'BBC Formula 1', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', category: 'cars', description: 'BBC Formula 1 News' },
  { name: 'BBC Cycling', url: 'https://feeds.bbci.co.uk/sport/cycling/rss.xml', category: 'sports', description: 'BBC Cycling News' },
  { name: 'BBC Athletics', url: 'https://feeds.bbci.co.uk/sport/athletics/rss.xml', category: 'sports', description: 'BBC Athletics News' },
  { name: 'BBC Boxing', url: 'https://feeds.bbci.co.uk/sport/boxing/rss.xml', category: 'sports', description: 'BBC Boxing News' },
  { name: 'BBC Swimming', url: 'https://feeds.bbci.co.uk/sport/swimming/rss.xml', category: 'sports', description: 'BBC Swimming News' },

  // Travel & Culture
  { name: 'BBC Travel', url: 'https://www.bbc.com/travel/feed.rss', category: 'travel', description: 'BBC Travel features and guides' },
  { name: 'BBC Culture', url: 'https://www.bbc.com/culture/feed.rss', category: 'movies', description: 'BBC Culture - Film, Art, Music, Books' },
  { name: 'BBC Future', url: 'https://www.bbc.com/future/feed.rss', category: 'science', description: 'BBC Future - Science and Technology' },
  { name: 'BBC Worklife', url: 'https://www.bbc.com/worklife/feed.rss', category: 'business', description: 'BBC Worklife - Career and Work' },
];

async function main() {
  console.log('📻 Adding BBC RSS Feeds');
  console.log('========================\n');

  // Get existing feeds to check for duplicates
  const { data: existingFeeds, error: fetchError } = await supabase
    .from('recommended_feeds')
    .select('url, name');

  if (fetchError) {
    console.error('Failed to fetch existing feeds:', fetchError.message);
    process.exit(1);
  }

  const existingUrls = new Set(existingFeeds?.map(f => f.url.toLowerCase()) || []);
  const existingNames = new Set(existingFeeds?.map(f => f.name.toLowerCase()) || []);

  console.log(`Found ${existingUrls.size} existing feeds\n`);

  let added = 0;
  let skipped = 0;

  for (const feed of bbcFeeds) {
    // Check for duplicate URL (normalize http/https)
    const normalizedUrl = feed.url.toLowerCase().replace('http://', 'https://');
    const httpUrl = feed.url.toLowerCase().replace('https://', 'http://');
    
    if (existingUrls.has(normalizedUrl) || existingUrls.has(httpUrl) || existingUrls.has(feed.url.toLowerCase())) {
      console.log(`⏭️  Skipped (URL exists): ${feed.name}`);
      skipped++;
      continue;
    }

    // Check for similar name
    const sectionName = feed.name.replace('BBC ', '').toLowerCase();
    const hasSimilarSection = Array.from(existingNames).some(name => 
      name.toLowerCase().includes(sectionName) && 
      name.toLowerCase().includes('bbc')
    );

    if (hasSimilarSection) {
      console.log(`⏭️  Skipped (similar exists): ${feed.name}`);
      skipped++;
      continue;
    }

    // Add the feed
    const { error: insertError } = await supabase
      .from('recommended_feeds')
      .insert({
        name: feed.name,
        url: feed.url,
        site_url: 'https://www.bbc.com',
        description: feed.description,
        icon_url: 'https://www.bbc.com/favicon.ico',
        category: feed.category,
        country: 'UK',
        language: 'en',
        tags: ['news', 'bbc', 'british', 'uk'],
        popularity_score: 90,
        article_frequency: 'hourly',
        is_featured: false,
        default_priority: 'high'
      });

    if (insertError) {
      console.log(`❌ Error adding ${feed.name}: ${insertError.message}`);
    } else {
      console.log(`✅ Added: ${feed.name}`);
      added++;
      existingUrls.add(feed.url.toLowerCase());
    }
  }

  console.log('\n========================');
  console.log(`📊 Summary: ${added} added, ${skipped} skipped`);

  // Get final count
  const { count } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });

  console.log(`📰 Total recommended feeds: ${count}`);
}

main().catch(console.error);
