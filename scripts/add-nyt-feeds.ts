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
// Categories use lowercase frontend IDs to match the category mapping system
const nytFeeds = [
  // Main feeds
  { name: 'NYT Homepage', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'news', description: 'Breaking news, multimedia, reviews & opinion' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'news', description: 'International news from Africa, Americas, Asia, Europe, Middle East' },
  { name: 'NYT U.S.', url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml', category: 'news', description: 'Breaking news from around the United States' },
  { name: 'NYT Politics', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', category: 'news', description: 'U.S. politics, White House, Congress, Supreme Court' },
  { name: 'NYT New York', url: 'https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml', category: 'news', description: 'New York region news including NYC, Westchester, Long Island' },

  // Business & Economy
  { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', category: 'business', description: 'Business and economy news, stock markets, media, finance' },
  { name: 'NYT Economy', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', category: 'business', description: 'Economy, job market, real estate, Federal Reserve' },
  { name: 'NYT Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'tech', description: 'Tech industry news, big tech, startups, internet culture' },

  // Science & Health
  { name: 'NYT Science', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', category: 'science', description: 'Space, animal behavior, genetics, archaeology, climate change' },
  { name: 'NYT Health', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', category: 'science', description: 'Health and medicine, vaccines, mental health, cancer' },
  { name: 'NYT Climate', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml', category: 'science', description: 'Climate and environment news' },

  // Arts & Entertainment
  { name: 'NYT Arts', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', category: 'movies', description: 'Pop music, classical, visual art, dance, movies, TV, theater' },
  { name: 'NYT Movies', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml', category: 'movies', description: 'Movie news and reviews' },
  { name: 'NYT Television', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Television.xml', category: 'movies', description: 'TV news, reviews, recaps' },
  { name: 'NYT Music', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Music.xml', category: 'music', description: 'Music news, reviews, playlists - classical, pop, rock, jazz, hip-hop' },

  // Lifestyle
  { name: 'NYT Style', url: 'https://rss.nytimes.com/services/xml/rss/nyt/FashionandStyle.xml', category: 'fashion', description: 'Fashion, style, love, gender, beauty, weddings' },
  { name: 'NYT Travel', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml', category: 'travel', description: 'Travel news, guides, vacation tips, 52 Places' },
  { name: 'NYT Food', url: 'https://rss.nytimes.com/services/xml/rss/nyt/DiningandWine.xml', category: 'food', description: 'Food stories, wine news, restaurant reviews, recipes' },
  { name: 'NYT Real Estate', url: 'https://rss.nytimes.com/services/xml/rss/nyt/RealEstate.xml', category: 'interior', description: 'Renting, buying, selling, interior design, renovation' },
  { name: 'NYT Well', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Well.xml', category: 'science', description: 'Wellness articles' },

  // Sports
  { name: 'NYT Sports', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml', category: 'sports', description: 'NFL, NBA, NCAA, NHL, baseball, golf, tennis, soccer, Olympics' },

  // Education
  { name: 'NYT Education', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', category: 'news', description: 'Education news and articles' },

  // Opinion
  { name: 'NYT Opinion', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml', category: 'news', description: 'Opinion pieces and editorials' },

  // Magazine & Books
  { name: 'NYT Magazine', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Magazine.xml', category: 'news', description: 'The New York Times Magazine' },
  { name: 'NYT Books', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Books.xml', category: 'books', description: 'Book reviews and literary news' },
  
  // Obituaries
  { name: 'NYT Obituaries', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Obituaries.xml', category: 'news', description: 'Obituaries' },

  // Additional News - Regional
  { name: 'NYT Africa', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Africa.xml', category: 'news', description: 'News from Africa' },
  { name: 'NYT Americas', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml', category: 'news', description: 'News from the Americas' },
  { name: 'NYT Asia Pacific', url: 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml', category: 'news', description: 'News from Asia Pacific' },
  { name: 'NYT Europe', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml', category: 'news', description: 'News from Europe' },
  { name: 'NYT Middle East', url: 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', category: 'news', description: 'News from the Middle East' },
  { name: 'NYT Sunday Review', url: 'https://rss.nytimes.com/services/xml/rss/nyt/sunday-review.xml', category: 'news', description: 'Sunday Review essays and opinions' },

  // Additional Business
  { name: 'NYT Your Money', url: 'https://rss.nytimes.com/services/xml/rss/nyt/YourMoney.xml', category: 'business', description: 'Personal finance advice and news' },
  { name: 'NYT Media', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Media.xml', category: 'business', description: 'Media and advertising industry news' },
  { name: 'NYT Small Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/SmallBusiness.xml', category: 'business', description: 'Small business news and advice' },
  { name: 'NYT DealBook', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Dealbook.xml', category: 'business', description: 'Financial news and analysis' },

  // Additional Technology
  { name: 'NYT Personal Tech', url: 'https://rss.nytimes.com/services/xml/rss/nyt/PersonalTech.xml', category: 'tech', description: 'Personal technology reviews and news' },

  // Space
  { name: 'NYT Space & Cosmos', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Space.xml', category: 'space', description: 'Space and cosmos news' },

  // Arts & Entertainment
  { name: 'NYT Theater', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Theater.xml', category: 'movies', description: 'Broadway and theater news and reviews' },

  // Photography
  { name: 'NYT Lens', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Lens.xml', category: 'photography', description: 'Photography blog and visual journalism' },

  // Automobiles
  { name: 'NYT Automobiles', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Automobiles.xml', category: 'cars', description: 'Car reviews and automotive news' },

  // Additional Sports
  { name: 'NYT Soccer', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Soccer.xml', category: 'football', description: 'Soccer/football news and coverage' },
  { name: 'NYT Pro Football', url: 'https://rss.nytimes.com/services/xml/rss/nyt/ProFootball.xml', category: 'sports', description: 'NFL and professional football news' },
  { name: 'NYT Pro Basketball', url: 'https://rss.nytimes.com/services/xml/rss/nyt/ProBasketball.xml', category: 'sports', description: 'NBA and professional basketball news' },
  { name: 'NYT Baseball', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Baseball.xml', category: 'sports', description: 'MLB and baseball news' },
  { name: 'NYT Hockey', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Hockey.xml', category: 'sports', description: 'NHL and hockey news' },
  { name: 'NYT Golf', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Golf.xml', category: 'sports', description: 'Golf news and tournament coverage' },
  { name: 'NYT Tennis', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Tennis.xml', category: 'tennis', description: 'Tennis news and tournament coverage' },
  { name: 'NYT College Football', url: 'https://rss.nytimes.com/services/xml/rss/nyt/CollegeFootball.xml', category: 'sports', description: 'NCAA football news' },
  { name: 'NYT College Basketball', url: 'https://rss.nytimes.com/services/xml/rss/nyt/CollegeBasketball.xml', category: 'sports', description: 'NCAA basketball news' },
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
