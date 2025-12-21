#!/usr/bin/env tsx

/**
 * Comprehensive RSS Feed Seeding Script
 * Seeds 500+ real RSS feeds across all 28 categories
 * Includes section-specific feeds from major outlets
 */

import { createClient } from '@supabase/supabase-js';

// Get credentials from environment or command line
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FeedData {
  name: string;
  url: string;
  site_url: string;
  description: string;
  popularity_score: number;
  is_featured: boolean;
}

// Comprehensive real RSS feeds organized by category (28 categories, ~18-20 feeds each = 500+ feeds)
const feedsByCategory: Record<string, FeedData[]> = {
  Technology: [
    // Major Tech News
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', site_url: 'https://techcrunch.com', description: 'The latest technology news and information on startups', popularity_score: 95, is_featured: true },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', site_url: 'https://www.theverge.com', description: 'Technology, science, art, and culture', popularity_score: 93, is_featured: true },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', site_url: 'https://arstechnica.com', description: 'Technology news and analysis', popularity_score: 90, is_featured: true },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss', site_url: 'https://www.wired.com', description: 'Ideas, breakthroughs, and the future', popularity_score: 92, is_featured: true },
    { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', site_url: 'https://www.engadget.com', description: 'Technology news and reviews', popularity_score: 88, is_featured: true },
    { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', site_url: 'https://www.technologyreview.com', description: 'Emerging technologies and their impact', popularity_score: 89, is_featured: true },
    { name: 'CNET', url: 'https://www.cnet.com/rss/news/', site_url: 'https://www.cnet.com', description: 'Tech product reviews, news, and how-tos', popularity_score: 87, is_featured: false },
    { name: 'Gizmodo', url: 'https://gizmodo.com/rss', site_url: 'https://gizmodo.com', description: 'Design, technology, science and science fiction', popularity_score: 85, is_featured: false },
    { name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml', site_url: 'https://www.zdnet.com', description: 'Technology news for IT professionals', popularity_score: 84, is_featured: false },
    { name: 'TechRadar', url: 'https://www.techradar.com/rss', site_url: 'https://www.techradar.com', description: 'Tech news and reviews', popularity_score: 83, is_featured: false },
    // NYT Technology Section
    { name: 'NYT Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', site_url: 'https://www.nytimes.com/section/technology', description: 'New York Times technology coverage', popularity_score: 91, is_featured: true },
    // BBC Technology
    { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', site_url: 'https://www.bbc.com/news/technology', description: 'BBC technology news', popularity_score: 90, is_featured: false },
    // Guardian Technology
    { name: 'The Guardian Tech', url: 'https://www.theguardian.com/technology/rss', site_url: 'https://www.theguardian.com/technology', description: 'Guardian technology coverage', popularity_score: 88, is_featured: false },
    // Additional Tech Sources
    { name: 'Mashable Tech', url: 'https://mashable.com/feeds/rss/tech', site_url: 'https://mashable.com/tech', description: 'Tech news and digital culture', popularity_score: 82, is_featured: false },
    { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', site_url: 'https://venturebeat.com', description: 'Transformative tech coverage', popularity_score: 86, is_featured: false },
    { name: 'The Next Web', url: 'https://thenextweb.com/feed/', site_url: 'https://thenextweb.com', description: 'Tech news and insights', popularity_score: 84, is_featured: false },
    { name: 'Recode', url: 'https://www.vox.com/rss/recode/index.xml', site_url: 'https://www.vox.com/recode', description: 'Tech and business news', popularity_score: 85, is_featured: false },
    { name: 'Protocol', url: 'https://www.protocol.com/feeds/feed.rss', site_url: 'https://www.protocol.com', description: 'Tech industry coverage', popularity_score: 83, is_featured: false },
  ],
  News: [
    // Major News Outlets
    { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', site_url: 'https://www.bbc.com/news', description: 'Breaking news from the BBC', popularity_score: 98, is_featured: true },
    { name: 'Reuters', url: 'https://www.reutersagency.com/feed/', site_url: 'https://www.reuters.com', description: 'Breaking international news', popularity_score: 97, is_featured: true },
    { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', site_url: 'https://www.npr.org', description: 'National Public Radio news', popularity_score: 94, is_featured: true },
    { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss', site_url: 'https://www.theguardian.com', description: 'World news from The Guardian', popularity_score: 93, is_featured: true },
    { name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', site_url: 'https://www.nytimes.com', description: 'All the news that fits', popularity_score: 95, is_featured: true },
    { name: 'Washington Post World', url: 'https://feeds.washingtonpost.com/rss/world', site_url: 'https://www.washingtonpost.com', description: 'Democracy dies in darkness', popularity_score: 92, is_featured: true },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', site_url: 'https://www.aljazeera.com', description: 'International news coverage', popularity_score: 89, is_featured: false },
    { name: 'CNN', url: 'http://rss.cnn.com/rss/edition.rss', site_url: 'https://www.cnn.com', description: 'Breaking news and analysis', popularity_score: 91, is_featured: false },
    { name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/', site_url: 'https://www.theatlantic.com', description: 'News and analysis', popularity_score: 87, is_featured: false },
    { name: 'Axios', url: 'https://api.axios.com/feed/', site_url: 'https://www.axios.com', description: 'Smart brevity news', popularity_score: 85, is_featured: false },
    // NYT Sections
    { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', site_url: 'https://www.nytimes.com/section/world', description: 'NYT world news', popularity_score: 93, is_featured: false },
    { name: 'NYT US', url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml', site_url: 'https://www.nytimes.com/section/us', description: 'NYT US news', popularity_score: 92, is_featured: false },
    // BBC Sections
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', site_url: 'https://www.bbc.com/news/world', description: 'BBC world news', popularity_score: 94, is_featured: false },
    { name: 'BBC UK', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', site_url: 'https://www.bbc.com/news/uk', description: 'BBC UK news', popularity_score: 90, is_featured: false },
    // Additional News
    { name: 'Associated Press', url: 'https://rsshub.app/apnews/topics/apf-topnews', site_url: 'https://apnews.com', description: 'AP top news', popularity_score: 94, is_featured: false },
    { name: 'The Economist', url: 'https://www.economist.com/rss', site_url: 'https://www.economist.com', description: 'Global news and analysis', popularity_score: 91, is_featured: false },
    { name: 'Politico', url: 'https://www.politico.com/rss/politicopicks.xml', site_url: 'https://www.politico.com', description: 'Political news', popularity_score: 88, is_featured: false },
    { name: 'The Hill', url: 'https://thehill.com/feed/', site_url: 'https://thehill.com', description: 'Political news', popularity_score: 86, is_featured: false },
  ],
  Business: [
    { name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', site_url: 'https://www.wsj.com', description: 'Business and financial news', popularity_score: 96, is_featured: true },
    { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', site_url: 'https://www.bloomberg.com', description: 'Financial markets news', popularity_score: 95, is_featured: true },
    { name: 'Financial Times', url: 'https://www.ft.com/rss/home', site_url: 'https://www.ft.com', description: 'International business news', popularity_score: 94, is_featured: true },
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', site_url: 'https://www.cnbc.com', description: 'Business news and market data', popularity_score: 92, is_featured: true },
    { name: 'Forbes', url: 'https://www.forbes.com/real-time/feed2/', site_url: 'https://www.forbes.com', description: 'Business news and analysis', popularity_score: 91, is_featured: true },
    { name: 'Harvard Business Review', url: 'https://hbr.org/feed', site_url: 'https://hbr.org', description: 'Management insights', popularity_score: 90, is_featured: true },
    { name: 'Business Insider', url: 'https://www.businessinsider.com/rss', site_url: 'https://www.businessinsider.com', description: 'Business news and trends', popularity_score: 89, is_featured: false },
    { name: 'Fortune', url: 'https://fortune.com/feed/', site_url: 'https://fortune.com', description: 'Business news and analysis', popularity_score: 88, is_featured: false },
    { name: 'Inc.', url: 'https://www.inc.com/rss/', site_url: 'https://www.inc.com', description: 'Small business and startups', popularity_score: 85, is_featured: false },
    { name: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', site_url: 'https://www.entrepreneur.com', description: 'Entrepreneurship news', popularity_score: 84, is_featured: false },
    // NYT Business
    { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', site_url: 'https://www.nytimes.com/section/business', description: 'NYT business coverage', popularity_score: 92, is_featured: false },
    // BBC Business
    { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', site_url: 'https://www.bbc.com/news/business', description: 'BBC business news', popularity_score: 90, is_featured: false },
    // Guardian Business
    { name: 'Guardian Business', url: 'https://www.theguardian.com/business/rss', site_url: 'https://www.theguardian.com/business', description: 'Guardian business coverage', popularity_score: 88, is_featured: false },
    // Additional Business
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', site_url: 'https://www.marketwatch.com', description: 'Market news and data', popularity_score: 89, is_featured: false },
    { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml', site_url: 'https://seekingalpha.com', description: 'Investment analysis', popularity_score: 86, is_featured: false },
    { name: 'Quartz', url: 'https://qz.com/feed/', site_url: 'https://qz.com', description: 'Global business news', popularity_score: 85, is_featured: false },
    { name: 'Fast Company', url: 'https://www.fastcompany.com/latest/rss', site_url: 'https://www.fastcompany.com', description: 'Business innovation', popularity_score: 87, is_featured: false },
    { name: 'The Motley Fool', url: 'https://www.fool.com/feeds/index.aspx', site_url: 'https://www.fool.com', description: 'Investment advice', popularity_score: 84, is_featured: false },
  ],
  Science: [
    { name: 'Nature', url: 'https://www.nature.com/nature.rss', site_url: 'https://www.nature.com', description: 'International journal of science', popularity_score: 95, is_featured: true },
    { name: 'Science Magazine', url: 'https://www.science.org/rss/news_current.xml', site_url: 'https://www.science.org', description: 'AAAS science news', popularity_score: 94, is_featured: true },
    { name: 'Scientific American', url: 'https://rss.sciam.com/ScientificAmerican-Global', site_url: 'https://www.scientificamerican.com', description: 'Science news and discoveries', popularity_score: 92, is_featured: true },
    { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', site_url: 'https://www.newscientist.com', description: 'Science and technology news', popularity_score: 90, is_featured: true },
    { name: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/', site_url: 'https://www.quantamagazine.org', description: 'Mathematics and science', popularity_score: 91, is_featured: true },
    { name: 'Phys.org', url: 'https://phys.org/rss-feed/', site_url: 'https://phys.org', description: 'Science and technology news', popularity_score: 88, is_featured: false },
    { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', site_url: 'https://www.sciencedaily.com', description: 'Breaking science news', popularity_score: 87, is_featured: false },
    { name: 'Live Science', url: 'https://www.livescience.com/feeds/all', site_url: 'https://www.livescience.com', description: 'Science news and features', popularity_score: 85, is_featured: false },
    { name: 'Discover Magazine', url: 'https://www.discovermagazine.com/rss/all', site_url: 'https://www.discovermagazine.com', description: 'Science for curious minds', popularity_score: 84, is_featured: false },
    { name: 'Popular Science', url: 'https://www.popsci.com/feed/', site_url: 'https://www.popsci.com', description: 'Science and technology', popularity_score: 83, is_featured: false },
    // NYT Science
    { name: 'NYT Science', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', site_url: 'https://www.nytimes.com/section/science', description: 'NYT science coverage', popularity_score: 91, is_featured: false },
    // BBC Science
    { name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', site_url: 'https://www.bbc.com/news/science_and_environment', description: 'BBC science news', popularity_score: 89, is_featured: false },
    // Guardian Science
    { name: 'Guardian Science', url: 'https://www.theguardian.com/science/rss', site_url: 'https://www.theguardian.com/science', description: 'Guardian science coverage', popularity_score: 87, is_featured: false },
    // Additional Science
    { name: 'Ars Technica Science', url: 'https://feeds.arstechnica.com/arstechnica/science', site_url: 'https://arstechnica.com/science', description: 'Ars Technica science', popularity_score: 86, is_featured: false },
    { name: 'IFLScience', url: 'https://www.iflscience.com/feed', site_url: 'https://www.iflscience.com', description: 'Science news', popularity_score: 82, is_featured: false },
    { name: 'Nautilus', url: 'https://nautil.us/feed/', site_url: 'https://nautil.us', description: 'Science connected', popularity_score: 85, is_featured: false },
    { name: 'Smithsonian Science', url: 'https://www.smithsonianmag.com/rss/science-nature/', site_url: 'https://www.smithsonianmag.com/science-nature', description: 'Smithsonian science', popularity_score: 88, is_featured: false },
    { name: 'PLOS ONE', url: 'https://journals.plos.org/plosone/feed/atom', site_url: 'https://journals.plos.org/plosone', description: 'Open access research', popularity_score: 84, is_featured: false },
  ],

  Sports: [
    { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', site_url: 'https://www.espn.com', description: 'Sports news and analysis', popularity_score: 96, is_featured: true },
    { name: 'Bleacher Report', url: 'https://bleacherreport.com/articles/feed', site_url: 'https://bleacherreport.com', description: 'Sports news and highlights', popularity_score: 92, is_featured: true },
    { name: 'Sports Illustrated', url: 'https://www.si.com/rss/si_topstories.rss', site_url: 'https://www.si.com', description: 'Sports journalism', popularity_score: 91, is_featured: true },
    { name: 'The Athletic', url: 'https://theathletic.com/feed/', site_url: 'https://theathletic.com', description: 'In-depth sports journalism', popularity_score: 90, is_featured: true },
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', site_url: 'https://www.bbc.com/sport', description: 'UK sports news', popularity_score: 90, is_featured: true },
    { name: 'Yahoo Sports', url: 'https://sports.yahoo.com/rss/', site_url: 'https://sports.yahoo.com', description: 'Sports news and scores', popularity_score: 89, is_featured: false },
    { name: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines/', site_url: 'https://www.cbssports.com', description: 'Sports coverage', popularity_score: 88, is_featured: false },
    { name: 'SB Nation', url: 'https://www.sbnation.com/rss/current', site_url: 'https://www.sbnation.com', description: 'Fan-powered sports', popularity_score: 85, is_featured: false },
    { name: 'Deadspin', url: 'https://deadspin.com/rss', site_url: 'https://deadspin.com', description: 'Sports and culture', popularity_score: 82, is_featured: false },
    { name: 'The Guardian Sport', url: 'https://www.theguardian.com/sport/rss', site_url: 'https://www.theguardian.com/sport', description: 'Sports journalism', popularity_score: 87, is_featured: false },
    // NYT Sports
    { name: 'NYT Sports', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml', site_url: 'https://www.nytimes.com/section/sports', description: 'NYT sports coverage', popularity_score: 89, is_featured: false },
    // ESPN Sections
    { name: 'ESPN NFL', url: 'https://www.espn.com/espn/rss/nfl/news', site_url: 'https://www.espn.com/nfl', description: 'NFL news', popularity_score: 91, is_featured: false },
    { name: 'ESPN NBA', url: 'https://www.espn.com/espn/rss/nba/news', site_url: 'https://www.espn.com/nba', description: 'NBA news', popularity_score: 90, is_featured: false },
    { name: 'ESPN MLB', url: 'https://www.espn.com/espn/rss/mlb/news', site_url: 'https://www.espn.com/mlb', description: 'MLB news', popularity_score: 88, is_featured: false },
    // Additional Sports
    { name: 'The Ringer', url: 'https://www.theringer.com/rss/index.xml', site_url: 'https://www.theringer.com', description: 'Sports and pop culture', popularity_score: 86, is_featured: false },
    { name: 'FiveThirtyEight Sports', url: 'https://fivethirtyeight.com/sports/feed/', site_url: 'https://fivethirtyeight.com/sports', description: 'Sports analytics', popularity_score: 85, is_featured: false },
    { name: 'NBC Sports', url: 'https://www.nbcsports.com/rss', site_url: 'https://www.nbcsports.com', description: 'NBC sports coverage', popularity_score: 87, is_featured: false },
    { name: 'Fox Sports', url: 'https://api.foxsports.com/v1/rss', site_url: 'https://www.foxsports.com', description: 'Fox sports news', popularity_score: 86, is_featured: false },
  ],
  Gaming: [
    { name: 'IGN', url: 'https://feeds.ign.com/ign/games-all', site_url: 'https://www.ign.com', description: 'Video game news and reviews', popularity_score: 95, is_featured: true },
    { name: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/', site_url: 'https://www.gamespot.com', description: 'Gaming news and reviews', popularity_score: 93, is_featured: true },
    { name: 'Kotaku', url: 'https://kotaku.com/rss', site_url: 'https://kotaku.com', description: 'Gaming culture and news', popularity_score: 91, is_featured: true },
    { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', site_url: 'https://www.polygon.com', description: 'Gaming and entertainment', popularity_score: 90, is_featured: true },
    { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/', site_url: 'https://www.pcgamer.com', description: 'PC gaming news', popularity_score: 89, is_featured: true },
    { name: 'Eurogamer', url: 'https://www.eurogamer.net/feed', site_url: 'https://www.eurogamer.net', description: 'European gaming news', popularity_score: 88, is_featured: false },
    { name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed', site_url: 'https://www.rockpapershotgun.com', description: 'PC gaming coverage', popularity_score: 86, is_featured: false },
    { name: 'Nintendo Life', url: 'https://www.nintendolife.com/feeds/latest', site_url: 'https://www.nintendolife.com', description: 'Nintendo news', popularity_score: 82, is_featured: false },
    { name: 'GamesRadar+', url: 'https://www.gamesradar.com/rss/', site_url: 'https://www.gamesradar.com', description: 'Gaming coverage', popularity_score: 85, is_featured: false },
    { name: 'Destructoid', url: 'https://www.destructoid.com/feed/', site_url: 'https://www.destructoid.com', description: 'Gaming news and reviews', popularity_score: 84, is_featured: false },
    // Additional Gaming
    { name: 'VG247', url: 'https://www.vg247.com/feed/', site_url: 'https://www.vg247.com', description: 'Video game news', popularity_score: 83, is_featured: false },
    { name: 'Push Square', url: 'https://www.pushsquare.com/feeds/latest', site_url: 'https://www.pushsquare.com', description: 'PlayStation news', popularity_score: 81, is_featured: false },
    { name: 'Pure Xbox', url: 'https://www.purexbox.com/feeds/latest', site_url: 'https://www.purexbox.com', description: 'Xbox news', popularity_score: 80, is_featured: false },
    { name: 'Siliconera', url: 'https://www.siliconera.com/feed/', site_url: 'https://www.siliconera.com', description: 'Japanese gaming', popularity_score: 79, is_featured: false },
    { name: 'TouchArcade', url: 'https://toucharcade.com/feed/', site_url: 'https://toucharcade.com', description: 'Mobile gaming', popularity_score: 78, is_featured: false },
    { name: 'Giant Bomb', url: 'https://www.giantbomb.com/feeds/reviews/', site_url: 'https://www.giantbomb.com', description: 'Game reviews', popularity_score: 84, is_featured: false },
    { name: 'Gamasutra', url: 'https://www.gamedeveloper.com/rss.xml', site_url: 'https://www.gamedeveloper.com', description: 'Game development', popularity_score: 82, is_featured: false },
    { name: 'PC Games N', url: 'https://www.pcgamesn.com/feed', site_url: 'https://www.pcgamesn.com', description: 'PC gaming news', popularity_score: 81, is_featured: false },
  ],
  Entertainment: [
    { name: 'Entertainment Weekly', url: 'https://ew.com/feed/', site_url: 'https://ew.com', description: 'Entertainment news', popularity_score: 92, is_featured: true },
    { name: 'Variety', url: 'https://variety.com/feed/', site_url: 'https://variety.com', description: 'Entertainment industry news', popularity_score: 94, is_featured: true },
    { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', site_url: 'https://www.hollywoodreporter.com', description: 'Hollywood news', popularity_score: 93, is_featured: true },
    { name: 'Deadline', url: 'https://deadline.com/feed/', site_url: 'https://deadline.com', description: 'Entertainment breaking news', popularity_score: 91, is_featured: true },
    { name: 'Vulture', url: 'https://www.vulture.com/feed/rss/index.xml', site_url: 'https://www.vulture.com', description: 'Entertainment and culture', popularity_score: 89, is_featured: true },
    { name: 'IndieWire', url: 'https://www.indiewire.com/feed/', site_url: 'https://www.indiewire.com', description: 'Independent film news', popularity_score: 88, is_featured: false },
    { name: 'Screen Rant', url: 'https://screenrant.com/feed/', site_url: 'https://screenrant.com', description: 'Movies and TV news', popularity_score: 86, is_featured: false },
    { name: 'Collider', url: 'https://collider.com/feed/', site_url: 'https://collider.com', description: 'Movie and TV coverage', popularity_score: 85, is_featured: false },
    { name: 'The A.V. Club', url: 'https://www.avclub.com/rss', site_url: 'https://www.avclub.com', description: 'Pop culture coverage', popularity_score: 87, is_featured: false },
    { name: 'Rotten Tomatoes', url: 'https://editorial.rottentomatoes.com/feed/', site_url: 'https://www.rottentomatoes.com', description: 'Movie reviews', popularity_score: 90, is_featured: false },
    // NYT Arts
    { name: 'NYT Arts', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', site_url: 'https://www.nytimes.com/section/arts', description: 'NYT arts coverage', popularity_score: 89, is_featured: false },
    // BBC Entertainment
    { name: 'BBC Entertainment', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', site_url: 'https://www.bbc.com/news/entertainment_and_arts', description: 'BBC entertainment', popularity_score: 88, is_featured: false },
    // Additional Entertainment
    { name: 'Slash Film', url: 'https://www.slashfilm.com/feed/', site_url: 'https://www.slashfilm.com', description: 'Film news', popularity_score: 84, is_featured: false },
    { name: 'Cinema Blend', url: 'https://www.cinemablend.com/rss/topic/news/all', site_url: 'https://www.cinemablend.com', description: 'Movie news', popularity_score: 83, is_featured: false },
    { name: 'Den of Geek', url: 'https://www.denofgeek.com/feed/', site_url: 'https://www.denofgeek.com', description: 'Geek culture', popularity_score: 82, is_featured: false },
    { name: 'io9', url: 'https://io9.gizmodo.com/rss', site_url: 'https://io9.gizmodo.com', description: 'Sci-fi and fantasy', popularity_score: 85, is_featured: false },
    { name: 'The Wrap', url: 'https://www.thewrap.com/feed/', site_url: 'https://www.thewrap.com', description: 'Entertainment news', popularity_score: 86, is_featured: false },
    { name: 'ComicBook.com', url: 'https://comicbook.com/feed/', site_url: 'https://comicbook.com', description: 'Comics and pop culture', popularity_score: 81, is_featured: false },
  ],
  Programming: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', site_url: 'https://news.ycombinator.com', description: 'Tech and startup news', popularity_score: 96, is_featured: true },
    { name: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/', site_url: 'https://stackoverflow.blog', description: 'Developer community news', popularity_score: 93, is_featured: true },
    { name: 'Dev.to', url: 'https://dev.to/feed', site_url: 'https://dev.to', description: 'Developer community', popularity_score: 91, is_featured: true },
    { name: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', site_url: 'https://css-tricks.com', description: 'Web development tips', popularity_score: 89, is_featured: true },
    { name: 'freeCodeCamp', url: 'https://www.freecodecamp.org/news/rss/', site_url: 'https://www.freecodecamp.org', description: 'Learn to code', popularity_score: 90, is_featured: true },
    { name: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom', site_url: 'https://martinfowler.com', description: 'Software architecture', popularity_score: 90, is_featured: false },
    { name: 'The Pragmatic Engineer', url: 'https://blog.pragmaticengineer.com/rss/', site_url: 'https://blog.pragmaticengineer.com', description: 'Software engineering', popularity_score: 89, is_featured: false },
    { name: 'InfoQ', url: 'https://www.infoq.com/feed/', site_url: 'https://www.infoq.com', description: 'Software development news', popularity_score: 88, is_featured: false },
    { name: 'GitHub Blog', url: 'https://github.blog/feed/', site_url: 'https://github.blog', description: 'GitHub news', popularity_score: 89, is_featured: false },
    { name: 'Coding Horror', url: 'https://blog.codinghorror.com/rss/', site_url: 'https://blog.codinghorror.com', description: 'Programming insights', popularity_score: 86, is_featured: false },
    // Additional Programming
    { name: 'Lobsters', url: 'https://lobste.rs/rss', site_url: 'https://lobste.rs', description: 'Computing-focused links', popularity_score: 85, is_featured: false },
    { name: 'JavaScript Weekly', url: 'https://javascriptweekly.com/rss/', site_url: 'https://javascriptweekly.com', description: 'JS newsletter', popularity_score: 87, is_featured: false },
    { name: 'Python Weekly', url: 'https://www.pythonweekly.com/rss/', site_url: 'https://www.pythonweekly.com', description: 'Python newsletter', popularity_score: 86, is_featured: false },
    { name: 'Go Blog', url: 'https://go.dev/blog/feed.atom', site_url: 'https://go.dev/blog', description: 'Go language blog', popularity_score: 84, is_featured: false },
    { name: 'Rust Blog', url: 'https://blog.rust-lang.org/feed.xml', site_url: 'https://blog.rust-lang.org', description: 'Rust language blog', popularity_score: 85, is_featured: false },
    { name: 'React Blog', url: 'https://react.dev/rss.xml', site_url: 'https://react.dev/blog', description: 'React framework blog', popularity_score: 88, is_featured: false },
    { name: 'Smashing Magazine Dev', url: 'https://www.smashingmagazine.com/feed/', site_url: 'https://www.smashingmagazine.com', description: 'Web development', popularity_score: 87, is_featured: false },
    { name: 'A List Apart', url: 'https://alistapart.com/main/feed/', site_url: 'https://alistapart.com', description: 'Web standards', popularity_score: 86, is_featured: false },
  ],

  Design: [
    { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', site_url: 'https://www.smashingmagazine.com', description: 'Web design and development', popularity_score: 94, is_featured: true },
    { name: 'A List Apart', url: 'https://alistapart.com/main/feed/', site_url: 'https://alistapart.com', description: 'Web design articles', popularity_score: 91, is_featured: true },
    { name: 'Creative Bloq', url: 'https://www.creativebloq.com/feed', site_url: 'https://www.creativebloq.com', description: 'Design inspiration', popularity_score: 89, is_featured: true },
    { name: 'UX Collective', url: 'https://uxdesign.cc/feed', site_url: 'https://uxdesign.cc', description: 'UX design articles', popularity_score: 88, is_featured: true },
    { name: 'Nielsen Norman Group', url: 'https://www.nngroup.com/feed/rss/', site_url: 'https://www.nngroup.com', description: 'UX research', popularity_score: 92, is_featured: true },
    { name: 'Dribbble Blog', url: 'https://dribbble.com/stories.rss', site_url: 'https://dribbble.com', description: 'Design community', popularity_score: 90, is_featured: false },
    { name: 'Figma Blog', url: 'https://www.figma.com/blog/feed/', site_url: 'https://www.figma.com/blog', description: 'Figma news', popularity_score: 87, is_featured: false },
    { name: 'Designmodo', url: 'https://designmodo.com/feed/', site_url: 'https://designmodo.com', description: 'Web design resources', popularity_score: 86, is_featured: false },
    { name: 'Awwwards Blog', url: 'https://www.awwwards.com/blog/feed/', site_url: 'https://www.awwwards.com', description: 'Web design awards', popularity_score: 86, is_featured: false },
    { name: 'Core77', url: 'https://www.core77.com/rss', site_url: 'https://www.core77.com', description: 'Industrial design', popularity_score: 82, is_featured: false },
    // Additional Design
    { name: 'Codrops', url: 'https://tympanus.net/codrops/feed/', site_url: 'https://tympanus.net/codrops', description: 'Web design tutorials', popularity_score: 85, is_featured: false },
    { name: 'Sidebar', url: 'https://sidebar.io/feed.xml', site_url: 'https://sidebar.io', description: 'Design links', popularity_score: 84, is_featured: false },
    { name: 'UX Planet', url: 'https://uxplanet.org/feed', site_url: 'https://uxplanet.org', description: 'UX design', popularity_score: 83, is_featured: false },
    { name: 'Muzli', url: 'https://medium.com/feed/muzli-design-inspiration', site_url: 'https://medium.com/muzli-design-inspiration', description: 'Design inspiration', popularity_score: 82, is_featured: false },
    { name: 'Design Shack', url: 'https://designshack.net/feed/', site_url: 'https://designshack.net', description: 'Design articles', popularity_score: 81, is_featured: false },
    { name: 'Webdesigner Depot', url: 'https://www.webdesignerdepot.com/feed/', site_url: 'https://www.webdesignerdepot.com', description: 'Web design news', popularity_score: 80, is_featured: false },
    { name: 'Speckyboy', url: 'https://speckyboy.com/feed/', site_url: 'https://speckyboy.com', description: 'Design magazine', popularity_score: 79, is_featured: false },
    { name: 'It\'s Nice That', url: 'https://www.itsnicethat.com/rss', site_url: 'https://www.itsnicethat.com', description: 'Creative inspiration', popularity_score: 84, is_featured: false },
  ],
  Space: [
    { name: 'NASA News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', site_url: 'https://www.nasa.gov', description: 'NASA news and updates', popularity_score: 96, is_featured: true },
    { name: 'Space.com', url: 'https://www.space.com/feeds/all', site_url: 'https://www.space.com', description: 'Space news and exploration', popularity_score: 94, is_featured: true },
    { name: 'SpaceNews', url: 'https://spacenews.com/feed/', site_url: 'https://spacenews.com', description: 'Space industry news', popularity_score: 91, is_featured: true },
    { name: 'ESA News', url: 'https://www.esa.int/rssfeed/Our_Activities/Space_News', site_url: 'https://www.esa.int', description: 'European Space Agency', popularity_score: 90, is_featured: true },
    { name: 'SpaceX News', url: 'https://www.spacex.com/news.xml', site_url: 'https://www.spacex.com', description: 'SpaceX updates', popularity_score: 92, is_featured: true },
    { name: 'Universe Today', url: 'https://www.universetoday.com/feed/', site_url: 'https://www.universetoday.com', description: 'Space and astronomy', popularity_score: 88, is_featured: false },
    { name: 'Sky & Telescope', url: 'https://skyandtelescope.org/feed/', site_url: 'https://skyandtelescope.org', description: 'Astronomy news', popularity_score: 87, is_featured: false },
    { name: 'Spaceflight Now', url: 'https://spaceflightnow.com/feed/', site_url: 'https://spaceflightnow.com', description: 'Launch coverage', popularity_score: 88, is_featured: false },
    { name: 'Planetary Society', url: 'https://www.planetary.org/feed', site_url: 'https://www.planetary.org', description: 'Space exploration', popularity_score: 85, is_featured: false },
    { name: 'Astronomy Picture of the Day', url: 'https://apod.nasa.gov/apod.rss', site_url: 'https://apod.nasa.gov', description: 'Daily astronomy images', popularity_score: 88, is_featured: false },
    // Additional Space
    { name: 'Ars Technica Space', url: 'https://feeds.arstechnica.com/arstechnica/space', site_url: 'https://arstechnica.com/space', description: 'Ars space coverage', popularity_score: 86, is_featured: false },
    { name: 'NASA JPL', url: 'https://www.jpl.nasa.gov/feeds/news', site_url: 'https://www.jpl.nasa.gov', description: 'JPL news', popularity_score: 89, is_featured: false },
    { name: 'Astronomy Magazine', url: 'https://astronomy.com/rss/news', site_url: 'https://astronomy.com', description: 'Astronomy news', popularity_score: 84, is_featured: false },
    { name: 'Bad Astronomy', url: 'https://www.syfy.com/tags/bad-astronomy/feed', site_url: 'https://www.syfy.com/tags/bad-astronomy', description: 'Phil Plait astronomy', popularity_score: 83, is_featured: false },
    { name: 'Centauri Dreams', url: 'https://www.centauri-dreams.org/feed/', site_url: 'https://www.centauri-dreams.org', description: 'Deep space exploration', popularity_score: 80, is_featured: false },
    { name: 'The Space Review', url: 'https://www.thespacereview.com/rss.xml', site_url: 'https://www.thespacereview.com', description: 'Space policy', popularity_score: 81, is_featured: false },
    { name: 'Rocket Lab', url: 'https://www.rocketlabusa.com/updates/feed/', site_url: 'https://www.rocketlabusa.com', description: 'Rocket Lab news', popularity_score: 82, is_featured: false },
    { name: 'Blue Origin', url: 'https://www.blueorigin.com/news/feed', site_url: 'https://www.blueorigin.com', description: 'Blue Origin news', popularity_score: 83, is_featured: false },
  ],
  Music: [
    { name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/', site_url: 'https://www.rollingstone.com', description: 'Music news and culture', popularity_score: 95, is_featured: true },
    { name: 'Pitchfork', url: 'https://pitchfork.com/feed/feed-news/rss', site_url: 'https://pitchfork.com', description: 'Music reviews and news', popularity_score: 93, is_featured: true },
    { name: 'NME', url: 'https://www.nme.com/feed', site_url: 'https://www.nme.com', description: 'Music and entertainment', popularity_score: 90, is_featured: true },
    { name: 'Billboard', url: 'https://www.billboard.com/feed/', site_url: 'https://www.billboard.com', description: 'Music charts and news', popularity_score: 92, is_featured: true },
    { name: 'Stereogum', url: 'https://www.stereogum.com/feed/', site_url: 'https://www.stereogum.com', description: 'Indie music news', popularity_score: 88, is_featured: true },
    { name: 'Consequence', url: 'https://consequence.net/feed/', site_url: 'https://consequence.net', description: 'Music and film', popularity_score: 86, is_featured: false },
    { name: 'Spin', url: 'https://www.spin.com/feed/', site_url: 'https://www.spin.com', description: 'Music magazine', popularity_score: 85, is_featured: false },
    { name: 'The Line of Best Fit', url: 'https://www.thelineofbestfit.com/feed', site_url: 'https://www.thelineofbestfit.com', description: 'New music discovery', popularity_score: 84, is_featured: false },
    { name: 'Brooklyn Vegan', url: 'https://www.brooklynvegan.com/feed/', site_url: 'https://www.brooklynvegan.com', description: 'Music and concerts', popularity_score: 83, is_featured: false },
    { name: 'Resident Advisor', url: 'https://ra.co/feed', site_url: 'https://ra.co', description: 'Electronic music', popularity_score: 87, is_featured: false },
    // Additional Music
    { name: 'Bandcamp Daily', url: 'https://daily.bandcamp.com/feed', site_url: 'https://daily.bandcamp.com', description: 'Independent music', popularity_score: 82, is_featured: false },
    { name: 'The Quietus', url: 'https://thequietus.com/feed', site_url: 'https://thequietus.com', description: 'Music journalism', popularity_score: 81, is_featured: false },
    { name: 'Tiny Mix Tapes', url: 'https://www.tinymixtapes.com/feed', site_url: 'https://www.tinymixtapes.com', description: 'Music reviews', popularity_score: 79, is_featured: false },
    { name: 'Exclaim!', url: 'https://exclaim.ca/feed', site_url: 'https://exclaim.ca', description: 'Canadian music', popularity_score: 78, is_featured: false },
    { name: 'The Fader', url: 'https://www.thefader.com/rss', site_url: 'https://www.thefader.com', description: 'Music and culture', popularity_score: 84, is_featured: false },
    { name: 'Complex Music', url: 'https://www.complex.com/music/feed', site_url: 'https://www.complex.com/music', description: 'Hip-hop and pop', popularity_score: 83, is_featured: false },
    { name: 'Clash Magazine', url: 'https://www.clashmusic.com/feed/', site_url: 'https://www.clashmusic.com', description: 'Music magazine', popularity_score: 80, is_featured: false },
    { name: 'Under the Radar', url: 'https://www.undertheradarmag.com/feed/', site_url: 'https://www.undertheradarmag.com', description: 'Indie music', popularity_score: 79, is_featured: false },
  ],
  Food: [
    { name: 'Serious Eats', url: 'https://www.seriouseats.com/feeds/main', site_url: 'https://www.seriouseats.com', description: 'Food science and recipes', popularity_score: 94, is_featured: true },
    { name: 'Bon Appétit', url: 'https://www.bonappetit.com/feed/rss', site_url: 'https://www.bonappetit.com', description: 'Recipes and food culture', popularity_score: 93, is_featured: true },
    { name: 'Food52', url: 'https://food52.com/blog.rss', site_url: 'https://food52.com', description: 'Home cooking community', popularity_score: 91, is_featured: true },
    { name: 'Epicurious', url: 'https://www.epicurious.com/feed/rss', site_url: 'https://www.epicurious.com', description: 'Recipes and cooking tips', popularity_score: 90, is_featured: true },
    { name: 'Eater', url: 'https://www.eater.com/rss/index.xml', site_url: 'https://www.eater.com', description: 'Restaurant news', popularity_score: 92, is_featured: true },
    { name: 'The Kitchn', url: 'https://www.thekitchn.com/feed', site_url: 'https://www.thekitchn.com', description: 'Home cooking', popularity_score: 89, is_featured: false },
    { name: 'Saveur', url: 'https://www.saveur.com/feed/', site_url: 'https://www.saveur.com', description: 'Food and travel', popularity_score: 87, is_featured: false },
    { name: 'Food Network', url: 'https://www.foodnetwork.com/feeds/recipes', site_url: 'https://www.foodnetwork.com', description: 'TV cooking shows', popularity_score: 88, is_featured: false },
    { name: 'Smitten Kitchen', url: 'https://smittenkitchen.com/feed/', site_url: 'https://smittenkitchen.com', description: 'Home cooking blog', popularity_score: 86, is_featured: false },
    { name: 'Minimalist Baker', url: 'https://minimalistbaker.com/feed/', site_url: 'https://minimalistbaker.com', description: 'Simple recipes', popularity_score: 85, is_featured: false },
    // NYT Food
    { name: 'NYT Cooking', url: 'https://rss.nytimes.com/services/xml/rss/nyt/DiningandWine.xml', site_url: 'https://www.nytimes.com/section/food', description: 'NYT food coverage', popularity_score: 90, is_featured: false },
    // Additional Food
    { name: 'Delish', url: 'https://www.delish.com/rss/all.xml/', site_url: 'https://www.delish.com', description: 'Recipes and food news', popularity_score: 84, is_featured: false },
    { name: 'Taste of Home', url: 'https://www.tasteofhome.com/feed/', site_url: 'https://www.tasteofhome.com', description: 'Home recipes', popularity_score: 83, is_featured: false },
    { name: 'Simply Recipes', url: 'https://www.simplyrecipes.com/feed/', site_url: 'https://www.simplyrecipes.com', description: 'Easy recipes', popularity_score: 82, is_featured: false },
    { name: 'Budget Bytes', url: 'https://www.budgetbytes.com/feed/', site_url: 'https://www.budgetbytes.com', description: 'Budget cooking', popularity_score: 81, is_featured: false },
    { name: 'Cookie and Kate', url: 'https://cookieandkate.com/feed/', site_url: 'https://cookieandkate.com', description: 'Vegetarian recipes', popularity_score: 80, is_featured: false },
    { name: 'Half Baked Harvest', url: 'https://www.halfbakedharvest.com/feed/', site_url: 'https://www.halfbakedharvest.com', description: 'Creative recipes', popularity_score: 82, is_featured: false },
    { name: 'Love and Lemons', url: 'https://www.loveandlemons.com/feed/', site_url: 'https://www.loveandlemons.com', description: 'Healthy recipes', popularity_score: 81, is_featured: false },
  ],
  Travel: [
    { name: 'Lonely Planet', url: 'https://www.lonelyplanet.com/feed.xml', site_url: 'https://www.lonelyplanet.com', description: 'Travel guides and tips', popularity_score: 95, is_featured: true },
    { name: 'Condé Nast Traveler', url: 'https://www.cntraveler.com/feed/rss', site_url: 'https://www.cntraveler.com', description: 'Luxury travel', popularity_score: 93, is_featured: true },
    { name: 'Travel + Leisure', url: 'https://www.travelandleisure.com/feeds/all', site_url: 'https://www.travelandleisure.com', description: 'Travel inspiration', popularity_score: 92, is_featured: true },
    { name: 'National Geographic Travel', url: 'https://www.nationalgeographic.com/travel/feed', site_url: 'https://www.nationalgeographic.com/travel', description: 'Adventure travel', popularity_score: 94, is_featured: true },
    { name: 'AFAR', url: 'https://www.afar.com/feed', site_url: 'https://www.afar.com', description: 'Experiential travel', popularity_score: 90, is_featured: true },
    { name: 'The Points Guy', url: 'https://thepointsguy.com/feed/', site_url: 'https://thepointsguy.com', description: 'Travel rewards', popularity_score: 89, is_featured: false },
    { name: 'Nomadic Matt', url: 'https://www.nomadicmatt.com/feed/', site_url: 'https://www.nomadicmatt.com', description: 'Budget travel', popularity_score: 88, is_featured: false },
    { name: 'BBC Travel', url: 'https://www.bbc.com/travel/feed.rss', site_url: 'https://www.bbc.com/travel', description: 'Travel stories', popularity_score: 88, is_featured: false },
    { name: 'Atlas Obscura', url: 'https://www.atlasobscura.com/feeds/latest', site_url: 'https://www.atlasobscura.com', description: 'Hidden wonders', popularity_score: 87, is_featured: false },
    { name: 'Skift', url: 'https://skift.com/feed/', site_url: 'https://skift.com', description: 'Travel industry news', popularity_score: 86, is_featured: false },
    // NYT Travel
    { name: 'NYT Travel', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml', site_url: 'https://www.nytimes.com/section/travel', description: 'NYT travel coverage', popularity_score: 91, is_featured: false },
    // Additional Travel
    { name: 'Fodors', url: 'https://www.fodors.com/feed/', site_url: 'https://www.fodors.com', description: 'Travel guides', popularity_score: 85, is_featured: false },
    { name: 'Frommers', url: 'https://www.frommers.com/feed', site_url: 'https://www.frommers.com', description: 'Travel advice', popularity_score: 84, is_featured: false },
    { name: 'Matador Network', url: 'https://matadornetwork.com/feed/', site_url: 'https://matadornetwork.com', description: 'Travel stories', popularity_score: 83, is_featured: false },
    { name: 'Wanderlust', url: 'https://www.wanderlust.co.uk/feed/', site_url: 'https://www.wanderlust.co.uk', description: 'UK travel magazine', popularity_score: 82, is_featured: false },
    { name: 'Expert Vagabond', url: 'https://expertvagabond.com/feed/', site_url: 'https://expertvagabond.com', description: 'Adventure travel', popularity_score: 81, is_featured: false },
    { name: 'Adventurous Kate', url: 'https://www.adventurouskate.com/feed/', site_url: 'https://www.adventurouskate.com', description: 'Solo travel', popularity_score: 80, is_featured: false },
    { name: 'Hand Luggage Only', url: 'https://handluggageonly.co.uk/feed/', site_url: 'https://handluggageonly.co.uk', description: 'Travel tips', popularity_score: 79, is_featured: false },
  ],

  Books: [
    { name: 'The New York Times Books', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Books.xml', site_url: 'https://www.nytimes.com/section/books', description: 'Book reviews', popularity_score: 95, is_featured: true },
    { name: 'The Guardian Books', url: 'https://www.theguardian.com/books/rss', site_url: 'https://www.theguardian.com/books', description: 'Book news and reviews', popularity_score: 93, is_featured: true },
    { name: 'Literary Hub', url: 'https://lithub.com/feed/', site_url: 'https://lithub.com', description: 'Literary news', popularity_score: 91, is_featured: true },
    { name: 'Book Riot', url: 'https://bookriot.com/feed/', site_url: 'https://bookriot.com', description: 'Book recommendations', popularity_score: 89, is_featured: true },
    { name: 'The Paris Review', url: 'https://www.theparisreview.org/feed/', site_url: 'https://www.theparisreview.org', description: 'Literary magazine', popularity_score: 90, is_featured: true },
    { name: 'Kirkus Reviews', url: 'https://www.kirkusreviews.com/feeds/rss/', site_url: 'https://www.kirkusreviews.com', description: 'Book reviews', popularity_score: 88, is_featured: false },
    { name: 'Publishers Weekly', url: 'https://www.publishersweekly.com/pw/feeds/recent/index.xml', site_url: 'https://www.publishersweekly.com', description: 'Publishing news', popularity_score: 89, is_featured: false },
    { name: 'Tor.com', url: 'https://www.tor.com/feed/', site_url: 'https://www.tor.com', description: 'Science fiction and fantasy', popularity_score: 86, is_featured: false },
    { name: 'Electric Literature', url: 'https://electricliterature.com/feed/', site_url: 'https://electricliterature.com', description: 'Literary fiction', popularity_score: 86, is_featured: false },
    { name: 'Goodreads Blog', url: 'https://www.goodreads.com/blog/feed', site_url: 'https://www.goodreads.com/blog', description: 'Reading community', popularity_score: 88, is_featured: false },
    // Additional Books
    { name: 'The Millions', url: 'https://themillions.com/feed', site_url: 'https://themillions.com', description: 'Book culture', popularity_score: 84, is_featured: false },
    { name: 'Crime Reads', url: 'https://crimereads.com/feed/', site_url: 'https://crimereads.com', description: 'Crime fiction', popularity_score: 83, is_featured: false },
    { name: 'The Rumpus', url: 'https://therumpus.net/feed/', site_url: 'https://therumpus.net', description: 'Literary culture', popularity_score: 82, is_featured: false },
    { name: 'Los Angeles Review of Books', url: 'https://lareviewofbooks.org/feed/', site_url: 'https://lareviewofbooks.org', description: 'Book reviews', popularity_score: 85, is_featured: false },
    { name: 'Shelf Awareness', url: 'https://www.shelf-awareness.com/rss/', site_url: 'https://www.shelf-awareness.com', description: 'Book industry', popularity_score: 81, is_featured: false },
    { name: 'Book Marks', url: 'https://bookmarks.reviews/feed/', site_url: 'https://bookmarks.reviews', description: 'Review aggregator', popularity_score: 80, is_featured: false },
    { name: 'Asymptote', url: 'https://www.asymptotejournal.com/feed/', site_url: 'https://www.asymptotejournal.com', description: 'World literature', popularity_score: 79, is_featured: false },
    { name: 'Words Without Borders', url: 'https://wordswithoutborders.org/feed/', site_url: 'https://wordswithoutborders.org', description: 'International literature', popularity_score: 80, is_featured: false },
  ],
  Automotive: [
    { name: 'Car and Driver', url: 'https://www.caranddriver.com/rss/all.xml/', site_url: 'https://www.caranddriver.com', description: 'Car reviews and news', popularity_score: 94, is_featured: true },
    { name: 'Motor Trend', url: 'https://www.motortrend.com/feed/', site_url: 'https://www.motortrend.com', description: 'Automotive news', popularity_score: 93, is_featured: true },
    { name: 'Jalopnik', url: 'https://jalopnik.com/rss', site_url: 'https://jalopnik.com', description: 'Car culture', popularity_score: 91, is_featured: true },
    { name: 'Road & Track', url: 'https://www.roadandtrack.com/rss/', site_url: 'https://www.roadandtrack.com', description: 'Automotive journalism', popularity_score: 90, is_featured: true },
    { name: 'Top Gear', url: 'https://www.topgear.com/feed/all', site_url: 'https://www.topgear.com', description: 'Car reviews', popularity_score: 92, is_featured: true },
    { name: 'Autoblog', url: 'https://www.autoblog.com/rss.xml', site_url: 'https://www.autoblog.com', description: 'Car news', popularity_score: 89, is_featured: false },
    { name: 'The Drive', url: 'https://www.thedrive.com/feed', site_url: 'https://www.thedrive.com', description: 'Automotive culture', popularity_score: 88, is_featured: false },
    { name: 'Electrek', url: 'https://electrek.co/feed/', site_url: 'https://electrek.co', description: 'EV news', popularity_score: 88, is_featured: false },
    { name: 'InsideEVs', url: 'https://insideevs.com/rss/', site_url: 'https://insideevs.com', description: 'Electric vehicles', popularity_score: 86, is_featured: false },
    { name: 'Hagerty', url: 'https://www.hagerty.com/media/feed/', site_url: 'https://www.hagerty.com', description: 'Classic cars', popularity_score: 85, is_featured: false },
    // Additional Automotive
    { name: 'Autocar', url: 'https://www.autocar.co.uk/rss', site_url: 'https://www.autocar.co.uk', description: 'UK car news', popularity_score: 87, is_featured: false },
    { name: 'CarScoops', url: 'https://www.carscoops.com/feed/', site_url: 'https://www.carscoops.com', description: 'Car news', popularity_score: 84, is_featured: false },
    { name: 'Motor1', url: 'https://www.motor1.com/rss/', site_url: 'https://www.motor1.com', description: 'Automotive news', popularity_score: 83, is_featured: false },
    { name: 'Carbuzz', url: 'https://carbuzz.com/feed', site_url: 'https://carbuzz.com', description: 'Car reviews', popularity_score: 82, is_featured: false },
    { name: 'Petrolicious', url: 'https://petrolicious.com/feed', site_url: 'https://petrolicious.com', description: 'Car culture', popularity_score: 81, is_featured: false },
    { name: 'Bring a Trailer', url: 'https://bringatrailer.com/feed/', site_url: 'https://bringatrailer.com', description: 'Car auctions', popularity_score: 84, is_featured: false },
    { name: 'Hemmings', url: 'https://www.hemmings.com/stories/feed', site_url: 'https://www.hemmings.com', description: 'Classic cars', popularity_score: 80, is_featured: false },
    { name: 'CleanTechnica', url: 'https://cleantechnica.com/feed/', site_url: 'https://cleantechnica.com', description: 'Clean energy vehicles', popularity_score: 82, is_featured: false },
  ],
  DIY: [
    { name: 'Instructables', url: 'https://www.instructables.com/rss/', site_url: 'https://www.instructables.com', description: 'DIY projects', popularity_score: 94, is_featured: true },
    { name: 'Make Magazine', url: 'https://makezine.com/feed/', site_url: 'https://makezine.com', description: 'Maker culture', popularity_score: 92, is_featured: true },
    { name: 'Adafruit', url: 'https://blog.adafruit.com/feed/', site_url: 'https://blog.adafruit.com', description: 'Electronics projects', popularity_score: 89, is_featured: true },
    { name: 'This Old House', url: 'https://www.thisoldhouse.com/feed', site_url: 'https://www.thisoldhouse.com', description: 'Home renovation', popularity_score: 89, is_featured: true },
    { name: 'Family Handyman', url: 'https://www.familyhandyman.com/feed/', site_url: 'https://www.familyhandyman.com', description: 'Home improvement', popularity_score: 88, is_featured: false },
    { name: 'Raspberry Pi Blog', url: 'https://www.raspberrypi.org/blog/feed/', site_url: 'https://www.raspberrypi.org/blog', description: 'Raspberry Pi projects', popularity_score: 88, is_featured: false },
    { name: 'Arduino Blog', url: 'https://blog.arduino.cc/feed/', site_url: 'https://blog.arduino.cc', description: 'Arduino projects', popularity_score: 87, is_featured: false },
    { name: 'All3DP', url: 'https://all3dp.com/feed/', site_url: 'https://all3dp.com', description: '3D printing', popularity_score: 86, is_featured: false },
    { name: 'Apartment Therapy DIY', url: 'https://www.apartmenttherapy.com/feed', site_url: 'https://www.apartmenttherapy.com', description: 'Home decor', popularity_score: 87, is_featured: false },
    { name: 'Hackaday', url: 'https://hackaday.com/feed/', site_url: 'https://hackaday.com', description: 'Hardware hacking', popularity_score: 90, is_featured: true },
    // Additional DIY
    { name: 'Lifehacker', url: 'https://lifehacker.com/rss', site_url: 'https://lifehacker.com', description: 'Life hacks', popularity_score: 88, is_featured: false },
    { name: 'Bob Vila', url: 'https://www.bobvila.com/feed/', site_url: 'https://www.bobvila.com', description: 'Home improvement', popularity_score: 85, is_featured: false },
    { name: 'Ana White', url: 'https://www.ana-white.com/feed', site_url: 'https://www.ana-white.com', description: 'Woodworking plans', popularity_score: 83, is_featured: false },
    { name: 'Woodworking Network', url: 'https://www.woodworkingnetwork.com/rss.xml', site_url: 'https://www.woodworkingnetwork.com', description: 'Woodworking', popularity_score: 82, is_featured: false },
    { name: 'SparkFun', url: 'https://www.sparkfun.com/feeds/news', site_url: 'https://www.sparkfun.com', description: 'Electronics', popularity_score: 86, is_featured: false },
    { name: 'Evil Mad Scientist', url: 'https://www.evilmadscientist.com/feed/', site_url: 'https://www.evilmadscientist.com', description: 'DIY electronics', popularity_score: 81, is_featured: false },
    { name: 'Dangerous Prototypes', url: 'https://dangerousprototypes.com/feed/', site_url: 'https://dangerousprototypes.com', description: 'Open hardware', popularity_score: 80, is_featured: false },
    { name: 'Tested', url: 'https://www.tested.com/feeds/all/', site_url: 'https://www.tested.com', description: 'Making and tech', popularity_score: 84, is_featured: false },
  ],
  Android: [
    { name: 'Android Police', url: 'https://www.androidpolice.com/feed/', site_url: 'https://www.androidpolice.com', description: 'Android news and reviews', popularity_score: 94, is_featured: true },
    { name: 'Android Authority', url: 'https://www.androidauthority.com/feed/', site_url: 'https://www.androidauthority.com', description: 'Android news', popularity_score: 93, is_featured: true },
    { name: '9to5Google', url: 'https://9to5google.com/feed/', site_url: 'https://9to5google.com', description: 'Google and Android news', popularity_score: 92, is_featured: true },
    { name: 'Android Central', url: 'https://www.androidcentral.com/feed', site_url: 'https://www.androidcentral.com', description: 'Android community', popularity_score: 91, is_featured: true },
    { name: 'XDA Developers', url: 'https://www.xda-developers.com/feed/', site_url: 'https://www.xda-developers.com', description: 'Android development', popularity_score: 90, is_featured: true },
    { name: 'Droid Life', url: 'https://www.droid-life.com/feed/', site_url: 'https://www.droid-life.com', description: 'Android news', popularity_score: 88, is_featured: false },
    { name: 'GSMArena', url: 'https://www.gsmarena.com/rss-news-reviews.php3', site_url: 'https://www.gsmarena.com', description: 'Phone reviews', popularity_score: 90, is_featured: false },
    { name: 'Phone Arena', url: 'https://www.phonearena.com/feed', site_url: 'https://www.phonearena.com', description: 'Phone news', popularity_score: 88, is_featured: false },
    { name: 'Android Developers Blog', url: 'https://android-developers.googleblog.com/feeds/posts/default', site_url: 'https://android-developers.googleblog.com', description: 'Android dev news', popularity_score: 89, is_featured: false },
    { name: 'Google Blog', url: 'https://blog.google/rss/', site_url: 'https://blog.google', description: 'Google news', popularity_score: 91, is_featured: false },
    // Additional Android
    { name: 'Android Headlines', url: 'https://www.androidheadlines.com/feed', site_url: 'https://www.androidheadlines.com', description: 'Android news', popularity_score: 85, is_featured: false },
    { name: 'Phandroid', url: 'https://phandroid.com/feed/', site_url: 'https://phandroid.com', description: 'Android news', popularity_score: 84, is_featured: false },
    { name: 'Android Guys', url: 'https://www.androidguys.com/feed/', site_url: 'https://www.androidguys.com', description: 'Android coverage', popularity_score: 82, is_featured: false },
    { name: 'Talk Android', url: 'https://www.talkandroid.com/feed/', site_url: 'https://www.talkandroid.com', description: 'Android news', popularity_score: 81, is_featured: false },
    { name: 'Android Community', url: 'https://androidcommunity.com/feed/', site_url: 'https://androidcommunity.com', description: 'Android community', popularity_score: 80, is_featured: false },
    { name: 'Ausdroid', url: 'https://ausdroid.net/feed/', site_url: 'https://ausdroid.net', description: 'Australian Android', popularity_score: 79, is_featured: false },
    { name: 'Android Spin', url: 'https://www.androidspin.com/feed/', site_url: 'https://www.androidspin.com', description: 'Android tips', popularity_score: 78, is_featured: false },
    { name: 'Chrome Unboxed', url: 'https://chromeunboxed.com/feed/', site_url: 'https://chromeunboxed.com', description: 'Chrome OS news', popularity_score: 83, is_featured: false },
  ],

  Apple: [
    { name: '9to5Mac', url: 'https://9to5mac.com/feed/', site_url: 'https://9to5mac.com', description: 'Apple news and rumors', popularity_score: 95, is_featured: true },
    { name: 'MacRumors', url: 'https://feeds.macrumors.com/MacRumors-All', site_url: 'https://www.macrumors.com', description: 'Apple news and rumors', popularity_score: 94, is_featured: true },
    { name: 'AppleInsider', url: 'https://appleinsider.com/rss/news/', site_url: 'https://appleinsider.com', description: 'Apple news', popularity_score: 92, is_featured: true },
    { name: 'iMore', url: 'https://www.imore.com/feed', site_url: 'https://www.imore.com', description: 'Apple community', popularity_score: 90, is_featured: true },
    { name: 'Mac Stories', url: 'https://www.macstories.net/feed/', site_url: 'https://www.macstories.net', description: 'Apple apps and news', popularity_score: 91, is_featured: true },
    { name: 'Daring Fireball', url: 'https://daringfireball.net/feeds/main', site_url: 'https://daringfireball.net', description: 'Apple commentary', popularity_score: 93, is_featured: true },
    { name: 'Six Colors', url: 'https://sixcolors.com/feed/', site_url: 'https://sixcolors.com', description: 'Apple analysis', popularity_score: 88, is_featured: false },
    { name: 'Cult of Mac', url: 'https://www.cultofmac.com/feed/', site_url: 'https://www.cultofmac.com', description: 'Apple culture', popularity_score: 89, is_featured: false },
    { name: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/rss-feed.rss', site_url: 'https://www.apple.com/newsroom', description: 'Official Apple news', popularity_score: 92, is_featured: false },
    { name: 'iOS Dev Weekly', url: 'https://iosdevweekly.com/issues.rss', site_url: 'https://iosdevweekly.com', description: 'iOS dev newsletter', popularity_score: 87, is_featured: false },
    // Additional Apple
    { name: 'Mac Observer', url: 'https://www.macobserver.com/feed/', site_url: 'https://www.macobserver.com', description: 'Mac news', popularity_score: 85, is_featured: false },
    { name: 'Macworld', url: 'https://www.macworld.com/feed', site_url: 'https://www.macworld.com', description: 'Mac reviews', popularity_score: 86, is_featured: false },
    { name: 'TUAW', url: 'https://www.tuaw.com/feed/', site_url: 'https://www.tuaw.com', description: 'Apple news', popularity_score: 82, is_featured: false },
    { name: 'Mac Daily News', url: 'https://macdailynews.com/feed/', site_url: 'https://macdailynews.com', description: 'Mac news', popularity_score: 81, is_featured: false },
    { name: 'iDownloadBlog', url: 'https://www.idownloadblog.com/feed/', site_url: 'https://www.idownloadblog.com', description: 'Apple tips', popularity_score: 84, is_featured: false },
    { name: 'OSXDaily', url: 'https://osxdaily.com/feed/', site_url: 'https://osxdaily.com', description: 'Mac tips', popularity_score: 83, is_featured: false },
    { name: 'Swift by Sundell', url: 'https://www.swiftbysundell.com/rss', site_url: 'https://www.swiftbysundell.com', description: 'Swift development', popularity_score: 86, is_featured: false },
    { name: 'NSHipster', url: 'https://nshipster.com/feed.xml', site_url: 'https://nshipster.com', description: 'iOS development', popularity_score: 85, is_featured: false },
  ],
  History: [
    { name: 'Smithsonian Magazine History', url: 'https://www.smithsonianmag.com/rss/history/', site_url: 'https://www.smithsonianmag.com/history', description: 'History articles', popularity_score: 94, is_featured: true },
    { name: 'History Extra', url: 'https://www.historyextra.com/feed/', site_url: 'https://www.historyextra.com', description: 'BBC History Magazine', popularity_score: 92, is_featured: true },
    { name: 'History Today', url: 'https://www.historytoday.com/feed/rss.xml', site_url: 'https://www.historytoday.com', description: 'History magazine', popularity_score: 90, is_featured: true },
    { name: 'History.com', url: 'https://www.history.com/rss', site_url: 'https://www.history.com', description: 'History Channel', popularity_score: 91, is_featured: true },
    { name: 'Ancient Origins', url: 'https://www.ancient-origins.net/rss.xml', site_url: 'https://www.ancient-origins.net', description: 'Ancient mysteries', popularity_score: 86, is_featured: true },
    { name: 'National Geographic History', url: 'https://www.nationalgeographic.com/history/feed', site_url: 'https://www.nationalgeographic.com/history', description: 'History exploration', popularity_score: 89, is_featured: false },
    { name: 'Medievalists.net', url: 'https://www.medievalists.net/feed/', site_url: 'https://www.medievalists.net', description: 'Medieval history', popularity_score: 81, is_featured: false },
    { name: 'Heritage Daily', url: 'https://www.heritagedaily.com/feed/', site_url: 'https://www.heritagedaily.com', description: 'Heritage news', popularity_score: 83, is_featured: false },
    { name: 'Archaeology Magazine', url: 'https://www.archaeology.org/feed', site_url: 'https://www.archaeology.org', description: 'Archaeological discoveries', popularity_score: 85, is_featured: false },
    { name: 'History Hit', url: 'https://www.historyhit.com/feed/', site_url: 'https://www.historyhit.com', description: 'History content', popularity_score: 83, is_featured: false },
    // Additional History
    { name: 'World History Encyclopedia', url: 'https://www.worldhistory.org/feed/', site_url: 'https://www.worldhistory.org', description: 'World history', popularity_score: 84, is_featured: false },
    { name: 'History News Network', url: 'https://historynewsnetwork.org/feed/', site_url: 'https://historynewsnetwork.org', description: 'History news', popularity_score: 82, is_featured: false },
    { name: 'Past Horizons', url: 'https://www.pasthorizonspr.com/feed/', site_url: 'https://www.pasthorizonspr.com', description: 'Archaeology news', popularity_score: 80, is_featured: false },
    { name: 'The History Blog', url: 'https://www.thehistoryblog.com/feed', site_url: 'https://www.thehistoryblog.com', description: 'History blog', popularity_score: 79, is_featured: false },
    { name: 'Executed Today', url: 'https://www.executedtoday.com/feed/', site_url: 'https://www.executedtoday.com', description: 'Historical executions', popularity_score: 77, is_featured: false },
    { name: 'Lapham\'s Quarterly', url: 'https://www.laphamsquarterly.org/feed', site_url: 'https://www.laphamsquarterly.org', description: 'History and literature', popularity_score: 81, is_featured: false },
    { name: 'JSTOR Daily History', url: 'https://daily.jstor.org/feed/', site_url: 'https://daily.jstor.org', description: 'Academic history', popularity_score: 83, is_featured: false },
    { name: 'Aeon History', url: 'https://aeon.co/feed.rss', site_url: 'https://aeon.co', description: 'Ideas and history', popularity_score: 84, is_featured: false },
  ],
  Humor: [
    { name: 'The Onion', url: 'https://www.theonion.com/rss', site_url: 'https://www.theonion.com', description: 'Americas Finest News Source', popularity_score: 95, is_featured: true },
    { name: 'McSweeneys', url: 'https://www.mcsweeneys.net/feeds/columns', site_url: 'https://www.mcsweeneys.net', description: 'Humor and satire', popularity_score: 91, is_featured: true },
    { name: 'XKCD', url: 'https://xkcd.com/rss.xml', site_url: 'https://xkcd.com', description: 'Webcomic', popularity_score: 92, is_featured: true },
    { name: 'The Oatmeal', url: 'https://theoatmeal.com/feed/rss', site_url: 'https://theoatmeal.com', description: 'Comics and humor', popularity_score: 89, is_featured: true },
    { name: 'Bored Panda', url: 'https://www.boredpanda.com/feed/', site_url: 'https://www.boredpanda.com', description: 'Viral content', popularity_score: 86, is_featured: true },
    { name: 'The Babylon Bee', url: 'https://babylonbee.com/feed', site_url: 'https://babylonbee.com', description: 'Satirical news', popularity_score: 88, is_featured: false },
    { name: 'Cracked', url: 'https://www.cracked.com/feed', site_url: 'https://www.cracked.com', description: 'Comedy articles', popularity_score: 86, is_featured: false },
    { name: 'Saturday Morning Breakfast Cereal', url: 'https://www.smbc-comics.com/comic/rss', site_url: 'https://www.smbc-comics.com', description: 'Webcomic', popularity_score: 87, is_featured: false },
    { name: 'The Hard Times', url: 'https://thehardtimes.net/feed/', site_url: 'https://thehardtimes.net', description: 'Punk satire', popularity_score: 84, is_featured: false },
    { name: 'Reductress', url: 'https://reductress.com/feed/', site_url: 'https://reductress.com', description: 'Womens satire', popularity_score: 85, is_featured: false },
    // Additional Humor
    { name: 'Clickhole', url: 'https://clickhole.com/feed/', site_url: 'https://clickhole.com', description: 'Viral satire', popularity_score: 83, is_featured: false },
    { name: 'Cyanide & Happiness', url: 'https://explosm.net/rss', site_url: 'https://explosm.net', description: 'Dark humor comics', popularity_score: 84, is_featured: false },
    { name: 'Poorly Drawn Lines', url: 'https://poorlydrawnlines.com/feed/', site_url: 'https://poorlydrawnlines.com', description: 'Webcomic', popularity_score: 81, is_featured: false },
    { name: 'Dinosaur Comics', url: 'https://www.qwantz.com/rssfeed.php', site_url: 'https://www.qwantz.com', description: 'Webcomic', popularity_score: 80, is_featured: false },
    { name: 'Existential Comics', url: 'https://existentialcomics.com/rss.xml', site_url: 'https://existentialcomics.com', description: 'Philosophy comics', popularity_score: 82, is_featured: false },
    { name: 'The Daily Mash', url: 'https://www.thedailymash.co.uk/feed', site_url: 'https://www.thedailymash.co.uk', description: 'UK satire', popularity_score: 81, is_featured: false },
    { name: 'Points in Case', url: 'https://www.pointsincase.com/feed', site_url: 'https://www.pointsincase.com', description: 'Comedy writing', popularity_score: 79, is_featured: false },
    { name: 'The Beaverton', url: 'https://www.thebeaverton.com/feed/', site_url: 'https://www.thebeaverton.com', description: 'Canadian satire', popularity_score: 80, is_featured: false },
  ],
  Beauty: [
    { name: 'Allure', url: 'https://www.allure.com/feed/rss', site_url: 'https://www.allure.com', description: 'Beauty tips and trends', popularity_score: 94, is_featured: true },
    { name: 'Byrdie', url: 'https://www.byrdie.com/rss', site_url: 'https://www.byrdie.com', description: 'Beauty and wellness', popularity_score: 92, is_featured: true },
    { name: 'Into The Gloss', url: 'https://intothegloss.com/feed/', site_url: 'https://intothegloss.com', description: 'Beauty routines', popularity_score: 90, is_featured: true },
    { name: 'Vogue Beauty', url: 'https://www.vogue.com/beauty/rss', site_url: 'https://www.vogue.com/beauty', description: 'High fashion beauty', popularity_score: 93, is_featured: true },
    { name: 'Elle Beauty', url: 'https://www.elle.com/beauty/rss/', site_url: 'https://www.elle.com/beauty', description: 'Beauty trends', popularity_score: 91, is_featured: true },
    { name: 'Refinery29 Beauty', url: 'https://www.refinery29.com/en-us/beauty/rss.xml', site_url: 'https://www.refinery29.com/en-us/beauty', description: 'Beauty news', popularity_score: 89, is_featured: false },
    { name: 'Temptalia', url: 'https://www.temptalia.com/feed/', site_url: 'https://www.temptalia.com', description: 'Makeup reviews', popularity_score: 86, is_featured: false },
    { name: 'Caroline Hirons', url: 'https://www.carolinehirons.com/feed', site_url: 'https://www.carolinehirons.com', description: 'Skincare advice', popularity_score: 85, is_featured: false },
    { name: 'Lab Muffin', url: 'https://labmuffin.com/feed/', site_url: 'https://labmuffin.com', description: 'Beauty science', popularity_score: 84, is_featured: false },
    { name: 'The Klog', url: 'https://theklog.co/feed/', site_url: 'https://theklog.co', description: 'K-beauty', popularity_score: 83, is_featured: false },
    // Additional Beauty
    { name: 'Beautylish', url: 'https://www.beautylish.com/feed', site_url: 'https://www.beautylish.com', description: 'Beauty community', popularity_score: 82, is_featured: false },
    { name: 'The Beauty Look Book', url: 'https://thebeautylookbook.com/feed/', site_url: 'https://thebeautylookbook.com', description: 'Beauty reviews', popularity_score: 81, is_featured: false },
    { name: 'Makeup and Beauty Blog', url: 'https://www.makeupandbeautyblog.com/feed/', site_url: 'https://www.makeupandbeautyblog.com', description: 'Makeup tips', popularity_score: 80, is_featured: false },
    { name: 'British Beauty Blogger', url: 'https://www.britishbeautyblogger.com/feed/', site_url: 'https://www.britishbeautyblogger.com', description: 'UK beauty', popularity_score: 79, is_featured: false },
    { name: 'Musings of a Muse', url: 'https://www.musingsofamuse.com/feed', site_url: 'https://www.musingsofamuse.com', description: 'Beauty news', popularity_score: 78, is_featured: false },
    { name: 'Makeup Savvy', url: 'https://www.makeupsavvy.co.uk/feed/', site_url: 'https://www.makeupsavvy.co.uk', description: 'Makeup reviews', popularity_score: 77, is_featured: false },
    { name: 'Kindofstephen', url: 'https://kindofstephen.com/feed/', site_url: 'https://kindofstephen.com', description: 'Skincare science', popularity_score: 82, is_featured: false },
    { name: 'The Skincare Edit', url: 'https://theskincareedit.com/feed', site_url: 'https://theskincareedit.com', description: 'Skincare reviews', popularity_score: 81, is_featured: false },
  ],

  Fashion: [
    { name: 'Vogue', url: 'https://www.vogue.com/feed/rss', site_url: 'https://www.vogue.com', description: 'Fashion news and trends', popularity_score: 96, is_featured: true },
    { name: 'GQ', url: 'https://www.gq.com/feed/rss', site_url: 'https://www.gq.com', description: 'Mens fashion', popularity_score: 94, is_featured: true },
    { name: 'Elle', url: 'https://www.elle.com/rss/all.xml/', site_url: 'https://www.elle.com', description: 'Fashion magazine', popularity_score: 93, is_featured: true },
    { name: 'Harpers Bazaar', url: 'https://www.harpersbazaar.com/rss/all.xml/', site_url: 'https://www.harpersbazaar.com', description: 'Fashion and beauty', popularity_score: 92, is_featured: true },
    { name: 'WWD', url: 'https://wwd.com/feed/', site_url: 'https://wwd.com', description: 'Fashion business', popularity_score: 91, is_featured: true },
    { name: 'Fashionista', url: 'https://fashionista.com/.rss/full/', site_url: 'https://fashionista.com', description: 'Fashion industry', popularity_score: 90, is_featured: true },
    { name: 'Hypebeast', url: 'https://hypebeast.com/feed', site_url: 'https://hypebeast.com', description: 'Street fashion', popularity_score: 90, is_featured: false },
    { name: 'Highsnobiety', url: 'https://www.highsnobiety.com/feed/', site_url: 'https://www.highsnobiety.com', description: 'Streetwear and fashion', popularity_score: 88, is_featured: false },
    { name: 'Who What Wear', url: 'https://www.whowhatwear.com/feed', site_url: 'https://www.whowhatwear.com', description: 'Fashion trends', popularity_score: 88, is_featured: false },
    { name: 'The Cut Fashion', url: 'https://www.thecut.com/tags/fashion/rss/', site_url: 'https://www.thecut.com/tags/fashion', description: 'Fashion culture', popularity_score: 89, is_featured: false },
    // Additional Fashion
    { name: 'Refinery29 Fashion', url: 'https://www.refinery29.com/en-us/fashion/rss.xml', site_url: 'https://www.refinery29.com/en-us/fashion', description: 'Fashion news', popularity_score: 87, is_featured: false },
    { name: 'Man Repeller', url: 'https://repeller.com/feed/', site_url: 'https://repeller.com', description: 'Fashion and culture', popularity_score: 85, is_featured: false },
    { name: 'The Fashion Law', url: 'https://www.thefashionlaw.com/feed/', site_url: 'https://www.thefashionlaw.com', description: 'Fashion legal news', popularity_score: 82, is_featured: false },
    { name: 'Business of Fashion', url: 'https://www.businessoffashion.com/feed', site_url: 'https://www.businessoffashion.com', description: 'Fashion business', popularity_score: 89, is_featured: false },
    { name: 'Coveteur', url: 'https://coveteur.com/feed/', site_url: 'https://coveteur.com', description: 'Fashion and beauty', popularity_score: 84, is_featured: false },
    { name: 'Style.com', url: 'https://www.style.com/feed/', site_url: 'https://www.style.com', description: 'Fashion coverage', popularity_score: 83, is_featured: false },
    { name: 'Grazia', url: 'https://graziadaily.co.uk/feed/', site_url: 'https://graziadaily.co.uk', description: 'UK fashion', popularity_score: 82, is_featured: false },
    { name: 'InStyle', url: 'https://www.instyle.com/feeds/all', site_url: 'https://www.instyle.com', description: 'Fashion and beauty', popularity_score: 86, is_featured: false },
  ],
  Startups: [
    { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/', site_url: 'https://techcrunch.com/category/startups', description: 'Startup news', popularity_score: 95, is_featured: true },
    { name: 'Y Combinator Blog', url: 'https://www.ycombinator.com/blog/rss/', site_url: 'https://www.ycombinator.com/blog', description: 'YC insights', popularity_score: 94, is_featured: true },
    { name: 'First Round Review', url: 'https://review.firstround.com/feed.xml', site_url: 'https://review.firstround.com', description: 'Startup advice', popularity_score: 92, is_featured: true },
    { name: 'a16z', url: 'https://a16z.com/feed/', site_url: 'https://a16z.com', description: 'Andreessen Horowitz', popularity_score: 93, is_featured: true },
    { name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/', site_url: 'https://news.crunchbase.com', description: 'Funding news', popularity_score: 90, is_featured: true },
    { name: 'Startup Grind', url: 'https://www.startupgrind.com/blog/feed/', site_url: 'https://www.startupgrind.com/blog', description: 'Startup community', popularity_score: 86, is_featured: false },
    { name: 'Both Sides of the Table', url: 'https://bothsidesofthetable.com/feed', site_url: 'https://bothsidesofthetable.com', description: 'VC perspective', popularity_score: 88, is_featured: false },
    { name: 'SaaStr', url: 'https://www.saastr.com/feed/', site_url: 'https://www.saastr.com', description: 'SaaS insights', popularity_score: 89, is_featured: false },
    { name: 'Indie Hackers', url: 'https://www.indiehackers.com/feed.xml', site_url: 'https://www.indiehackers.com', description: 'Bootstrapped startups', popularity_score: 87, is_featured: false },
    { name: 'Product Hunt', url: 'https://www.producthunt.com/feed', site_url: 'https://www.producthunt.com', description: 'New products', popularity_score: 91, is_featured: false },
    // Additional Startups
    { name: 'Sequoia Capital', url: 'https://www.sequoiacap.com/feed/', site_url: 'https://www.sequoiacap.com', description: 'VC insights', popularity_score: 90, is_featured: false },
    { name: 'Bessemer Venture Partners', url: 'https://www.bvp.com/feed', site_url: 'https://www.bvp.com', description: 'VC blog', popularity_score: 86, is_featured: false },
    { name: 'NFX', url: 'https://www.nfx.com/feed', site_url: 'https://www.nfx.com', description: 'Network effects', popularity_score: 85, is_featured: false },
    { name: 'Lenny\'s Newsletter', url: 'https://www.lennysnewsletter.com/feed', site_url: 'https://www.lennysnewsletter.com', description: 'Product advice', popularity_score: 88, is_featured: false },
    { name: 'Stratechery', url: 'https://stratechery.com/feed/', site_url: 'https://stratechery.com', description: 'Tech strategy', popularity_score: 89, is_featured: false },
    { name: 'CB Insights', url: 'https://www.cbinsights.com/research/feed/', site_url: 'https://www.cbinsights.com', description: 'Startup research', popularity_score: 87, is_featured: false },
    { name: 'Tomasz Tunguz', url: 'https://tomtunguz.com/feed/', site_url: 'https://tomtunguz.com', description: 'VC insights', popularity_score: 84, is_featured: false },
    { name: 'Andrew Chen', url: 'https://andrewchen.com/feed/', site_url: 'https://andrewchen.com', description: 'Growth insights', popularity_score: 86, is_featured: false },
  ],
  Cricket: [
    { name: 'ESPNcricinfo', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', site_url: 'https://www.espncricinfo.com', description: 'Cricket news and scores', popularity_score: 96, is_featured: true },
    { name: 'Cricbuzz', url: 'https://www.cricbuzz.com/rss/cb_news.xml', site_url: 'https://www.cricbuzz.com', description: 'Live cricket scores', popularity_score: 95, is_featured: true },
    { name: 'Cricket Australia', url: 'https://www.cricket.com.au/news/rss', site_url: 'https://www.cricket.com.au', description: 'Australian cricket', popularity_score: 90, is_featured: true },
    { name: 'ECB Cricket', url: 'https://www.ecb.co.uk/rss', site_url: 'https://www.ecb.co.uk', description: 'England cricket', popularity_score: 89, is_featured: true },
    { name: 'BCCI', url: 'https://www.bcci.tv/rss', site_url: 'https://www.bcci.tv', description: 'Indian cricket', popularity_score: 92, is_featured: true },
    { name: 'Cricket World', url: 'https://www.cricketworld.com/rss/news.xml', site_url: 'https://www.cricketworld.com', description: 'Cricket news', popularity_score: 85, is_featured: false },
    { name: 'Wisden', url: 'https://www.wisden.com/feed', site_url: 'https://www.wisden.com', description: 'Cricket almanack', popularity_score: 88, is_featured: false },
    { name: 'The Cricket Monthly', url: 'https://www.thecricketmonthly.com/rss', site_url: 'https://www.thecricketmonthly.com', description: 'Cricket features', popularity_score: 84, is_featured: false },
    { name: 'Cricket Pakistan', url: 'https://www.cricketpakistan.com.pk/feed/', site_url: 'https://www.cricketpakistan.com.pk', description: 'Pakistan cricket', popularity_score: 83, is_featured: false },
    { name: 'ICC Cricket', url: 'https://www.icc-cricket.com/rss', site_url: 'https://www.icc-cricket.com', description: 'International cricket', popularity_score: 91, is_featured: false },
    // Additional Cricket
    { name: 'Cricket365', url: 'https://www.cricket365.com/feed/', site_url: 'https://www.cricket365.com', description: 'Cricket news', popularity_score: 82, is_featured: false },
    { name: 'The Cricketer', url: 'https://www.thecricketer.com/feed/', site_url: 'https://www.thecricketer.com', description: 'Cricket magazine', popularity_score: 84, is_featured: false },
    { name: 'Cricket Country', url: 'https://www.cricketcountry.com/feed/', site_url: 'https://www.cricketcountry.com', description: 'Cricket coverage', popularity_score: 81, is_featured: false },
    { name: 'Sportstar Cricket', url: 'https://sportstar.thehindu.com/cricket/feeder/default.rss', site_url: 'https://sportstar.thehindu.com/cricket', description: 'Indian cricket', popularity_score: 83, is_featured: false },
    { name: 'Cricket.com.au', url: 'https://www.cricket.com.au/feed', site_url: 'https://www.cricket.com.au', description: 'Australian cricket', popularity_score: 86, is_featured: false },
    { name: 'NZ Cricket', url: 'https://www.nzc.nz/feed/', site_url: 'https://www.nzc.nz', description: 'New Zealand cricket', popularity_score: 80, is_featured: false },
    { name: 'Cricket South Africa', url: 'https://www.cricket.co.za/feed/', site_url: 'https://www.cricket.co.za', description: 'South African cricket', popularity_score: 81, is_featured: false },
    { name: 'West Indies Cricket', url: 'https://www.windiescricket.com/feed/', site_url: 'https://www.windiescricket.com', description: 'West Indies cricket', popularity_score: 79, is_featured: false },
  ],
  Football: [
    { name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news', site_url: 'https://www.espn.com/soccer', description: 'Football news', popularity_score: 95, is_featured: true },
    { name: 'BBC Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', site_url: 'https://www.bbc.com/sport/football', description: 'UK football news', popularity_score: 94, is_featured: true },
    { name: 'Sky Sports Football', url: 'https://www.skysports.com/rss/12040', site_url: 'https://www.skysports.com/football', description: 'Football coverage', popularity_score: 93, is_featured: true },
    { name: 'The Guardian Football', url: 'https://www.theguardian.com/football/rss', site_url: 'https://www.theguardian.com/football', description: 'Football journalism', popularity_score: 92, is_featured: true },
    { name: 'Goal.com', url: 'https://www.goal.com/feeds/en/news', site_url: 'https://www.goal.com', description: 'Football news', popularity_score: 90, is_featured: true },
    { name: 'FourFourTwo', url: 'https://www.fourfourtwo.com/feed', site_url: 'https://www.fourfourtwo.com', description: 'Football magazine', popularity_score: 88, is_featured: false },
    { name: 'Football365', url: 'https://www.football365.com/feed', site_url: 'https://www.football365.com', description: 'Football opinion', popularity_score: 86, is_featured: false },
    { name: 'The Athletic Football', url: 'https://theathletic.com/football/feed/', site_url: 'https://theathletic.com/football', description: 'In-depth football', popularity_score: 91, is_featured: false },
    { name: 'World Soccer', url: 'https://www.worldsoccer.com/feed', site_url: 'https://www.worldsoccer.com', description: 'International football', popularity_score: 85, is_featured: false },
    { name: 'These Football Times', url: 'https://thesefootballtimes.co/feed/', site_url: 'https://thesefootballtimes.co', description: 'Football stories', popularity_score: 84, is_featured: false },
    // Additional Football
    { name: 'Transfermarkt', url: 'https://www.transfermarkt.com/rss/news', site_url: 'https://www.transfermarkt.com', description: 'Transfer news', popularity_score: 89, is_featured: false },
    { name: 'Football Italia', url: 'https://www.football-italia.net/feed', site_url: 'https://www.football-italia.net', description: 'Serie A news', popularity_score: 83, is_featured: false },
    { name: 'Bundesliga', url: 'https://www.bundesliga.com/en/feed', site_url: 'https://www.bundesliga.com', description: 'German football', popularity_score: 86, is_featured: false },
    { name: 'La Liga', url: 'https://www.laliga.com/en/feed', site_url: 'https://www.laliga.com', description: 'Spanish football', popularity_score: 87, is_featured: false },
    { name: 'Premier League', url: 'https://www.premierleague.com/rss', site_url: 'https://www.premierleague.com', description: 'English football', popularity_score: 92, is_featured: false },
    { name: 'Squawka', url: 'https://www.squawka.com/feed/', site_url: 'https://www.squawka.com', description: 'Football analytics', popularity_score: 82, is_featured: false },
    { name: 'Football Whispers', url: 'https://www.footballwhispers.com/feed/', site_url: 'https://www.footballwhispers.com', description: 'Transfer rumors', popularity_score: 81, is_featured: false },
    { name: 'Tribal Football', url: 'https://www.tribalfootball.com/feed/', site_url: 'https://www.tribalfootball.com', description: 'Football news', popularity_score: 80, is_featured: false },
  ],

  Tennis: [
    { name: 'ATP Tour', url: 'https://www.atptour.com/en/media/rss-feed/xml-feed', site_url: 'https://www.atptour.com', description: 'ATP tennis news', popularity_score: 94, is_featured: true },
    { name: 'WTA Tennis', url: 'https://www.wtatennis.com/rss', site_url: 'https://www.wtatennis.com', description: 'WTA tennis news', popularity_score: 93, is_featured: true },
    { name: 'Tennis.com', url: 'https://www.tennis.com/rss/', site_url: 'https://www.tennis.com', description: 'Tennis news', popularity_score: 91, is_featured: true },
    { name: 'ESPN Tennis', url: 'https://www.espn.com/espn/rss/tennis/news', site_url: 'https://www.espn.com/tennis', description: 'Tennis coverage', popularity_score: 92, is_featured: true },
    { name: 'BBC Tennis', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', site_url: 'https://www.bbc.com/sport/tennis', description: 'UK tennis news', popularity_score: 90, is_featured: true },
    { name: 'Tennis World USA', url: 'https://www.tennisworldusa.org/rss/', site_url: 'https://www.tennisworldusa.org', description: 'Tennis news', popularity_score: 86, is_featured: false },
    { name: 'Tennis Majors', url: 'https://www.tennismajors.com/feed/', site_url: 'https://www.tennismajors.com', description: 'Grand Slam coverage', popularity_score: 87, is_featured: false },
    { name: 'Baseline Tennis', url: 'https://baselinetennismag.com/feed/', site_url: 'https://baselinetennismag.com', description: 'Tennis magazine', popularity_score: 84, is_featured: false },
    { name: 'Tennis Abstract', url: 'https://www.tennisabstract.com/blog/feed/', site_url: 'https://www.tennisabstract.com', description: 'Tennis analytics', popularity_score: 83, is_featured: false },
    { name: 'The Racquet', url: 'https://theracquet.substack.com/feed', site_url: 'https://theracquet.substack.com', description: 'Tennis newsletter', popularity_score: 82, is_featured: false },
    // Additional Tennis
    { name: 'Tennis Channel', url: 'https://www.tennischannel.com/feed/', site_url: 'https://www.tennischannel.com', description: 'Tennis TV', popularity_score: 85, is_featured: false },
    { name: 'Tennis Now', url: 'https://www.tennisnow.com/feed/', site_url: 'https://www.tennisnow.com', description: 'Tennis news', popularity_score: 81, is_featured: false },
    { name: 'Perfect Tennis', url: 'https://www.perfect-tennis.com/feed/', site_url: 'https://www.perfect-tennis.com', description: 'Tennis tips', popularity_score: 80, is_featured: false },
    { name: 'Tennis Panorama', url: 'https://www.tennispanorama.com/feed/', site_url: 'https://www.tennispanorama.com', description: 'Tennis news', popularity_score: 79, is_featured: false },
    { name: 'Tennis Connected', url: 'https://tennisconnected.com/feed/', site_url: 'https://tennisconnected.com', description: 'Tennis community', popularity_score: 78, is_featured: false },
    { name: 'Tennishead', url: 'https://www.tennishead.net/feed/', site_url: 'https://www.tennishead.net', description: 'Tennis magazine', popularity_score: 82, is_featured: false },
    { name: 'Tennis Tonic', url: 'https://tennistonic.com/feed/', site_url: 'https://tennistonic.com', description: 'Tennis news', popularity_score: 77, is_featured: false },
    { name: 'Tennis Actu', url: 'https://www.tennisactu.net/feed/', site_url: 'https://www.tennisactu.net', description: 'Tennis news', popularity_score: 76, is_featured: false },
  ],
  Photography: [
    { name: 'PetaPixel', url: 'https://petapixel.com/feed/', site_url: 'https://petapixel.com', description: 'Photography news', popularity_score: 95, is_featured: true },
    { name: 'DPReview', url: 'https://www.dpreview.com/feeds/news.xml', site_url: 'https://www.dpreview.com', description: 'Camera reviews', popularity_score: 94, is_featured: true },
    { name: 'Fstoppers', url: 'https://fstoppers.com/rss.xml', site_url: 'https://fstoppers.com', description: 'Photography community', popularity_score: 91, is_featured: true },
    { name: 'Digital Camera World', url: 'https://www.digitalcameraworld.com/feeds/all', site_url: 'https://www.digitalcameraworld.com', description: 'Camera news', popularity_score: 90, is_featured: true },
    { name: 'Photography Life', url: 'https://photographylife.com/feed', site_url: 'https://photographylife.com', description: 'Photography tutorials', popularity_score: 89, is_featured: true },
    { name: 'DIY Photography', url: 'https://www.diyphotography.net/feed/', site_url: 'https://www.diyphotography.net', description: 'DIY photo tips', popularity_score: 87, is_featured: false },
    { name: 'The Phoblographer', url: 'https://www.thephoblographer.com/feed/', site_url: 'https://www.thephoblographer.com', description: 'Photography reviews', popularity_score: 86, is_featured: false },
    { name: 'Shutterbug', url: 'https://www.shutterbug.com/rss.xml', site_url: 'https://www.shutterbug.com', description: 'Photography magazine', popularity_score: 85, is_featured: false },
    { name: 'Feature Shoot', url: 'https://www.featureshoot.com/feed/', site_url: 'https://www.featureshoot.com', description: 'Photo features', popularity_score: 84, is_featured: false },
    { name: 'Lens Culture', url: 'https://www.lensculture.com/rss', site_url: 'https://www.lensculture.com', description: 'Contemporary photography', popularity_score: 88, is_featured: false },
    // Additional Photography
    { name: 'SLR Lounge', url: 'https://www.slrlounge.com/feed/', site_url: 'https://www.slrlounge.com', description: 'Photography education', popularity_score: 83, is_featured: false },
    { name: 'Digital Photography School', url: 'https://digital-photography-school.com/feed/', site_url: 'https://digital-photography-school.com', description: 'Photo tips', popularity_score: 86, is_featured: false },
    { name: 'Strobist', url: 'https://strobist.blogspot.com/feeds/posts/default', site_url: 'https://strobist.blogspot.com', description: 'Lighting tips', popularity_score: 82, is_featured: false },
    { name: 'Photo Rumors', url: 'https://photorumors.com/feed/', site_url: 'https://photorumors.com', description: 'Camera rumors', popularity_score: 81, is_featured: false },
    { name: 'Canon Rumors', url: 'https://www.canonrumors.com/feed/', site_url: 'https://www.canonrumors.com', description: 'Canon news', popularity_score: 83, is_featured: false },
    { name: 'Nikon Rumors', url: 'https://nikonrumors.com/feed/', site_url: 'https://nikonrumors.com', description: 'Nikon news', popularity_score: 82, is_featured: false },
    { name: 'Sony Alpha Rumors', url: 'https://www.sonyalpharumors.com/feed/', site_url: 'https://www.sonyalpharumors.com', description: 'Sony news', popularity_score: 84, is_featured: false },
    { name: 'Imaging Resource', url: 'https://www.imaging-resource.com/feed/', site_url: 'https://www.imaging-resource.com', description: 'Camera reviews', popularity_score: 85, is_featured: false },
  ],
  Interior: [
    { name: 'Dezeen', url: 'https://www.dezeen.com/feed/', site_url: 'https://www.dezeen.com', description: 'Architecture and design', popularity_score: 95, is_featured: true },
    { name: 'Architectural Digest', url: 'https://www.architecturaldigest.com/feed/rss', site_url: 'https://www.architecturaldigest.com', description: 'Interior design', popularity_score: 94, is_featured: true },
    { name: 'Dwell', url: 'https://www.dwell.com/feed', site_url: 'https://www.dwell.com', description: 'Modern design', popularity_score: 92, is_featured: true },
    { name: 'Elle Decor', url: 'https://www.elledecor.com/rss/all.xml/', site_url: 'https://www.elledecor.com', description: 'Interior design', popularity_score: 91, is_featured: true },
    { name: 'House Beautiful', url: 'https://www.housebeautiful.com/rss/all.xml/', site_url: 'https://www.housebeautiful.com', description: 'Home design', popularity_score: 90, is_featured: true },
    { name: 'Apartment Therapy', url: 'https://www.apartmenttherapy.com/feed', site_url: 'https://www.apartmenttherapy.com', description: 'Home decor', popularity_score: 89, is_featured: false },
    { name: 'Design Milk', url: 'https://design-milk.com/feed/', site_url: 'https://design-milk.com', description: 'Modern design', popularity_score: 87, is_featured: false },
    { name: 'Remodelista', url: 'https://www.remodelista.com/feed/', site_url: 'https://www.remodelista.com', description: 'Home remodeling', popularity_score: 88, is_featured: false },
    { name: 'Curbed', url: 'https://www.curbed.com/rss/index.xml', site_url: 'https://www.curbed.com', description: 'Home and design', popularity_score: 86, is_featured: false },
    { name: 'Domino', url: 'https://www.domino.com/feed/', site_url: 'https://www.domino.com', description: 'Home decor', popularity_score: 85, is_featured: false },
    // Additional Interior
    { name: 'ArchDaily', url: 'https://www.archdaily.com/feed', site_url: 'https://www.archdaily.com', description: 'Architecture news', popularity_score: 93, is_featured: false },
    { name: 'Designboom', url: 'https://www.designboom.com/feed/', site_url: 'https://www.designboom.com', description: 'Design magazine', popularity_score: 90, is_featured: false },
    { name: 'Freshome', url: 'https://freshome.com/feed/', site_url: 'https://freshome.com', description: 'Interior design', popularity_score: 84, is_featured: false },
    { name: 'Houzz', url: 'https://www.houzz.com/ideabooks/feed', site_url: 'https://www.houzz.com', description: 'Home design', popularity_score: 88, is_featured: false },
    { name: 'Lonny', url: 'https://www.lonny.com/feed/', site_url: 'https://www.lonny.com', description: 'Interior design', popularity_score: 83, is_featured: false },
    { name: 'MyDomaine', url: 'https://www.mydomaine.com/rss', site_url: 'https://www.mydomaine.com', description: 'Home decor', popularity_score: 82, is_featured: false },
    { name: 'The Spruce', url: 'https://www.thespruce.com/feed', site_url: 'https://www.thespruce.com', description: 'Home tips', popularity_score: 86, is_featured: false },
    { name: 'Better Homes & Gardens', url: 'https://www.bhg.com/rss/all.xml/', site_url: 'https://www.bhg.com', description: 'Home and garden', popularity_score: 87, is_featured: false },
  ],
};

// Main seeding function
async function seedFeeds() {
  console.log('🌱 Starting comprehensive feed seeding (500+ feeds)...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl.substring(0, 40)}...`);
  
  let totalFeeds = 0;
  let insertedFeeds = 0;
  let skippedFeeds = 0;
  let errorFeeds = 0;
  
  const categories = Object.keys(feedsByCategory);
  console.log(`\n📂 Found ${categories.length} categories to seed\n`);
  
  // Count total feeds
  for (const category of categories) {
    totalFeeds += feedsByCategory[category].length;
  }
  console.log(`📊 Total feeds to seed: ${totalFeeds}\n`);
  
  for (const category of categories) {
    const feeds = feedsByCategory[category];
    console.log(`\n📁 Processing ${category} (${feeds.length} feeds)...`);
    
    // Prepare feeds for insertion
    const feedsToInsert = feeds.map(feed => ({
      name: feed.name,
      url: feed.url,
      site_url: feed.site_url,
      description: feed.description,
      category: category,
      popularity_score: feed.popularity_score,
      is_featured: feed.is_featured,
    }));
    
    // Insert in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < feedsToInsert.length; i += batchSize) {
      const batch = feedsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('recommended_feeds')
        .upsert(batch, { 
          onConflict: 'url',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) {
        console.error(`   ❌ Error inserting batch: ${error.message}`);
        errorFeeds += batch.length;
      } else {
        insertedFeeds += batch.length;
        process.stdout.write(`   ✅ Inserted ${Math.min(i + batchSize, feedsToInsert.length)}/${feedsToInsert.length}\r`);
      }
    }
    console.log(`   ✅ Completed ${category}`);
  }
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 SEEDING COMPLETE');
  console.log('='.repeat(50));
  console.log(`📊 Total feeds processed: ${totalFeeds}`);
  console.log(`✅ Successfully inserted/updated: ${insertedFeeds}`);
  console.log(`⏭️  Skipped (duplicates): ${skippedFeeds}`);
  console.log(`❌ Errors: ${errorFeeds}`);
  
  // Verify final count
  const { count } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📈 Total feeds in database: ${count}`);
  
  // Show category distribution
  const { data: categoryData } = await supabase
    .from('recommended_feeds')
    .select('category');
  
  if (categoryData) {
    const distribution: Record<string, number> = {};
    categoryData.forEach(f => {
      distribution[f.category] = (distribution[f.category] || 0) + 1;
    });
    
    console.log('\n📊 Category distribution:');
    Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
      });
  }
}

seedFeeds().catch(console.error);
