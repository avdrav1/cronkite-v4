#!/usr/bin/env tsx

/**
 * Flagship Feeds Seeding Script
 * 
 * This script seeds ~100 flagship feeds across all major categories.
 * Flagship feeds are high-priority sources that receive enhanced monitoring
 * and maintenance. They are marked with is_featured = true.
 * 
 * Requirements: 1.1, 1.3
 */

// Load environment variables
import '../server/env';
import { createClient } from '@supabase/supabase-js';
import { categoryMappingService } from '../shared/category-mapping';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FlagshipFeed {
  name: string;
  url: string;
  site_url: string;
  description: string;
  icon_url: string;
  category: string;
  country: string;
  language: string;
  tags: string[];
  popularity_score: number;
  article_frequency: string;
  is_featured: boolean;
}

// ~100 flagship feeds covering all major categories
// Approximately 3-4 feeds per category to reach ~100 total
const flagshipFeeds: FlagshipFeed[] = [
  // Technology (4 feeds)
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', site_url: 'https://techcrunch.com', description: 'The latest technology news and information on startups', icon_url: 'https://techcrunch.com/favicon.ico', category: 'Technology', country: 'US', language: 'en', tags: ['technology', 'startups', 'venture capital'], popularity_score: 95, article_frequency: 'hourly', is_featured: true },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', site_url: 'https://www.theverge.com', description: 'Technology, science, art, and culture', icon_url: 'https://www.theverge.com/favicon.ico', category: 'Technology', country: 'US', language: 'en', tags: ['technology', 'science', 'culture'], popularity_score: 90, article_frequency: 'daily', is_featured: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', site_url: 'https://arstechnica.com', description: 'Technology news and analysis', icon_url: 'https://arstechnica.com/favicon.ico', category: 'Technology', country: 'US', language: 'en', tags: ['technology', 'science', 'analysis'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', site_url: 'https://www.wired.com', description: 'Ideas, breakthroughs, and the future', icon_url: 'https://www.wired.com/favicon.ico', category: 'Technology', country: 'US', language: 'en', tags: ['technology', 'future', 'innovation'], popularity_score: 88, article_frequency: 'daily', is_featured: true },

  // News (5 feeds)
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', site_url: 'https://www.bbc.com/news', description: 'Breaking news, sport, TV, radio and a whole lot more', icon_url: 'https://www.bbc.com/favicon.ico', category: 'News', country: 'UK', language: 'en', tags: ['news', 'world', 'politics'], popularity_score: 98, article_frequency: 'hourly', is_featured: true },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', site_url: 'https://www.reuters.com', description: 'Breaking international news and headlines', icon_url: 'https://www.reuters.com/favicon.ico', category: 'News', country: 'US', language: 'en', tags: ['news', 'international', 'breaking'], popularity_score: 96, article_frequency: 'hourly', is_featured: true },
  { name: 'Associated Press', url: 'https://feeds.apnews.com/rss/apf-topnews', site_url: 'https://apnews.com', description: 'The definitive source for global and local news', icon_url: 'https://apnews.com/favicon.ico', category: 'News', country: 'US', language: 'en', tags: ['news', 'breaking', 'global'], popularity_score: 94, article_frequency: 'hourly', is_featured: true },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', site_url: 'https://www.npr.org', description: 'NPR news, audio, and podcasts', icon_url: 'https://www.npr.org/favicon.ico', category: 'News', country: 'US', language: 'en', tags: ['news', 'radio', 'podcasts'], popularity_score: 90, article_frequency: 'hourly', is_featured: true },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', site_url: 'https://www.theguardian.com', description: 'Latest world news and analysis', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'News', country: 'UK', language: 'en', tags: ['news', 'world', 'analysis'], popularity_score: 92, article_frequency: 'hourly', is_featured: true },

  // Business (4 feeds)
  { name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', site_url: 'https://www.wsj.com', description: 'Breaking news and analysis from the U.S. and around the world', icon_url: 'https://www.wsj.com/favicon.ico', category: 'Business', country: 'US', language: 'en', tags: ['business', 'finance', 'markets'], popularity_score: 92, article_frequency: 'hourly', is_featured: true },
  { name: 'Financial Times', url: 'https://www.ft.com/rss/home', site_url: 'https://www.ft.com', description: 'Global financial news and analysis', icon_url: 'https://www.ft.com/favicon.ico', category: 'Business', country: 'UK', language: 'en', tags: ['business', 'finance', 'global'], popularity_score: 90, article_frequency: 'daily', is_featured: true },
  { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', site_url: 'https://www.bloomberg.com', description: 'Business and financial news', icon_url: 'https://www.bloomberg.com/favicon.ico', category: 'Business', country: 'US', language: 'en', tags: ['business', 'markets', 'finance'], popularity_score: 88, article_frequency: 'hourly', is_featured: true },
  { name: 'Forbes', url: 'https://www.forbes.com/real-time/feed2/', site_url: 'https://www.forbes.com', description: 'Business news and financial news', icon_url: 'https://www.forbes.com/favicon.ico', category: 'Business', country: 'US', language: 'en', tags: ['business', 'entrepreneurs', 'wealth'], popularity_score: 85, article_frequency: 'daily', is_featured: true },

  // Science (4 feeds)
  { name: 'Scientific American', url: 'https://rss.sciam.com/ScientificAmerican-Global', site_url: 'https://www.scientificamerican.com', description: 'Science news and research', icon_url: 'https://www.scientificamerican.com/favicon.ico', category: 'Science', country: 'US', language: 'en', tags: ['science', 'research', 'discovery'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Nature', url: 'https://www.nature.com/nature.rss', site_url: 'https://www.nature.com', description: 'International journal of science', icon_url: 'https://www.nature.com/favicon.ico', category: 'Science', country: 'UK', language: 'en', tags: ['science', 'research', 'journal'], popularity_score: 90, article_frequency: 'weekly', is_featured: true },
  { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', site_url: 'https://www.sciencedaily.com', description: 'Breaking science news and articles', icon_url: 'https://www.sciencedaily.com/favicon.ico', category: 'Science', country: 'US', language: 'en', tags: ['science', 'news', 'research'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', site_url: 'https://www.newscientist.com', description: 'Science news and technology', icon_url: 'https://www.newscientist.com/favicon.ico', category: 'Science', country: 'UK', language: 'en', tags: ['science', 'technology', 'news'], popularity_score: 80, article_frequency: 'daily', is_featured: true },

  // Sports (4 feeds)
  { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', site_url: 'https://www.espn.com', description: 'Sports news and analysis', icon_url: 'https://www.espn.com/favicon.ico', category: 'Sports', country: 'US', language: 'en', tags: ['sports', 'news', 'analysis'], popularity_score: 92, article_frequency: 'hourly', is_featured: true },
  { name: 'BBC Sport', url: 'http://feeds.bbci.co.uk/sport/rss.xml', site_url: 'https://www.bbc.com/sport', description: 'Sports news from the BBC', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Sports', country: 'UK', language: 'en', tags: ['sports', 'news', 'bbc'], popularity_score: 88, article_frequency: 'hourly', is_featured: true },
  { name: 'Sports Illustrated', url: 'https://www.si.com/rss/si_topstories.rss', site_url: 'https://www.si.com', description: 'Sports news and features', icon_url: 'https://www.si.com/favicon.ico', category: 'Sports', country: 'US', language: 'en', tags: ['sports', 'news', 'features'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Bleacher Report', url: 'https://bleacherreport.com/articles/feed', site_url: 'https://bleacherreport.com', description: 'Sports news and highlights', icon_url: 'https://bleacherreport.com/favicon.ico', category: 'Sports', country: 'US', language: 'en', tags: ['sports', 'news', 'highlights'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // Gaming (4 feeds)
  { name: 'IGN', url: 'https://feeds.ign.com/ign/games-all', site_url: 'https://www.ign.com', description: 'Video game news and reviews', icon_url: 'https://www.ign.com/favicon.ico', category: 'Gaming', country: 'US', language: 'en', tags: ['gaming', 'reviews', 'news'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/', site_url: 'https://www.gamespot.com', description: 'Video game news, reviews, and guides', icon_url: 'https://www.gamespot.com/favicon.ico', category: 'Gaming', country: 'US', language: 'en', tags: ['gaming', 'reviews', 'guides'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'Kotaku', url: 'https://kotaku.com/rss', site_url: 'https://kotaku.com', description: 'Gaming news and culture', icon_url: 'https://kotaku.com/favicon.ico', category: 'Gaming', country: 'US', language: 'en', tags: ['gaming', 'culture', 'news'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', site_url: 'https://www.polygon.com', description: 'Gaming news and entertainment', icon_url: 'https://www.polygon.com/favicon.ico', category: 'Gaming', country: 'US', language: 'en', tags: ['gaming', 'entertainment', 'news'], popularity_score: 78, article_frequency: 'daily', is_featured: true },

  // Entertainment (4 feeds)
  { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', site_url: 'https://www.hollywoodreporter.com', description: 'Entertainment news and analysis', icon_url: 'https://www.hollywoodreporter.com/favicon.ico', category: 'Entertainment', country: 'US', language: 'en', tags: ['movies', 'entertainment', 'hollywood'], popularity_score: 88, article_frequency: 'daily', is_featured: true },
  { name: 'Variety', url: 'https://variety.com/feed/', site_url: 'https://variety.com', description: 'Entertainment news and analysis', icon_url: 'https://variety.com/favicon.ico', category: 'Entertainment', country: 'US', language: 'en', tags: ['movies', 'entertainment', 'industry'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Entertainment Weekly', url: 'https://ew.com/feed/', site_url: 'https://ew.com', description: 'Entertainment news and reviews', icon_url: 'https://ew.com/favicon.ico', category: 'Entertainment', country: 'US', language: 'en', tags: ['entertainment', 'movies', 'tv'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'Deadline', url: 'https://deadline.com/feed/', site_url: 'https://deadline.com', description: 'Hollywood and entertainment news', icon_url: 'https://deadline.com/favicon.ico', category: 'Entertainment', country: 'US', language: 'en', tags: ['entertainment', 'hollywood', 'news'], popularity_score: 80, article_frequency: 'daily', is_featured: true },

  // Music (3 feeds)
  { name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/', site_url: 'https://www.rollingstone.com', description: 'Music news and culture', icon_url: 'https://www.rollingstone.com/favicon.ico', category: 'Music', country: 'US', language: 'en', tags: ['music', 'culture', 'news'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Pitchfork', url: 'https://pitchfork.com/rss/news/', site_url: 'https://pitchfork.com', description: 'Music reviews and news', icon_url: 'https://pitchfork.com/favicon.ico', category: 'Music', country: 'US', language: 'en', tags: ['music', 'reviews', 'indie'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Billboard', url: 'https://www.billboard.com/feed/', site_url: 'https://www.billboard.com', description: 'Music charts and news', icon_url: 'https://www.billboard.com/favicon.ico', category: 'Music', country: 'US', language: 'en', tags: ['music', 'charts', 'news'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // Programming (4 feeds)
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', site_url: 'https://news.ycombinator.com', description: 'Social news website focusing on computer science and entrepreneurship', icon_url: 'https://news.ycombinator.com/favicon.ico', category: 'Programming', country: 'US', language: 'en', tags: ['programming', 'startups', 'tech'], popularity_score: 95, article_frequency: 'hourly', is_featured: true },
  { name: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/', site_url: 'https://stackoverflow.blog', description: 'Programming and developer community news', icon_url: 'https://stackoverflow.com/favicon.ico', category: 'Programming', country: 'US', language: 'en', tags: ['programming', 'development', 'community'], popularity_score: 88, article_frequency: 'weekly', is_featured: true },
  { name: 'Dev.to', url: 'https://dev.to/feed', site_url: 'https://dev.to', description: 'Developer community and articles', icon_url: 'https://dev.to/favicon.ico', category: 'Programming', country: 'US', language: 'en', tags: ['programming', 'development', 'community'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', site_url: 'https://css-tricks.com', description: 'Web development tips and tricks', icon_url: 'https://css-tricks.com/favicon.ico', category: 'Programming', country: 'US', language: 'en', tags: ['programming', 'web', 'css'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // Design (3 feeds)
  { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', site_url: 'https://www.smashingmagazine.com', description: 'Web design and development', icon_url: 'https://www.smashingmagazine.com/favicon.ico', category: 'Design', country: 'DE', language: 'en', tags: ['design', 'web', 'development'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'A List Apart', url: 'https://alistapart.com/main/feed/', site_url: 'https://alistapart.com', description: 'Web design and development', icon_url: 'https://alistapart.com/favicon.ico', category: 'Design', country: 'US', language: 'en', tags: ['design', 'web', 'standards'], popularity_score: 82, article_frequency: 'weekly', is_featured: true },
  { name: 'Dribbble Blog', url: 'https://dribbble.com/stories.rss', site_url: 'https://dribbble.com', description: 'Design inspiration and community', icon_url: 'https://dribbble.com/favicon.ico', category: 'Design', country: 'US', language: 'en', tags: ['design', 'inspiration', 'community'], popularity_score: 80, article_frequency: 'daily', is_featured: true },

  // Space (3 feeds)
  { name: 'NASA News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', site_url: 'https://www.nasa.gov', description: 'NASA news and updates', icon_url: 'https://www.nasa.gov/favicon.ico', category: 'Space', country: 'US', language: 'en', tags: ['space', 'nasa', 'science'], popularity_score: 90, article_frequency: 'daily', is_featured: true },
  { name: 'Space.com', url: 'https://www.space.com/feeds/all', site_url: 'https://www.space.com', description: 'Space news and astronomy', icon_url: 'https://www.space.com/favicon.ico', category: 'Space', country: 'US', language: 'en', tags: ['space', 'astronomy', 'science'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'SpaceNews', url: 'https://spacenews.com/feed/', site_url: 'https://spacenews.com', description: 'Space industry news', icon_url: 'https://spacenews.com/favicon.ico', category: 'Space', country: 'US', language: 'en', tags: ['space', 'industry', 'news'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // Food (3 feeds)
  { name: 'Food & Wine', url: 'https://www.foodandwine.com/syndication/feed', site_url: 'https://www.foodandwine.com', description: 'Food and cooking news', icon_url: 'https://www.foodandwine.com/favicon.ico', category: 'Food', country: 'US', language: 'en', tags: ['food', 'cooking', 'recipes'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Bon Appétit', url: 'https://www.bonappetit.com/feed/rss', site_url: 'https://www.bonappetit.com', description: 'Food and cooking magazine', icon_url: 'https://www.bonappetit.com/favicon.ico', category: 'Food', country: 'US', language: 'en', tags: ['food', 'cooking', 'magazine'], popularity_score: 78, article_frequency: 'daily', is_featured: true },
  { name: 'Serious Eats', url: 'https://www.seriouseats.com/feeds/all', site_url: 'https://www.seriouseats.com', description: 'Food science and recipes', icon_url: 'https://www.seriouseats.com/favicon.ico', category: 'Food', country: 'US', language: 'en', tags: ['food', 'recipes', 'science'], popularity_score: 75, article_frequency: 'daily', is_featured: true },

  // Travel (3 feeds)
  { name: 'Lonely Planet', url: 'https://www.lonelyplanet.com/news/feed/rss/', site_url: 'https://www.lonelyplanet.com', description: 'Travel guides and news', icon_url: 'https://www.lonelyplanet.com/favicon.ico', category: 'Travel', country: 'AU', language: 'en', tags: ['travel', 'guides', 'destinations'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Travel + Leisure', url: 'https://www.travelandleisure.com/syndication/feed', site_url: 'https://www.travelandleisure.com', description: 'Travel news and guides', icon_url: 'https://www.travelandleisure.com/favicon.ico', category: 'Travel', country: 'US', language: 'en', tags: ['travel', 'leisure', 'destinations'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'Condé Nast Traveler', url: 'https://www.cntraveler.com/feed/rss', site_url: 'https://www.cntraveler.com', description: 'Luxury travel and lifestyle', icon_url: 'https://www.cntraveler.com/favicon.ico', category: 'Travel', country: 'US', language: 'en', tags: ['travel', 'luxury', 'lifestyle'], popularity_score: 80, article_frequency: 'daily', is_featured: true },

  // Books (3 feeds)
  { name: 'Book Riot', url: 'https://bookriot.com/feed/', site_url: 'https://bookriot.com', description: 'Book news and recommendations', icon_url: 'https://bookriot.com/favicon.ico', category: 'Books', country: 'US', language: 'en', tags: ['books', 'reading', 'reviews'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Literary Hub', url: 'https://lithub.com/feed/', site_url: 'https://lithub.com', description: 'Literary news and culture', icon_url: 'https://lithub.com/favicon.ico', category: 'Books', country: 'US', language: 'en', tags: ['books', 'literature', 'culture'], popularity_score: 78, article_frequency: 'daily', is_featured: true },
  { name: 'The New York Times Books', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Books.xml', site_url: 'https://www.nytimes.com/section/books', description: 'Book reviews and news', icon_url: 'https://www.nytimes.com/favicon.ico', category: 'Books', country: 'US', language: 'en', tags: ['books', 'reviews', 'news'], popularity_score: 85, article_frequency: 'daily', is_featured: true },

  // Automotive (3 feeds)
  { name: 'Car and Driver', url: 'https://www.caranddriver.com/rss/all.xml/', site_url: 'https://www.caranddriver.com', description: 'Car news and reviews', icon_url: 'https://www.caranddriver.com/favicon.ico', category: 'Automotive', country: 'US', language: 'en', tags: ['cars', 'automotive', 'reviews'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'Motor Trend', url: 'https://www.motortrend.com/feed/', site_url: 'https://www.motortrend.com', description: 'Automotive news and reviews', icon_url: 'https://www.motortrend.com/favicon.ico', category: 'Automotive', country: 'US', language: 'en', tags: ['cars', 'automotive', 'news'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Jalopnik', url: 'https://jalopnik.com/rss', site_url: 'https://jalopnik.com', description: 'Car news and culture', icon_url: 'https://jalopnik.com/favicon.ico', category: 'Automotive', country: 'US', language: 'en', tags: ['cars', 'culture', 'news'], popularity_score: 78, article_frequency: 'daily', is_featured: true },

  // DIY (3 feeds)
  { name: 'Instructables', url: 'https://www.instructables.com/rss/', site_url: 'https://www.instructables.com', description: 'DIY projects and tutorials', icon_url: 'https://www.instructables.com/favicon.ico', category: 'DIY', country: 'US', language: 'en', tags: ['diy', 'projects', 'tutorials'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Make Magazine', url: 'https://makezine.com/feed/', site_url: 'https://makezine.com', description: 'DIY technology and projects', icon_url: 'https://makezine.com/favicon.ico', category: 'DIY', country: 'US', language: 'en', tags: ['diy', 'maker', 'technology'], popularity_score: 78, article_frequency: 'daily', is_featured: true },
  { name: 'Hackaday', url: 'https://hackaday.com/feed/', site_url: 'https://hackaday.com', description: 'Hardware hacking and DIY', icon_url: 'https://hackaday.com/favicon.ico', category: 'DIY', country: 'US', language: 'en', tags: ['diy', 'hardware', 'hacking'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // Android (3 feeds)
  { name: 'Android Authority', url: 'https://www.androidauthority.com/feed/', site_url: 'https://www.androidauthority.com', description: 'Android news and reviews', icon_url: 'https://www.androidauthority.com/favicon.ico', category: 'Android', country: 'US', language: 'en', tags: ['android', 'mobile', 'reviews'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Android Police', url: 'https://www.androidpolice.com/feed/', site_url: 'https://www.androidpolice.com', description: 'Android news and apps', icon_url: 'https://www.androidpolice.com/favicon.ico', category: 'Android', country: 'US', language: 'en', tags: ['android', 'apps', 'news'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: '9to5Google', url: 'https://9to5google.com/feed/', site_url: 'https://9to5google.com', description: 'Google and Android news', icon_url: 'https://9to5google.com/favicon.ico', category: 'Android', country: 'US', language: 'en', tags: ['android', 'google', 'news'], popularity_score: 80, article_frequency: 'daily', is_featured: true },

  // Apple (3 feeds)
  { name: '9to5Mac', url: 'https://9to5mac.com/feed/', site_url: 'https://9to5mac.com', description: 'Apple news and reviews', icon_url: 'https://9to5mac.com/favicon.ico', category: 'Apple', country: 'US', language: 'en', tags: ['apple', 'mac', 'ios'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'MacRumors', url: 'https://feeds.macrumors.com/MacRumors-All', site_url: 'https://www.macrumors.com', description: 'Apple news and rumors', icon_url: 'https://www.macrumors.com/favicon.ico', category: 'Apple', country: 'US', language: 'en', tags: ['apple', 'rumors', 'news'], popularity_score: 88, article_frequency: 'daily', is_featured: true },
  { name: 'AppleInsider', url: 'https://appleinsider.com/rss/news/', site_url: 'https://appleinsider.com', description: 'Apple news and analysis', icon_url: 'https://appleinsider.com/favicon.ico', category: 'Apple', country: 'US', language: 'en', tags: ['apple', 'analysis', 'news'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // History (3 feeds)
  { name: 'History.com', url: 'https://www.history.com/rss', site_url: 'https://www.history.com', description: 'History news and features', icon_url: 'https://www.history.com/favicon.ico', category: 'History', country: 'US', language: 'en', tags: ['history', 'features', 'news'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com/rss/latest_articles/', site_url: 'https://www.smithsonianmag.com', description: 'History, science, and culture', icon_url: 'https://www.smithsonianmag.com/favicon.ico', category: 'History', country: 'US', language: 'en', tags: ['history', 'science', 'culture'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'History Extra', url: 'https://www.historyextra.com/feed/', site_url: 'https://www.historyextra.com', description: 'BBC History Magazine online', icon_url: 'https://www.historyextra.com/favicon.ico', category: 'History', country: 'UK', language: 'en', tags: ['history', 'bbc', 'magazine'], popularity_score: 78, article_frequency: 'daily', is_featured: true },

  // Humor (3 feeds)
  { name: 'The Onion', url: 'https://www.theonion.com/rss', site_url: 'https://www.theonion.com', description: 'Satirical news', icon_url: 'https://www.theonion.com/favicon.ico', category: 'Humor', country: 'US', language: 'en', tags: ['humor', 'satire', 'news'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Cracked', url: 'https://www.cracked.com/feed', site_url: 'https://www.cracked.com', description: 'Comedy and humor', icon_url: 'https://www.cracked.com/favicon.ico', category: 'Humor', country: 'US', language: 'en', tags: ['humor', 'comedy', 'entertainment'], popularity_score: 78, article_frequency: 'daily', is_featured: true },
  { name: 'McSweeneys', url: 'https://www.mcsweeneys.net/feeds/columns', site_url: 'https://www.mcsweeneys.net', description: 'Humor and satire', icon_url: 'https://www.mcsweeneys.net/favicon.ico', category: 'Humor', country: 'US', language: 'en', tags: ['humor', 'satire', 'writing'], popularity_score: 75, article_frequency: 'daily', is_featured: true },

  // Beauty (3 feeds)
  { name: 'Allure', url: 'https://www.allure.com/feed/rss', site_url: 'https://www.allure.com', description: 'Beauty news and trends', icon_url: 'https://www.allure.com/favicon.ico', category: 'Beauty', country: 'US', language: 'en', tags: ['beauty', 'trends', 'skincare'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'Into The Gloss', url: 'https://intothegloss.com/feed/', site_url: 'https://intothegloss.com', description: 'Beauty and skincare', icon_url: 'https://intothegloss.com/favicon.ico', category: 'Beauty', country: 'US', language: 'en', tags: ['beauty', 'skincare', 'lifestyle'], popularity_score: 75, article_frequency: 'daily', is_featured: true },
  { name: 'Byrdie', url: 'https://www.byrdie.com/feed', site_url: 'https://www.byrdie.com', description: 'Beauty tips and trends', icon_url: 'https://www.byrdie.com/favicon.ico', category: 'Beauty', country: 'US', language: 'en', tags: ['beauty', 'tips', 'trends'], popularity_score: 78, article_frequency: 'daily', is_featured: true },

  // Fashion (3 feeds)
  { name: 'Vogue', url: 'https://www.vogue.com/feed/rss', site_url: 'https://www.vogue.com', description: 'Fashion news and trends', icon_url: 'https://www.vogue.com/favicon.ico', category: 'Fashion', country: 'US', language: 'en', tags: ['fashion', 'trends', 'style'], popularity_score: 90, article_frequency: 'daily', is_featured: true },
  { name: 'GQ', url: 'https://www.gq.com/feed/rss', site_url: 'https://www.gq.com', description: 'Mens fashion and style', icon_url: 'https://www.gq.com/favicon.ico', category: 'Fashion', country: 'US', language: 'en', tags: ['fashion', 'mens', 'style'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Fashionista', url: 'https://fashionista.com/feed', site_url: 'https://fashionista.com', description: 'Fashion industry news', icon_url: 'https://fashionista.com/favicon.ico', category: 'Fashion', country: 'US', language: 'en', tags: ['fashion', 'industry', 'news'], popularity_score: 78, article_frequency: 'daily', is_featured: true },

  // Startups (3 feeds)
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/', site_url: 'https://techcrunch.com/startups', description: 'Startup news and funding', icon_url: 'https://techcrunch.com/favicon.ico', category: 'Startups', country: 'US', language: 'en', tags: ['startups', 'funding', 'tech'], popularity_score: 90, article_frequency: 'daily', is_featured: true },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', site_url: 'https://venturebeat.com', description: 'Tech and startup news', icon_url: 'https://venturebeat.com/favicon.ico', category: 'Startups', country: 'US', language: 'en', tags: ['startups', 'tech', 'news'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/', site_url: 'https://news.crunchbase.com', description: 'Startup funding and news', icon_url: 'https://news.crunchbase.com/favicon.ico', category: 'Startups', country: 'US', language: 'en', tags: ['startups', 'funding', 'data'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // Cricket (3 feeds)
  { name: 'ESPNcricinfo', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', site_url: 'https://www.espncricinfo.com', description: 'Cricket news and scores', icon_url: 'https://www.espncricinfo.com/favicon.ico', category: 'Cricket', country: 'UK', language: 'en', tags: ['cricket', 'sports', 'scores'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Cricbuzz', url: 'https://www.cricbuzz.com/rss/cb_news.xml', site_url: 'https://www.cricbuzz.com', description: 'Cricket news and live scores', icon_url: 'https://www.cricbuzz.com/favicon.ico', category: 'Cricket', country: 'IN', language: 'en', tags: ['cricket', 'live', 'scores'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'Cricket Australia', url: 'https://www.cricket.com.au/rss', site_url: 'https://www.cricket.com.au', description: 'Australian cricket news', icon_url: 'https://www.cricket.com.au/favicon.ico', category: 'Cricket', country: 'AU', language: 'en', tags: ['cricket', 'australia', 'news'], popularity_score: 78, article_frequency: 'daily', is_featured: true },

  // Football (3 feeds)
  { name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news', site_url: 'https://www.espn.com/soccer', description: 'Football/soccer news', icon_url: 'https://www.espn.com/favicon.ico', category: 'Football', country: 'US', language: 'en', tags: ['football', 'soccer', 'sports'], popularity_score: 88, article_frequency: 'daily', is_featured: true },
  { name: 'BBC Football', url: 'http://feeds.bbci.co.uk/sport/football/rss.xml', site_url: 'https://www.bbc.com/sport/football', description: 'Football news from BBC', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Football', country: 'UK', language: 'en', tags: ['football', 'bbc', 'sports'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Goal.com', url: 'https://www.goal.com/feeds/en/news', site_url: 'https://www.goal.com', description: 'Football news and transfers', icon_url: 'https://www.goal.com/favicon.ico', category: 'Football', country: 'UK', language: 'en', tags: ['football', 'transfers', 'news'], popularity_score: 82, article_frequency: 'daily', is_featured: true },

  // Tennis (3 feeds)
  { name: 'Tennis.com', url: 'https://www.tennis.com/rss', site_url: 'https://www.tennis.com', description: 'Tennis news and scores', icon_url: 'https://www.tennis.com/favicon.ico', category: 'Tennis', country: 'US', language: 'en', tags: ['tennis', 'sports', 'scores'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
  { name: 'ATP Tour', url: 'https://www.atptour.com/en/media/rss-feed/xml-feed', site_url: 'https://www.atptour.com', description: 'ATP tennis news', icon_url: 'https://www.atptour.com/favicon.ico', category: 'Tennis', country: 'UK', language: 'en', tags: ['tennis', 'atp', 'sports'], popularity_score: 78, article_frequency: 'daily', is_featured: true },
  { name: 'WTA Tennis', url: 'https://www.wtatennis.com/rss', site_url: 'https://www.wtatennis.com', description: 'WTA tennis news', icon_url: 'https://www.wtatennis.com/favicon.ico', category: 'Tennis', country: 'US', language: 'en', tags: ['tennis', 'wta', 'sports'], popularity_score: 75, article_frequency: 'daily', is_featured: true },

  // Photography (3 feeds)
  { name: 'PetaPixel', url: 'https://petapixel.com/feed/', site_url: 'https://petapixel.com', description: 'Photography news and tutorials', icon_url: 'https://petapixel.com/favicon.ico', category: 'Photography', country: 'US', language: 'en', tags: ['photography', 'tutorials', 'news'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Digital Photography Review', url: 'https://www.dpreview.com/feeds/news.xml', site_url: 'https://www.dpreview.com', description: 'Camera reviews and news', icon_url: 'https://www.dpreview.com/favicon.ico', category: 'Photography', country: 'US', language: 'en', tags: ['photography', 'cameras', 'reviews'], popularity_score: 82, article_frequency: 'daily', is_featured: true },
  { name: 'Fstoppers', url: 'https://fstoppers.com/rss.xml', site_url: 'https://fstoppers.com', description: 'Photography community and news', icon_url: 'https://fstoppers.com/favicon.ico', category: 'Photography', country: 'US', language: 'en', tags: ['photography', 'community', 'tutorials'], popularity_score: 78, article_frequency: 'daily', is_featured: true },

  // Interior (3 feeds)
  { name: 'Dezeen', url: 'https://www.dezeen.com/feed/', site_url: 'https://www.dezeen.com', description: 'Architecture and design', icon_url: 'https://www.dezeen.com/favicon.ico', category: 'Interior', country: 'UK', language: 'en', tags: ['interior', 'architecture', 'design'], popularity_score: 85, article_frequency: 'daily', is_featured: true },
  { name: 'Architectural Digest', url: 'https://www.architecturaldigest.com/feed/rss', site_url: 'https://www.architecturaldigest.com', description: 'Interior design and architecture', icon_url: 'https://www.architecturaldigest.com/favicon.ico', category: 'Interior', country: 'US', language: 'en', tags: ['interior', 'design', 'architecture'], popularity_score: 88, article_frequency: 'daily', is_featured: true },
  { name: 'Apartment Therapy', url: 'https://www.apartmenttherapy.com/feed', site_url: 'https://www.apartmenttherapy.com', description: 'Home and interior design', icon_url: 'https://www.apartmenttherapy.com/favicon.ico', category: 'Interior', country: 'US', language: 'en', tags: ['interior', 'home', 'design'], popularity_score: 80, article_frequency: 'daily', is_featured: true },
];


async function seedFlagshipFeeds(): Promise<void> {
  console.log('🚀 Starting flagship feeds seeding...');
  console.log(`📊 Total flagship feeds to seed: ${flagshipFeeds.length}`);
  
  try {
    // Validate all feed categories
    console.log('🔍 Validating feed categories...');
    const invalidFeeds: string[] = [];
    const validatedFeeds = flagshipFeeds.filter(feed => {
      const isValid = categoryMappingService.isValidDatabaseCategory(feed.category);
      if (!isValid) {
        invalidFeeds.push(`${feed.name} (category: ${feed.category})`);
      }
      return isValid;
    });

    if (invalidFeeds.length > 0) {
      console.error('❌ Found feeds with invalid categories:');
      invalidFeeds.forEach(feed => console.error(`   - ${feed}`));
      throw new Error('Invalid categories found in flagship feeds');
    }

    console.log(`✅ All ${validatedFeeds.length} feeds have valid categories`);

    // Log category distribution
    const categoryDistribution: Record<string, number> = {};
    validatedFeeds.forEach(feed => {
      categoryDistribution[feed.category] = (categoryDistribution[feed.category] || 0) + 1;
    });
    
    console.log('📊 Category distribution:');
    Object.entries(categoryDistribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const frontendId = categoryMappingService.databaseToFrontend(category);
        console.log(`   ${category} (${frontendId}): ${count} feeds`);
      });

    // Clear existing recommended feeds
    console.log('🧹 Clearing existing recommended feeds...');
    const { error: deleteError } = await supabase
      .from('recommended_feeds')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.warn('⚠️  Warning during cleanup:', deleteError.message);
    }

    // Insert flagship feeds in batches
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < validatedFeeds.length; i += batchSize) {
      const batch = validatedFeeds.slice(i, i + batchSize);
      console.log(`📝 Inserting batch ${Math.floor(i / batchSize) + 1}...`);
      
      const { data, error } = await supabase
        .from('recommended_feeds')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error('❌ Error inserting batch:', error);
        throw error;
      }
      
      totalInserted += data?.length || 0;
    }

    console.log(`✅ Successfully seeded ${totalInserted} flagship feeds`);

    // Verify the data
    const { count: totalCount, error: countError } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.warn('⚠️  Warning during count verification:', countError.message);
    } else {
      console.log(`📊 Total feeds in database: ${totalCount}`);
    }

    // Verify featured count
    const { count: featuredCount, error: featuredError } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('is_featured', true);
    
    if (!featuredError) {
      console.log(`⭐ Featured (flagship) feeds: ${featuredCount}`);
    }

    console.log('🎉 Flagship feeds seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Flagship feeds seeding failed:', error);
    throw error;
  }
}

// Run the seeding
seedFlagshipFeeds()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
