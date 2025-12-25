/**
 * Add NYT RSS Feeds to recommended_feeds
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

// NYT RSS Feeds based on their official structure
const nytFeeds = [
  // Main feeds
  { name: 'NYT Homepage', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'News', description: 'Breaking news, multimedia, reviews & opinion' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'News', description: 'International news from Africa, Americas, Asia, Europe, Middle East' },
  { name: 'NYT U.S.', url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml', category: 'News', description: 'Breaking news from around the United States' },
  { name: 'NYT Politics', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', category: 'News', description: 'U.S. politics, White House, Congress, Supreme Court' },
  { name: 'NYT New York', url: 'https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml', category: 'News', description: 'New York region news including NYC, Westchester, Long Island' },
  
  // Business & Economy
  { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', category: 'Business', description: 'Business and economy news, stock markets, media, finance' },
  { name: 'NYT Economy', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', category: 'Economics', description: 'Economy, job market, real estate, Federal Reserve' },
  { name: 'NYT Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'Technology', description: 'Tech industry news, big tech, startups, internet culture' },
  
  // Science & Health
  { name: 'NYT Science', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', category: 'Science', description: 'Space, animal behavior, genetics, archaeology, climate change' },
  { name: 'NYT Health', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', category: 'Health', description: 'Health and medicine, vaccines, mental health, cancer' },
  { name: 'NYT Climate', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml', category: 'Environment', description: 'Climate and environment news' },
  
  // Arts & Entertainment
  { name: 'NYT Arts', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', category: 'Entertainment', description: 'Pop music, classical, visual art, dance, movies, TV, theater' },
  { name: 'NYT Movies', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml', category: 'Entertainment', description: 'Movie news and reviews' },
  { name: 'NYT Television', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Television.xml', category: 'Entertainment', description: 'TV news, reviews, recaps' },
  { name: 'NYT Music', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Music.xml', category: 'Music', description: 'Music news, reviews, playlists - classical, pop, rock, jazz, hip-hop' },
  
  // Lifestyle
  { name: 'NYT Style', url: 'https://rss.nytimes.com/services/xml/rss/nyt/FashionandStyle.xml', category: 'Lifestyle', description: 'Fashion, style, love, gender, beauty, weddings' },
  { name: 'NYT Travel', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml', category: 'Travel', description: 'Travel news, guides, vacation tips, 52 Places' },
  { name: 'NYT Food', url: 'https://rss.nytimes.com/services/xml/rss/nyt/DiningandWine.xml', category: 'Food', description: 'Food stories, wine news, restaurant reviews, recipes' },
  { name: 'NYT Real Estate', url: 'https://rss.nytimes.com/services/xml/rss/nyt/RealEstate.xml', category: 'Lifestyle', description: 'Renting, buying, selling, interior design, renovation' },
  { name: 'NYT Well', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Well.xml', category: 'Health', description: 'Wellness articles' },
  
  // Sports
  { name: 'NYT Sports', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml', category: 'Sports', description: 'NFL, NBA, NCAA, NHL, baseball, golf, tennis, soccer, Olympics' },
  
  // Education
  { name: 'NYT Education', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', category: 'News', description: 'Education news and articles' },
  
  // Opinion
  { name: 'NYT Opinion', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml', category: 'News', description: 'Opinion pieces and editorials' },
  
  // Magazine & Books
  { name: 'NYT Magazine', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Magazine.xml', category: 'News', description: 'The New York Times Magazine' },
  { name: 'NYT Books', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Books.xml', category: 'Entertainment', description: 'Book reviews and literary news' },
  
  // Obituaries
  { name: 'NYT Obituaries', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Obituaries.xml', category: 'News', description: 'Obituaries' },
];

async function main() {
  console.log('🗞️  Adding NYT RSS Feeds');
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

  for (const feed of nytFeeds) {
    // Check for duplicate URL
    if (existingUrls.has(feed.url.toLowerCase())) {
      console.log(`⏭️  Skipped (URL exists): ${feed.name}`);
      skipped++;
      continue;
    }

    // Check for similar name (NYT feeds)
    const hasNytFeed = Array.from(existingNames).some(name => 
      name.includes('new york times') || 
      name.includes('nyt') ||
      (name.includes('nytimes'))
    );

    // Check if this specific section already exists
    const sectionName = feed.name.replace('NYT ', '').toLowerCase();
    const hasSimilarSection = Array.from(existingNames).some(name => 
      name.toLowerCase().includes(sectionName) && 
      (name.toLowerCase().includes('nyt') || name.toLowerCase().includes('new york times'))
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
        site_url: 'https://www.nytimes.com',
        description: feed.description,
        icon_url: 'https://www.nytimes.com/favicon.ico',
        category: feed.category,
        country: 'US',
        language: 'en',
        tags: ['news', 'nyt', 'new york times'],
        popularity_score: 90,
        article_frequency: 'hourly',
        is_featured: false,
        default_priority: 'medium'
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
