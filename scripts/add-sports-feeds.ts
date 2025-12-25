/**
 * Add Sports RSS Feeds to recommended_feeds
 * NFL, MLB, NBA, NHL, and Soccer
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('🔗 Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

interface FeedToAdd {
  name: string;
  url: string;
  site_url: string;
  description: string;
  icon_url: string;
  category: string;
  country: string;
  tags: string[];
  popularity_score: number;
}

// NFL - American Football
const nflFeeds: FeedToAdd[] = [
  { name: 'ESPN NFL', url: 'https://www.espn.com/espn/rss/nfl/news', site_url: 'https://www.espn.com/nfl/', description: 'ESPN NFL news and updates', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nfl', 'football', 'espn'], popularity_score: 92 },
  { name: 'NFL.com News', url: 'https://www.nfl.com/rss/rsslanding?searchString=home', site_url: 'https://www.nfl.com/news/', description: 'Official NFL news', icon_url: 'https://www.nfl.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nfl', 'football'], popularity_score: 90 },
  { name: 'CBS Sports NFL', url: 'https://www.cbssports.com/rss/headlines/nfl/', site_url: 'https://www.cbssports.com/nfl/', description: 'CBS Sports NFL coverage', icon_url: 'https://www.cbssports.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nfl', 'football', 'cbs'], popularity_score: 88 },
  { name: 'Pro Football Talk', url: 'https://profootballtalk.nbcsports.com/feed/', site_url: 'https://profootballtalk.nbcsports.com', description: 'NBC Pro Football Talk', icon_url: 'https://nbcsports.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nfl', 'football', 'nbc'], popularity_score: 88 },
  { name: 'Bleacher Report NFL', url: 'https://bleacherreport.com/nfl.rss', site_url: 'https://bleacherreport.com/nfl', description: 'Bleacher Report NFL', icon_url: 'https://bleacherreport.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nfl', 'football'], popularity_score: 85 },
];

// MLB - Baseball
const mlbFeeds: FeedToAdd[] = [
  { name: 'ESPN MLB', url: 'https://www.espn.com/espn/rss/mlb/news', site_url: 'https://www.espn.com/mlb/', description: 'ESPN MLB news and updates', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'mlb', 'baseball', 'espn'], popularity_score: 90 },
  { name: 'MLB.com News', url: 'https://www.mlb.com/feeds/news/rss.xml', site_url: 'https://www.mlb.com/news', description: 'Official MLB news', icon_url: 'https://www.mlb.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'mlb', 'baseball'], popularity_score: 90 },
  { name: 'CBS Sports MLB', url: 'https://www.cbssports.com/rss/headlines/mlb/', site_url: 'https://www.cbssports.com/mlb/', description: 'CBS Sports MLB coverage', icon_url: 'https://www.cbssports.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'mlb', 'baseball', 'cbs'], popularity_score: 85 },
  { name: 'Bleacher Report MLB', url: 'https://bleacherreport.com/mlb.rss', site_url: 'https://bleacherreport.com/mlb', description: 'Bleacher Report MLB', icon_url: 'https://bleacherreport.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'mlb', 'baseball'], popularity_score: 82 },
];

// NBA - Basketball
const nbaFeeds: FeedToAdd[] = [
  { name: 'ESPN NBA', url: 'https://www.espn.com/espn/rss/nba/news', site_url: 'https://www.espn.com/nba/', description: 'ESPN NBA news and updates', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nba', 'basketball', 'espn'], popularity_score: 92 },
  { name: 'NBA.com News', url: 'https://www.nba.com/feeds/news/rss.xml', site_url: 'https://www.nba.com/news', description: 'Official NBA news', icon_url: 'https://www.nba.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nba', 'basketball'], popularity_score: 90 },
  { name: 'CBS Sports NBA', url: 'https://www.cbssports.com/rss/headlines/nba/', site_url: 'https://www.cbssports.com/nba/', description: 'CBS Sports NBA coverage', icon_url: 'https://www.cbssports.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nba', 'basketball', 'cbs'], popularity_score: 88 },
  { name: 'Bleacher Report NBA', url: 'https://bleacherreport.com/nba.rss', site_url: 'https://bleacherreport.com/nba', description: 'Bleacher Report NBA', icon_url: 'https://bleacherreport.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nba', 'basketball'], popularity_score: 85 },
  { name: 'HoopsHype', url: 'https://hoopshype.com/feed/', site_url: 'https://hoopshype.com', description: 'HoopsHype NBA news and rumors', icon_url: 'https://hoopshype.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nba', 'basketball'], popularity_score: 82 },
];

// NHL - Ice Hockey
const nhlFeeds: FeedToAdd[] = [
  { name: 'ESPN NHL', url: 'https://www.espn.com/espn/rss/nhl/news', site_url: 'https://www.espn.com/nhl/', description: 'ESPN NHL news and updates', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nhl', 'hockey', 'espn'], popularity_score: 88 },
  { name: 'NHL.com News', url: 'https://www.nhl.com/rss/news.xml', site_url: 'https://www.nhl.com/news', description: 'Official NHL news', icon_url: 'https://www.nhl.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nhl', 'hockey'], popularity_score: 88 },
  { name: 'CBS Sports NHL', url: 'https://www.cbssports.com/rss/headlines/nhl/', site_url: 'https://www.cbssports.com/nhl/', description: 'CBS Sports NHL coverage', icon_url: 'https://www.cbssports.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nhl', 'hockey', 'cbs'], popularity_score: 85 },
  { name: 'Bleacher Report NHL', url: 'https://bleacherreport.com/nhl.rss', site_url: 'https://bleacherreport.com/nhl', description: 'Bleacher Report NHL', icon_url: 'https://bleacherreport.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nhl', 'hockey'], popularity_score: 82 },
  { name: 'The Hockey News', url: 'https://thehockeynews.com/feed', site_url: 'https://thehockeynews.com', description: 'The Hockey News', icon_url: 'https://thehockeynews.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'nhl', 'hockey'], popularity_score: 82 },
];

// Soccer / Football
const soccerFeeds: FeedToAdd[] = [
  { name: 'ESPN Soccer', url: 'https://www.espn.com/espn/rss/soccer/news', site_url: 'https://www.espn.com/soccer/', description: 'ESPN Soccer news', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'soccer', 'football', 'espn'], popularity_score: 88 },
  { name: 'ESPN MLS', url: 'https://www.espn.com/espn/rss/mls/news', site_url: 'https://www.espn.com/soccer/league/_/name/usa.1', description: 'ESPN MLS news', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'soccer', 'mls', 'espn'], popularity_score: 82 },
  { name: 'BBC Sport Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', site_url: 'https://www.bbc.com/sport/football', description: 'BBC Sport Football', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Sports', country: 'UK', tags: ['sports', 'soccer', 'football', 'bbc', 'premier-league'], popularity_score: 92 },
  { name: 'Sky Sports Football', url: 'https://www.skysports.com/rss/12040', site_url: 'https://www.skysports.com/football', description: 'Sky Sports Football news', icon_url: 'https://www.skysports.com/favicon.ico', category: 'Sports', country: 'UK', tags: ['sports', 'soccer', 'football', 'sky', 'premier-league'], popularity_score: 90 },
  { name: 'Guardian Football', url: 'https://www.theguardian.com/football/rss', site_url: 'https://www.theguardian.com/football', description: 'The Guardian Football', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'Sports', country: 'UK', tags: ['sports', 'soccer', 'football', 'guardian'], popularity_score: 88 },
  { name: 'Bleacher Report Soccer', url: 'https://bleacherreport.com/world-football.rss', site_url: 'https://bleacherreport.com/world-football', description: 'Bleacher Report World Football', icon_url: 'https://bleacherreport.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'soccer', 'football'], popularity_score: 85 },
  { name: 'MLS Soccer', url: 'https://www.mlssoccer.com/rss/', site_url: 'https://www.mlssoccer.com', description: 'Official MLS news', icon_url: 'https://www.mlssoccer.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'soccer', 'mls'], popularity_score: 85 },
  { name: 'FourFourTwo', url: 'https://www.fourfourtwo.com/feeds/all', site_url: 'https://www.fourfourtwo.com', description: 'FourFourTwo football magazine', icon_url: 'https://www.fourfourtwo.com/favicon.ico', category: 'Sports', country: 'UK', tags: ['sports', 'soccer', 'football'], popularity_score: 82 },
];

// General Sports (multi-sport coverage)
const generalSportsFeeds: FeedToAdd[] = [
  { name: 'ESPN Top Headlines', url: 'https://www.espn.com/espn/rss/news', site_url: 'https://www.espn.com', description: 'ESPN top sports headlines', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'espn'], popularity_score: 95 },
  { name: 'CBS Sports Headlines', url: 'https://www.cbssports.com/rss/headlines/', site_url: 'https://www.cbssports.com', description: 'CBS Sports top headlines', icon_url: 'https://www.cbssports.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'cbs'], popularity_score: 90 },
  { name: 'Yahoo Sports', url: 'https://sports.yahoo.com/rss/', site_url: 'https://sports.yahoo.com', description: 'Yahoo Sports news', icon_url: 'https://sports.yahoo.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'yahoo'], popularity_score: 88 },
  { name: 'Sports Illustrated', url: 'https://www.si.com/rss/si_topstories.rss', site_url: 'https://www.si.com', description: 'Sports Illustrated top stories', icon_url: 'https://www.si.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'si'], popularity_score: 88 },
  { name: 'The Athletic', url: 'https://theathletic.com/feeds/rss/news/', site_url: 'https://theathletic.com', description: 'The Athletic sports journalism', icon_url: 'https://theathletic.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'athletic'], popularity_score: 90 },
  { name: 'Deadspin', url: 'https://deadspin.com/rss', site_url: 'https://deadspin.com', description: 'Deadspin sports news', icon_url: 'https://deadspin.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'deadspin'], popularity_score: 78 },
];

// Combine all feeds
const allFeeds: FeedToAdd[] = [
  ...nflFeeds,
  ...mlbFeeds,
  ...nbaFeeds,
  ...nhlFeeds,
  ...soccerFeeds,
  ...generalSportsFeeds,
];

async function main() {
  console.log('🏈 Adding Sports RSS Feeds');
  console.log('==========================\n');

  // Get existing feeds to check for duplicates
  const { data: existingFeeds, error: fetchError } = await supabase
    .from('recommended_feeds')
    .select('url, name');

  if (fetchError) {
    console.error('Failed to fetch existing feeds:', fetchError.message);
    process.exit(1);
  }

  const existingUrls = new Set(existingFeeds?.map(f => f.url.toLowerCase()) || []);
  console.log(`Found ${existingUrls.size} existing feeds\n`);

  let added = 0;
  let skipped = 0;

  for (const feed of allFeeds) {
    // Check for duplicate URL
    if (existingUrls.has(feed.url.toLowerCase())) {
      console.log(`⏭️  Skipped (exists): ${feed.name}`);
      skipped++;
      continue;
    }

    // Add the feed
    const { error: insertError } = await supabase
      .from('recommended_feeds')
      .insert({
        name: feed.name,
        url: feed.url,
        site_url: feed.site_url,
        description: feed.description,
        icon_url: feed.icon_url,
        category: feed.category,
        country: feed.country,
        language: 'en',
        tags: feed.tags,
        popularity_score: feed.popularity_score,
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

  console.log('\n==========================');
  console.log(`📊 Summary: ${added} added, ${skipped} skipped`);

  // Get final count
  const { count } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });

  console.log(`📰 Total recommended feeds: ${count}`);
}

main().catch(console.error);
