/**
 * Add Major News RSS Feeds to recommended_feeds
 * BBC, Guardian, Washington Post, NPR, LA Times, and more
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

// BBC Feeds
const bbcFeeds: FeedToAdd[] = [
  { name: 'BBC News - Top Stories', url: 'http://feeds.bbci.co.uk/news/rss.xml', site_url: 'https://www.bbc.com/news', description: 'BBC News top stories', icon_url: 'https://www.bbc.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'bbc', 'uk'], popularity_score: 95 },
  { name: 'BBC News - World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', site_url: 'https://www.bbc.com/news/world', description: 'BBC World News', icon_url: 'https://www.bbc.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'bbc', 'world'], popularity_score: 93 },
  { name: 'BBC News - US & Canada', url: 'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', site_url: 'https://www.bbc.com/news/world/us_and_canada', description: 'BBC US and Canada news', icon_url: 'https://www.bbc.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'bbc', 'us'], popularity_score: 90 },
  { name: 'BBC News - UK', url: 'http://feeds.bbci.co.uk/news/uk/rss.xml', site_url: 'https://www.bbc.com/news/uk', description: 'BBC UK news', icon_url: 'https://www.bbc.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'bbc', 'uk'], popularity_score: 88 },
  { name: 'BBC News - Business', url: 'http://feeds.bbci.co.uk/news/business/rss.xml', site_url: 'https://www.bbc.com/news/business', description: 'BBC Business news', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Business', country: 'UK', tags: ['business', 'bbc'], popularity_score: 88 },
];

const bbcFeedsMore: FeedToAdd[] = [
  { name: 'BBC News - Technology', url: 'http://feeds.bbci.co.uk/news/technology/rss.xml', site_url: 'https://www.bbc.com/news/technology', description: 'BBC Technology news', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Technology', country: 'UK', tags: ['tech', 'bbc'], popularity_score: 88 },
  { name: 'BBC News - Science', url: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml', site_url: 'https://www.bbc.com/news/science_and_environment', description: 'BBC Science and Environment', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Science', country: 'UK', tags: ['science', 'bbc'], popularity_score: 85 },
  { name: 'BBC News - Health', url: 'http://feeds.bbci.co.uk/news/health/rss.xml', site_url: 'https://www.bbc.com/news/health', description: 'BBC Health news', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Health', country: 'UK', tags: ['health', 'bbc'], popularity_score: 85 },
  { name: 'BBC News - Entertainment', url: 'http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', site_url: 'https://www.bbc.com/news/entertainment_and_arts', description: 'BBC Entertainment and Arts', icon_url: 'https://www.bbc.com/favicon.ico', category: 'Entertainment', country: 'UK', tags: ['entertainment', 'bbc'], popularity_score: 82 },
  { name: 'BBC News - Europe', url: 'http://feeds.bbci.co.uk/news/world/europe/rss.xml', site_url: 'https://www.bbc.com/news/world/europe', description: 'BBC Europe news', icon_url: 'https://www.bbc.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'bbc', 'europe'], popularity_score: 85 },
  { name: 'BBC News - Asia', url: 'http://feeds.bbci.co.uk/news/world/asia/rss.xml', site_url: 'https://www.bbc.com/news/world/asia', description: 'BBC Asia news', icon_url: 'https://www.bbc.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'bbc', 'asia'], popularity_score: 85 },
];

// The Guardian Feeds
const guardianFeeds: FeedToAdd[] = [
  { name: 'The Guardian - World', url: 'https://www.theguardian.com/world/rss', site_url: 'https://www.theguardian.com/world', description: 'Guardian World news', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'guardian', 'world'], popularity_score: 92 },
  { name: 'The Guardian - US News', url: 'https://www.theguardian.com/us-news/rss', site_url: 'https://www.theguardian.com/us-news', description: 'Guardian US news', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'guardian', 'us'], popularity_score: 90 },
  { name: 'The Guardian - UK News', url: 'https://www.theguardian.com/uk-news/rss', site_url: 'https://www.theguardian.com/uk-news', description: 'Guardian UK news', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'guardian', 'uk'], popularity_score: 88 },
  { name: 'The Guardian - Politics', url: 'https://www.theguardian.com/politics/rss', site_url: 'https://www.theguardian.com/politics', description: 'Guardian Politics', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'News', country: 'UK', tags: ['politics', 'guardian'], popularity_score: 85 },
  { name: 'The Guardian - Business', url: 'https://www.theguardian.com/uk/business/rss', site_url: 'https://www.theguardian.com/uk/business', description: 'Guardian Business news', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'Business', country: 'UK', tags: ['business', 'guardian'], popularity_score: 85 },
  { name: 'The Guardian - Technology', url: 'https://www.theguardian.com/uk/technology/rss', site_url: 'https://www.theguardian.com/uk/technology', description: 'Guardian Technology', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'Technology', country: 'UK', tags: ['tech', 'guardian'], popularity_score: 85 },
  { name: 'The Guardian - Science', url: 'https://www.theguardian.com/science/rss', site_url: 'https://www.theguardian.com/science', description: 'Guardian Science', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'Science', country: 'UK', tags: ['science', 'guardian'], popularity_score: 82 },
  { name: 'The Guardian - Environment', url: 'https://www.theguardian.com/environment/rss', site_url: 'https://www.theguardian.com/environment', description: 'Guardian Environment', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'Environment', country: 'UK', tags: ['environment', 'guardian'], popularity_score: 82 },
  { name: 'The Guardian - Culture', url: 'https://www.theguardian.com/uk/culture/rss', site_url: 'https://www.theguardian.com/uk/culture', description: 'Guardian Culture', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'Entertainment', country: 'UK', tags: ['culture', 'guardian'], popularity_score: 80 },
  { name: 'The Guardian - Sport', url: 'https://www.theguardian.com/uk/sport/rss', site_url: 'https://www.theguardian.com/uk/sport', description: 'Guardian Sport', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'Sports', country: 'UK', tags: ['sports', 'guardian'], popularity_score: 82 },
  { name: 'The Guardian - Opinion', url: 'https://www.theguardian.com/uk/commentisfree/rss', site_url: 'https://www.theguardian.com/uk/commentisfree', description: 'Guardian Opinion', icon_url: 'https://www.theguardian.com/favicon.ico', category: 'News', country: 'UK', tags: ['opinion', 'guardian'], popularity_score: 78 },
];


// NPR Feeds
const nprFeeds: FeedToAdd[] = [
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', site_url: 'https://www.npr.org/sections/news/', description: 'NPR News', icon_url: 'https://www.npr.org/favicon.ico', category: 'News', country: 'US', tags: ['news', 'npr', 'radio'], popularity_score: 90 },
  { name: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml', site_url: 'https://www.npr.org/sections/politics/', description: 'NPR Politics', icon_url: 'https://www.npr.org/favicon.ico', category: 'News', country: 'US', tags: ['politics', 'npr'], popularity_score: 88 },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', site_url: 'https://www.npr.org/sections/world/', description: 'NPR World news', icon_url: 'https://www.npr.org/favicon.ico', category: 'News', country: 'US', tags: ['world', 'npr'], popularity_score: 85 },
  { name: 'NPR Business', url: 'https://feeds.npr.org/1006/rss.xml', site_url: 'https://www.npr.org/sections/business/', description: 'NPR Business', icon_url: 'https://www.npr.org/favicon.ico', category: 'Business', country: 'US', tags: ['business', 'npr'], popularity_score: 82 },
  { name: 'NPR Technology', url: 'https://feeds.npr.org/1019/rss.xml', site_url: 'https://www.npr.org/sections/technology/', description: 'NPR Technology', icon_url: 'https://www.npr.org/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'npr'], popularity_score: 82 },
  { name: 'NPR Science', url: 'https://feeds.npr.org/1007/rss.xml', site_url: 'https://www.npr.org/sections/science/', description: 'NPR Science', icon_url: 'https://www.npr.org/favicon.ico', category: 'Science', country: 'US', tags: ['science', 'npr'], popularity_score: 82 },
  { name: 'NPR Health', url: 'https://feeds.npr.org/1128/rss.xml', site_url: 'https://www.npr.org/sections/health/', description: 'NPR Health', icon_url: 'https://www.npr.org/favicon.ico', category: 'Health', country: 'US', tags: ['health', 'npr'], popularity_score: 80 },
  { name: 'NPR Arts & Life', url: 'https://feeds.npr.org/1008/rss.xml', site_url: 'https://www.npr.org/sections/arts/', description: 'NPR Arts and Life', icon_url: 'https://www.npr.org/favicon.ico', category: 'Entertainment', country: 'US', tags: ['arts', 'npr'], popularity_score: 78 },
  { name: 'NPR Music', url: 'https://feeds.npr.org/1039/rss.xml', site_url: 'https://www.npr.org/music/', description: 'NPR Music', icon_url: 'https://www.npr.org/favicon.ico', category: 'Music', country: 'US', tags: ['music', 'npr'], popularity_score: 78 },
  { name: 'NPR Books', url: 'https://feeds.npr.org/1032/rss.xml', site_url: 'https://www.npr.org/books/', description: 'NPR Books', icon_url: 'https://www.npr.org/favicon.ico', category: 'Entertainment', country: 'US', tags: ['books', 'npr'], popularity_score: 75 },
];

// Washington Post Feeds
const wapoFeeds: FeedToAdd[] = [
  { name: 'Washington Post - National', url: 'http://feeds.washingtonpost.com/rss/national', site_url: 'https://www.washingtonpost.com/national/', description: 'Washington Post National news', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'wapo', 'national'], popularity_score: 92 },
  { name: 'Washington Post - World', url: 'http://feeds.washingtonpost.com/rss/world', site_url: 'https://www.washingtonpost.com/world/', description: 'Washington Post World news', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'wapo', 'world'], popularity_score: 90 },
  { name: 'Washington Post - Politics', url: 'http://feeds.washingtonpost.com/rss/politics', site_url: 'https://www.washingtonpost.com/politics/', description: 'Washington Post Politics', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'News', country: 'US', tags: ['politics', 'wapo'], popularity_score: 92 },
  { name: 'Washington Post - Business', url: 'http://feeds.washingtonpost.com/rss/business', site_url: 'https://www.washingtonpost.com/business/', description: 'Washington Post Business', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'Business', country: 'US', tags: ['business', 'wapo'], popularity_score: 85 },
  { name: 'Washington Post - Technology', url: 'http://feeds.washingtonpost.com/rss/business/technology', site_url: 'https://www.washingtonpost.com/technology/', description: 'Washington Post Technology', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'wapo'], popularity_score: 85 },
  { name: 'Washington Post - Opinions', url: 'http://feeds.washingtonpost.com/rss/opinions', site_url: 'https://www.washingtonpost.com/opinions/', description: 'Washington Post Opinions', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'News', country: 'US', tags: ['opinion', 'wapo'], popularity_score: 82 },
  { name: 'Washington Post - Sports', url: 'http://feeds.washingtonpost.com/rss/sports', site_url: 'https://www.washingtonpost.com/sports/', description: 'Washington Post Sports', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'wapo'], popularity_score: 80 },
  { name: 'Washington Post - Lifestyle', url: 'http://feeds.washingtonpost.com/rss/lifestyle', site_url: 'https://www.washingtonpost.com/lifestyle/', description: 'Washington Post Lifestyle', icon_url: 'https://www.washingtonpost.com/favicon.ico', category: 'Lifestyle', country: 'US', tags: ['lifestyle', 'wapo'], popularity_score: 75 },
];


// LA Times Feeds
const latimesFeeds: FeedToAdd[] = [
  { name: 'LA Times - Top Stories', url: 'https://www.latimes.com/rss2.0.xml', site_url: 'https://www.latimes.com', description: 'LA Times top stories', icon_url: 'https://www.latimes.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'latimes', 'california'], popularity_score: 88 },
  { name: 'LA Times - World & Nation', url: 'https://www.latimes.com/world-nation/rss2.0.xml', site_url: 'https://www.latimes.com/world-nation', description: 'LA Times World and Nation', icon_url: 'https://www.latimes.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'latimes', 'world'], popularity_score: 85 },
  { name: 'LA Times - California', url: 'https://www.latimes.com/california/rss2.0.xml', site_url: 'https://www.latimes.com/california', description: 'LA Times California news', icon_url: 'https://www.latimes.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'latimes', 'california'], popularity_score: 82 },
  { name: 'LA Times - Politics', url: 'https://www.latimes.com/politics/rss2.0.xml', site_url: 'https://www.latimes.com/politics', description: 'LA Times Politics', icon_url: 'https://www.latimes.com/favicon.ico', category: 'News', country: 'US', tags: ['politics', 'latimes'], popularity_score: 82 },
  { name: 'LA Times - Business', url: 'https://www.latimes.com/business/rss2.0.xml', site_url: 'https://www.latimes.com/business', description: 'LA Times Business', icon_url: 'https://www.latimes.com/favicon.ico', category: 'Business', country: 'US', tags: ['business', 'latimes'], popularity_score: 78 },
  { name: 'LA Times - Entertainment', url: 'https://www.latimes.com/entertainment-arts/rss2.0.xml', site_url: 'https://www.latimes.com/entertainment-arts', description: 'LA Times Entertainment', icon_url: 'https://www.latimes.com/favicon.ico', category: 'Entertainment', country: 'US', tags: ['entertainment', 'latimes'], popularity_score: 80 },
  { name: 'LA Times - Sports', url: 'https://www.latimes.com/sports/rss2.0.xml', site_url: 'https://www.latimes.com/sports', description: 'LA Times Sports', icon_url: 'https://www.latimes.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'latimes'], popularity_score: 78 },
  { name: 'LA Times - Science', url: 'https://www.latimes.com/science/rss2.0.xml', site_url: 'https://www.latimes.com/science', description: 'LA Times Science', icon_url: 'https://www.latimes.com/favicon.ico', category: 'Science', country: 'US', tags: ['science', 'latimes'], popularity_score: 75 },
];

// Other Major US News
const otherUSFeeds: FeedToAdd[] = [
  // USA Today
  { name: 'USA Today - Top Stories', url: 'http://rssfeeds.usatoday.com/usatoday-NewsTopStories', site_url: 'https://www.usatoday.com', description: 'USA Today top stories', icon_url: 'https://www.usatoday.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'usatoday'], popularity_score: 85 },
  { name: 'USA Today - Nation', url: 'http://rssfeeds.usatoday.com/UsatodaycomNation-TopStories', site_url: 'https://www.usatoday.com/news/nation/', description: 'USA Today Nation', icon_url: 'https://www.usatoday.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'usatoday'], popularity_score: 82 },
  { name: 'USA Today - World', url: 'http://rssfeeds.usatoday.com/UsatodaycomWorld-TopStories', site_url: 'https://www.usatoday.com/news/world/', description: 'USA Today World', icon_url: 'https://www.usatoday.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'usatoday', 'world'], popularity_score: 80 },
  { name: 'USA Today - Tech', url: 'http://rssfeeds.usatoday.com/usatoday-TechTopStories', site_url: 'https://www.usatoday.com/tech/', description: 'USA Today Tech', icon_url: 'https://www.usatoday.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'usatoday'], popularity_score: 78 },
  { name: 'USA Today - Sports', url: 'http://rssfeeds.usatoday.com/UsatodaycomSports-TopStories', site_url: 'https://www.usatoday.com/sports/', description: 'USA Today Sports', icon_url: 'https://www.usatoday.com/favicon.ico', category: 'Sports', country: 'US', tags: ['sports', 'usatoday'], popularity_score: 80 },
  
  // Chicago Tribune
  { name: 'Chicago Tribune - News', url: 'https://www.chicagotribune.com/arcio/rss/category/news/', site_url: 'https://www.chicagotribune.com/news/', description: 'Chicago Tribune News', icon_url: 'https://www.chicagotribune.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'chicago'], popularity_score: 78 },
  
  // Boston Globe
  { name: 'Boston Globe - Top Stories', url: 'https://www.bostonglobe.com/rss/bigpicture', site_url: 'https://www.bostonglobe.com', description: 'Boston Globe top stories', icon_url: 'https://www.bostonglobe.com/favicon.ico', category: 'News', country: 'US', tags: ['news', 'boston'], popularity_score: 78 },
];


// International News
const internationalFeeds: FeedToAdd[] = [
  // Al Jazeera
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', site_url: 'https://www.aljazeera.com', description: 'Al Jazeera English news', icon_url: 'https://www.aljazeera.com/favicon.ico', category: 'News', country: 'QA', tags: ['news', 'aljazeera', 'middle-east'], popularity_score: 88 },
  
  // Deutsche Welle
  { name: 'DW News', url: 'https://rss.dw.com/rdf/rss-en-all', site_url: 'https://www.dw.com/en/', description: 'Deutsche Welle English news', icon_url: 'https://www.dw.com/favicon.ico', category: 'News', country: 'DE', tags: ['news', 'dw', 'germany'], popularity_score: 82 },
  
  // ABC Australia
  { name: 'ABC News Australia', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', site_url: 'https://www.abc.net.au/news/', description: 'ABC Australia news', icon_url: 'https://www.abc.net.au/favicon.ico', category: 'News', country: 'AU', tags: ['news', 'abc', 'australia'], popularity_score: 82 },
  
  // CBC Canada
  { name: 'CBC News - Top Stories', url: 'https://www.cbc.ca/webfeed/rss/rss-topstories', site_url: 'https://www.cbc.ca/news', description: 'CBC Canada top stories', icon_url: 'https://www.cbc.ca/favicon.ico', category: 'News', country: 'CA', tags: ['news', 'cbc', 'canada'], popularity_score: 85 },
  { name: 'CBC News - World', url: 'https://www.cbc.ca/webfeed/rss/rss-world', site_url: 'https://www.cbc.ca/news/world', description: 'CBC World news', icon_url: 'https://www.cbc.ca/favicon.ico', category: 'News', country: 'CA', tags: ['news', 'cbc', 'world'], popularity_score: 82 },
  { name: 'CBC News - Canada', url: 'https://www.cbc.ca/webfeed/rss/rss-canada', site_url: 'https://www.cbc.ca/news/canada', description: 'CBC Canada news', icon_url: 'https://www.cbc.ca/favicon.ico', category: 'News', country: 'CA', tags: ['news', 'cbc', 'canada'], popularity_score: 82 },
  { name: 'CBC News - Technology', url: 'https://www.cbc.ca/webfeed/rss/rss-technology', site_url: 'https://www.cbc.ca/news/technology', description: 'CBC Technology', icon_url: 'https://www.cbc.ca/favicon.ico', category: 'Technology', country: 'CA', tags: ['tech', 'cbc'], popularity_score: 78 },
  
  // The Independent
  { name: 'The Independent', url: 'https://www.independent.co.uk/rss', site_url: 'https://www.independent.co.uk', description: 'The Independent UK news', icon_url: 'https://www.independent.co.uk/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'independent', 'uk'], popularity_score: 82 },
  
  // Sky News
  { name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/home.xml', site_url: 'https://news.sky.com', description: 'Sky News UK', icon_url: 'https://news.sky.com/favicon.ico', category: 'News', country: 'UK', tags: ['news', 'sky', 'uk'], popularity_score: 82 },
];

// Tech-focused feeds
const techFeeds: FeedToAdd[] = [
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', site_url: 'https://arstechnica.com', description: 'Ars Technica technology news', icon_url: 'https://arstechnica.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'arstechnica'], popularity_score: 88 },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', site_url: 'https://www.theverge.com', description: 'The Verge tech news', icon_url: 'https://www.theverge.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'verge'], popularity_score: 90 },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', site_url: 'https://techcrunch.com', description: 'TechCrunch startup and tech news', icon_url: 'https://techcrunch.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'startups', 'techcrunch'], popularity_score: 90 },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', site_url: 'https://www.wired.com', description: 'Wired magazine tech and culture', icon_url: 'https://www.wired.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'wired', 'culture'], popularity_score: 88 },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', site_url: 'https://www.engadget.com', description: 'Engadget gadgets and tech', icon_url: 'https://www.engadget.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'gadgets', 'engadget'], popularity_score: 85 },
  { name: 'CNET', url: 'https://www.cnet.com/rss/news/', site_url: 'https://www.cnet.com', description: 'CNET tech news and reviews', icon_url: 'https://www.cnet.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'reviews', 'cnet'], popularity_score: 85 },
  { name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml', site_url: 'https://www.zdnet.com', description: 'ZDNet enterprise tech news', icon_url: 'https://www.zdnet.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'enterprise', 'zdnet'], popularity_score: 82 },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', site_url: 'https://www.technologyreview.com', description: 'MIT Technology Review', icon_url: 'https://www.technologyreview.com/favicon.ico', category: 'Technology', country: 'US', tags: ['tech', 'mit', 'research'], popularity_score: 88 },
];

// Combine all feeds
const allFeeds: FeedToAdd[] = [
  ...bbcFeeds,
  ...bbcFeedsMore,
  ...guardianFeeds,
  ...nprFeeds,
  ...wapoFeeds,
  ...latimesFeeds,
  ...otherUSFeeds,
  ...internationalFeeds,
  ...techFeeds,
];


async function main() {
  console.log('📰 Adding Major News RSS Feeds');
  console.log('==============================\n');

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

  console.log('\n==============================');
  console.log(`📊 Summary: ${added} added, ${skipped} skipped`);

  // Get final count
  const { count } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });

  console.log(`📰 Total recommended feeds: ${count}`);
}

main().catch(console.error);
