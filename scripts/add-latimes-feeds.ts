/**
 * Add LA Times RSS Feeds to recommended_feeds
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

// LA Times RSS Feeds based on their official structure
// Categories use lowercase frontend IDs to match the category mapping system
const latimesFeeds = [
  // Main News
  { name: 'LA Times Homepage', url: 'https://www.latimes.com/index.rss', category: 'news', description: 'Latest news from the Los Angeles Times' },
  { name: 'LA Times World & Nation', url: 'https://www.latimes.com/world-nation/rss2.0.xml', category: 'news', description: 'World and national news coverage' },
  { name: 'LA Times Politics', url: 'https://www.latimes.com/politics/rss2.0.xml', category: 'news', description: 'Political news and analysis' },
  { name: 'LA Times California', url: 'https://www.latimes.com/california/rss2.0.xml', category: 'news', description: 'California state news' },
  { name: 'LA Times Los Angeles', url: 'https://www.latimes.com/california/los-angeles/rss2.0.xml', category: 'news', description: 'Los Angeles local news' },
  { name: 'LA Times Opinion', url: 'https://www.latimes.com/opinion/rss2.0.xml', category: 'news', description: 'Opinion pieces and editorials' },
  { name: 'LA Times Obituaries', url: 'https://www.latimes.com/obituaries/rss2.0.xml', category: 'news', description: 'Obituaries' },

  // Business & Economy
  { name: 'LA Times Business', url: 'https://www.latimes.com/business/rss2.0.xml', category: 'business', description: 'Business and economy news' },
  { name: 'LA Times Real Estate', url: 'https://www.latimes.com/business/real-estate/rss2.0.xml', category: 'interior', description: 'Real estate and housing market news' },
  { name: 'LA Times Autos', url: 'https://www.latimes.com/business/autos/rss2.0.xml', category: 'cars', description: 'Automotive news and reviews' },

  // Technology
  { name: 'LA Times Technology', url: 'https://www.latimes.com/business/technology/rss2.0.xml', category: 'tech', description: 'Technology industry news' },

  // Science & Health
  { name: 'LA Times Science', url: 'https://www.latimes.com/science/rss2.0.xml', category: 'science', description: 'Science news and discoveries' },
  { name: 'LA Times Health', url: 'https://www.latimes.com/health/rss2.0.xml', category: 'science', description: 'Health and medical news' },
  { name: 'LA Times Environment', url: 'https://www.latimes.com/environment/rss2.0.xml', category: 'science', description: 'Environmental and climate news' },

  // Entertainment
  { name: 'LA Times Entertainment', url: 'https://www.latimes.com/entertainment-arts/rss2.0.xml', category: 'movies', description: 'Entertainment and arts coverage' },
  { name: 'LA Times Movies', url: 'https://www.latimes.com/entertainment-arts/movies/rss2.0.xml', category: 'movies', description: 'Movie news and reviews' },
  { name: 'LA Times TV', url: 'https://www.latimes.com/entertainment-arts/tv/rss2.0.xml', category: 'movies', description: 'Television news and reviews' },
  { name: 'LA Times Music', url: 'https://www.latimes.com/entertainment-arts/music/rss2.0.xml', category: 'music', description: 'Music news and reviews' },
  { name: 'LA Times Books', url: 'https://www.latimes.com/entertainment-arts/books/rss2.0.xml', category: 'books', description: 'Book reviews and literary news' },
  { name: 'LA Times Awards', url: 'https://www.latimes.com/entertainment-arts/awards/rss2.0.xml', category: 'movies', description: 'Entertainment awards coverage' },

  // Lifestyle
  { name: 'LA Times Lifestyle', url: 'https://www.latimes.com/lifestyle/rss2.0.xml', category: 'fashion', description: 'Lifestyle and culture' },
  { name: 'LA Times Food', url: 'https://www.latimes.com/food/rss2.0.xml', category: 'food', description: 'Food news, reviews, and recipes' },
  { name: 'LA Times Travel', url: 'https://www.latimes.com/travel/rss2.0.xml', category: 'travel', description: 'Travel news and guides' },

  // Sports
  { name: 'LA Times Sports', url: 'https://www.latimes.com/sports/rss2.0.xml', category: 'sports', description: 'Sports news and coverage' },
  { name: 'LA Times Lakers', url: 'https://www.latimes.com/sports/lakers/rss2.0.xml', category: 'sports', description: 'Los Angeles Lakers basketball coverage' },
  { name: 'LA Times Dodgers', url: 'https://www.latimes.com/sports/dodgers/rss2.0.xml', category: 'sports', description: 'Los Angeles Dodgers baseball coverage' },
  { name: 'LA Times Clippers', url: 'https://www.latimes.com/sports/clippers/rss2.0.xml', category: 'sports', description: 'Los Angeles Clippers basketball coverage' },
  { name: 'LA Times Rams', url: 'https://www.latimes.com/sports/rams/rss2.0.xml', category: 'sports', description: 'Los Angeles Rams football coverage' },
  { name: 'LA Times Chargers', url: 'https://www.latimes.com/sports/chargers/rss2.0.xml', category: 'sports', description: 'Los Angeles Chargers football coverage' },
  { name: 'LA Times Angels', url: 'https://www.latimes.com/sports/angels/rss2.0.xml', category: 'sports', description: 'Los Angeles Angels baseball coverage' },
  { name: 'LA Times Kings', url: 'https://www.latimes.com/sports/kings/rss2.0.xml', category: 'sports', description: 'Los Angeles Kings hockey coverage' },
  { name: 'LA Times USC', url: 'https://www.latimes.com/sports/usc/rss2.0.xml', category: 'sports', description: 'USC Trojans college sports coverage' },
  { name: 'LA Times UCLA', url: 'https://www.latimes.com/sports/ucla/rss2.0.xml', category: 'sports', description: 'UCLA Bruins college sports coverage' },
  { name: 'LA Times Soccer', url: 'https://www.latimes.com/sports/soccer/rss2.0.xml', category: 'football', description: 'Soccer news and coverage' },

  // Special Topics
  { name: 'LA Times Housing & Homelessness', url: 'https://www.latimes.com/homeless-housing/rss2.0.xml', category: 'news', description: 'Housing crisis and homelessness coverage' },
];

async function main() {
  console.log('📰 Adding LA Times RSS Feeds');
  console.log('=============================\n');

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

  for (const feed of latimesFeeds) {
    // Check for duplicate URL
    if (existingUrls.has(feed.url.toLowerCase())) {
      console.log(`⏭️  Skipped (URL exists): ${feed.name}`);
      skipped++;
      continue;
    }

    // Check for similar name
    const hasLATFeed = Array.from(existingNames).some(name => 
      name.includes('la times') || 
      name.includes('los angeles times') ||
      name.includes('latimes')
    );

    // Check if this specific section already exists
    const sectionName = feed.name.replace('LA Times ', '').toLowerCase();
    const hasSimilarSection = Array.from(existingNames).some(name => 
      name.toLowerCase().includes(sectionName) && 
      (name.toLowerCase().includes('la times') || name.toLowerCase().includes('los angeles'))
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
        site_url: 'https://www.latimes.com',
        description: feed.description,
        icon_url: 'https://www.latimes.com/favicon.ico',
        category: feed.category,
        country: 'US',
        language: 'en',
        tags: ['news', 'la times', 'los angeles', 'california'],
        popularity_score: 85,
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

  console.log('\n=============================');
  console.log(`📊 Summary: ${added} added, ${skipped} skipped`);

  // Get final count
  const { count } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });

  console.log(`📰 Total recommended feeds: ${count}`);
}

main().catch(console.error);
