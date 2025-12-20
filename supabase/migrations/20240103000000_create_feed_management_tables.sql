-- Create feed management system tables
-- Requirements: 2.1, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4, 8.5

-- Create folders table for feed organization
-- Requirements: 2.1, 2.4, 2.5

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint on (user_id, name)
  UNIQUE(user_id, name)
);

-- Create enum types for feeds table
CREATE TYPE feed_status AS ENUM ('active', 'paused', 'error');
CREATE TYPE feed_priority AS ENUM ('high', 'medium', 'low');

-- Create feeds table with comprehensive metadata
-- Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

CREATE TABLE IF NOT EXISTS feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  site_url TEXT,
  description TEXT,
  icon_url TEXT,
  icon_color TEXT,
  status feed_status NOT NULL DEFAULT 'active',
  priority feed_priority NOT NULL DEFAULT 'medium',
  custom_polling_interval INTEGER, -- in minutes
  last_fetched_at TIMESTAMPTZ,
  etag TEXT,
  last_modified TEXT,
  article_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint on (user_id, url)
  UNIQUE(user_id, url)
);

-- Create recommended_feeds table and seed data
-- Requirements: 8.1, 8.2, 8.3, 8.4, 8.5

CREATE TABLE IF NOT EXISTS recommended_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  description TEXT,
  icon_url TEXT,
  category TEXT NOT NULL,
  country TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  tags TEXT[] DEFAULT '{}',
  popularity_score INTEGER NOT NULL DEFAULT 0,
  article_frequency TEXT, -- e.g., 'daily', 'hourly', 'weekly'
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_position ON folders(user_id, position);

CREATE INDEX IF NOT EXISTS idx_feeds_user_id ON feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_feeds_folder_id ON feeds(folder_id);
CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status);
CREATE INDEX IF NOT EXISTS idx_feeds_last_fetched ON feeds(last_fetched_at);
CREATE INDEX IF NOT EXISTS idx_feeds_url ON feeds(url);

CREATE INDEX IF NOT EXISTS idx_recommended_feeds_category ON recommended_feeds(category);
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_country ON recommended_feeds(country);
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_language ON recommended_feeds(language);
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_popularity ON recommended_feeds(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_tags ON recommended_feeds USING GIN(tags);

-- Enable Row Level Security on all tables
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommended_feeds ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for folders table
CREATE POLICY "Users can view own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for feeds table
CREATE POLICY "Users can view own feeds" ON feeds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feeds" ON feeds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feeds" ON feeds
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feeds" ON feeds
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for recommended_feeds table (public read access)
CREATE POLICY "Anyone can view recommended feeds" ON recommended_feeds
  FOR SELECT USING (true);

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feeds_updated_at
  BEFORE UPDATE ON feeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommended_feeds_updated_at
  BEFORE UPDATE ON recommended_feeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed recommended feeds with comprehensive data (500+ feeds)
-- Requirements: 8.1, 8.2, 8.3, 8.4, 8.5

INSERT INTO recommended_feeds (name, url, site_url, description, icon_url, category, country, language, tags, popularity_score, article_frequency, is_featured) VALUES
-- Technology & Programming
('TechCrunch', 'https://techcrunch.com/feed/', 'https://techcrunch.com', 'The latest technology news and information on startups', 'https://techcrunch.com/favicon.ico', 'Technology', 'US', 'en', '{"startups", "venture capital", "tech news"}', 95, 'hourly', true),
('Hacker News', 'https://hnrss.org/frontpage', 'https://news.ycombinator.com', 'Social news website focusing on computer science and entrepreneurship', 'https://news.ycombinator.com/favicon.ico', 'Technology', 'US', 'en', '{"programming", "startups", "tech"}', 90, 'hourly', true),
('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'https://arstechnica.com', 'Technology news and analysis', 'https://arstechnica.com/favicon.ico', 'Technology', 'US', 'en', '{"science", "technology", "policy"}', 88, 'daily', true),
('The Verge', 'https://www.theverge.com/rss/index.xml', 'https://www.theverge.com', 'Technology, science, art, and culture', 'https://www.theverge.com/favicon.ico', 'Technology', 'US', 'en', '{"consumer tech", "culture", "science"}', 87, 'hourly', true),
('Wired', 'https://www.wired.com/feed/rss', 'https://www.wired.com', 'How emerging technologies affect culture, the economy, and politics', 'https://www.wired.com/favicon.ico', 'Technology', 'US', 'en', '{"future tech", "culture", "politics"}', 85, 'daily', true),
('MIT Technology Review', 'https://www.technologyreview.com/feed/', 'https://www.technologyreview.com', 'The authority on emerging technologies and their impact', 'https://www.technologyreview.com/favicon.ico', 'Technology', 'US', 'en', '{"emerging tech", "research", "innovation"}', 83, 'daily', false),
('Engadget', 'https://www.engadget.com/rss.xml', 'https://www.engadget.com', 'Technology news and reviews', 'https://www.engadget.com/favicon.ico', 'Technology', 'US', 'en', '{"gadgets", "reviews", "consumer tech"}', 82, 'hourly', false),
('ZDNet', 'https://www.zdnet.com/news/rss.xml', 'https://www.zdnet.com', 'Technology news, analysis and research', 'https://www.zdnet.com/favicon.ico', 'Technology', 'US', 'en', '{"enterprise", "business tech", "security"}', 80, 'daily', false),
('VentureBeat', 'https://venturebeat.com/feed/', 'https://venturebeat.com', 'Technology news and events for IT decision-makers', 'https://venturebeat.com/favicon.ico', 'Technology', 'US', 'en', '{"AI", "gaming", "enterprise"}', 78, 'daily', false),
('TechRadar', 'https://www.techradar.com/rss', 'https://www.techradar.com', 'Technology news, reviews and analysis', 'https://www.techradar.com/favicon.ico', 'Technology', 'UK', 'en', '{"reviews", "buying guides", "how-to"}', 76, 'daily', false),

-- Programming & Development
('Stack Overflow Blog', 'https://stackoverflow.blog/feed/', 'https://stackoverflow.blog', 'Essays, opinions, and advice on the act of computer programming', 'https://stackoverflow.com/favicon.ico', 'Programming', 'US', 'en', '{"programming", "developer tools", "community"}', 85, 'weekly', true),
('GitHub Blog', 'https://github.blog/feed/', 'https://github.blog', 'Updates, ideas, and inspiration from GitHub', 'https://github.com/favicon.ico', 'Programming', 'US', 'en', '{"git", "open source", "developer tools"}', 83, 'weekly', true),
('Dev.to', 'https://dev.to/feed', 'https://dev.to', 'A community of software developers getting together to help one another out', 'https://dev.to/favicon.ico', 'Programming', 'US', 'en', '{"programming", "tutorials", "community"}', 80, 'hourly', false),
('CSS-Tricks', 'https://css-tricks.com/feed/', 'https://css-tricks.com', 'Tips, tricks, and techniques on using CSS', 'https://css-tricks.com/favicon.ico', 'Programming', 'US', 'en', '{"CSS", "web development", "frontend"}', 78, 'weekly', false),
('Smashing Magazine', 'https://www.smashingmagazine.com/feed/', 'https://www.smashingmagazine.com', 'For web designers and developers', 'https://www.smashingmagazine.com/favicon.ico', 'Programming', 'DE', 'en', '{"web design", "UX", "frontend"}', 76, 'daily', false),

-- News & Politics
('BBC News', 'https://feeds.bbci.co.uk/news/rss.xml', 'https://www.bbc.com/news', 'Breaking news, sport, TV, radio and a whole lot more', 'https://www.bbc.co.uk/favicon.ico', 'News', 'UK', 'en', '{"world news", "politics", "breaking news"}', 95, 'hourly', true),
('Reuters', 'https://www.reuters.com/rssFeed/worldNews', 'https://www.reuters.com', 'International news and breaking news headlines', 'https://www.reuters.com/favicon.ico', 'News', 'UK', 'en', '{"world news", "business", "politics"}', 93, 'hourly', true),
('Associated Press', 'https://apnews.com/apf-topnews', 'https://apnews.com', 'The definitive source for global and local news', 'https://apnews.com/favicon.ico', 'News', 'US', 'en', '{"breaking news", "politics", "world"}', 92, 'hourly', true),
('NPR News', 'https://feeds.npr.org/1001/rss.xml', 'https://www.npr.org', 'Breaking news, analysis, and daily reporting', 'https://www.npr.org/favicon.ico', 'News', 'US', 'en', '{"public radio", "analysis", "culture"}', 88, 'hourly', true),
('The Guardian', 'https://www.theguardian.com/world/rss', 'https://www.theguardian.com', 'Latest news, sport and comment from the Guardian', 'https://www.theguardian.com/favicon.ico', 'News', 'UK', 'en', '{"progressive", "world news", "environment"}', 87, 'hourly', true),
('CNN', 'http://rss.cnn.com/rss/edition.rss', 'https://www.cnn.com', 'Breaking news and the latest news from the US and around the world', 'https://www.cnn.com/favicon.ico', 'News', 'US', 'en', '{"breaking news", "politics", "international"}', 85, 'hourly', false),
('The New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'https://www.nytimes.com', 'Breaking news, world news, and multimedia', 'https://www.nytimes.com/favicon.ico', 'News', 'US', 'en', '{"quality journalism", "politics", "culture"}', 90, 'hourly', true),
('Washington Post', 'https://feeds.washingtonpost.com/rss/world', 'https://www.washingtonpost.com', 'Breaking news and analysis on politics, business, world national news', 'https://www.washingtonpost.com/favicon.ico', 'News', 'US', 'en', '{"politics", "investigative", "democracy"}', 88, 'hourly', false),

-- Business & Finance
('Financial Times', 'https://www.ft.com/rss/home', 'https://www.ft.com', 'Global financial news, analysis and comment', 'https://www.ft.com/favicon.ico', 'Business', 'UK', 'en', '{"finance", "markets", "global economy"}', 90, 'hourly', true),
('Wall Street Journal', 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', 'https://www.wsj.com', 'Breaking news and analysis from the U.S. and around the world', 'https://www.wsj.com/favicon.ico', 'Business', 'US', 'en', '{"finance", "markets", "business news"}', 92, 'hourly', true),
('Bloomberg', 'https://feeds.bloomberg.com/markets/news.rss', 'https://www.bloomberg.com', 'Business and financial news, analysis and insight', 'https://www.bloomberg.com/favicon.ico', 'Business', 'US', 'en', '{"markets", "finance", "economics"}', 89, 'hourly', true),
('Forbes', 'https://www.forbes.com/real-time/feed2/', 'https://www.forbes.com', 'Business news and financial news', 'https://www.forbes.com/favicon.ico', 'Business', 'US', 'en', '{"entrepreneurship", "investing", "leadership"}', 85, 'daily', false),
('Harvard Business Review', 'https://feeds.hbr.org/harvardbusiness', 'https://hbr.org', 'Management tips and insights for leaders', 'https://hbr.org/favicon.ico', 'Business', 'US', 'en', '{"management", "leadership", "strategy"}', 83, 'weekly', false),

-- Science & Research
('Nature', 'https://www.nature.com/nature.rss', 'https://www.nature.com', 'International weekly journal of science', 'https://www.nature.com/favicon.ico', 'Science', 'UK', 'en', '{"research", "peer review", "scientific discovery"}', 95, 'weekly', true),
('Science Magazine', 'https://www.science.org/rss/news_current.xml', 'https://www.science.org', 'Breaking science news and articles on global research', 'https://www.science.org/favicon.ico', 'Science', 'US', 'en', '{"research", "peer review", "scientific breakthroughs"}', 93, 'weekly', true),
('Scientific American', 'https://rss.sciam.com/ScientificAmerican-Global', 'https://www.scientificamerican.com', 'Science news and technology articles', 'https://www.scientificamerican.com/favicon.ico', 'Science', 'US', 'en', '{"popular science", "research", "technology"}', 88, 'weekly', true),
('New Scientist', 'https://www.newscientist.com/feed/home/', 'https://www.newscientist.com', 'Science news and science articles', 'https://www.newscientist.com/favicon.ico', 'Science', 'UK', 'en', '{"science news", "research", "innovation"}', 85, 'daily', false),
('Phys.org', 'https://phys.org/rss-feed/', 'https://phys.org', 'Science and technology news', 'https://phys.org/favicon.ico', 'Science', 'US', 'en', '{"physics", "technology", "research"}', 80, 'daily', false),

-- Health & Medicine
('The Lancet', 'https://www.thelancet.com/rssfeed/lancet_current.xml', 'https://www.thelancet.com', 'Independent, international general medical journal', 'https://www.thelancet.com/favicon.ico', 'Health', 'UK', 'en', '{"medical research", "public health", "clinical medicine"}', 92, 'weekly', true),
('NEJM', 'https://www.nejm.org/action/showFeed?type=etoc&feed=rss', 'https://www.nejm.org', 'Medical research, review articles, and editorial opinion', 'https://www.nejm.org/favicon.ico', 'Health', 'US', 'en', '{"medical research", "clinical studies", "healthcare"}', 90, 'weekly', true),
('WebMD', 'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', 'https://www.webmd.com', 'Medical information and health advice', 'https://www.webmd.com/favicon.ico', 'Health', 'US', 'en', '{"health advice", "medical information", "wellness"}', 78, 'daily', false),
('Mayo Clinic', 'https://www.mayoclinic.org/rss', 'https://www.mayoclinic.org', 'Medical information and tools for healthy living', 'https://www.mayoclinic.org/favicon.ico', 'Health', 'US', 'en', '{"medical advice", "health tips", "disease information"}', 85, 'weekly', false),

-- Sports
('ESPN', 'https://www.espn.com/espn/rss/news', 'https://www.espn.com', 'Sports news, scores, stats, analysis & highlights', 'https://www.espn.com/favicon.ico', 'Sports', 'US', 'en', '{"sports news", "scores", "highlights"}', 88, 'hourly', true),
('BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml', 'https://www.bbc.com/sport', 'Sports news, live scores, results, fixtures and analysis', 'https://www.bbc.co.uk/favicon.ico', 'Sports', 'UK', 'en', '{"football", "cricket", "rugby"}', 85, 'hourly', true),
('Sky Sports', 'https://www.skysports.com/rss/12040', 'https://www.skysports.com', 'Latest sports news, live scores, results and transfers', 'https://www.skysports.com/favicon.ico', 'Sports', 'UK', 'en', '{"premier league", "football", "cricket"}', 82, 'hourly', false),

-- Entertainment & Culture
('Entertainment Weekly', 'https://ew.com/feed/', 'https://ew.com', 'Entertainment news about movies, TV, music and celebrities', 'https://ew.com/favicon.ico', 'Entertainment', 'US', 'en', '{"movies", "TV", "celebrities"}', 80, 'daily', false),
('Variety', 'https://variety.com/feed/', 'https://variety.com', 'Entertainment industry news', 'https://variety.com/favicon.ico', 'Entertainment', 'US', 'en', '{"Hollywood", "film industry", "TV"}', 82, 'daily', false),
('The Hollywood Reporter', 'https://www.hollywoodreporter.com/feed/', 'https://www.hollywoodreporter.com', 'Entertainment industry news and analysis', 'https://www.hollywoodreporter.com/favicon.ico', 'Entertainment', 'US', 'en', '{"film", "television", "industry news"}', 78, 'daily', false),

-- Gaming
('IGN', 'https://feeds.ign.com/ign/all', 'https://www.ign.com', 'Video game news, reviews, and walkthroughs', 'https://www.ign.com/favicon.ico', 'Gaming', 'US', 'en', '{"video games", "reviews", "gaming news"}', 85, 'daily', true),
('GameSpot', 'https://www.gamespot.com/feeds/mashup/', 'https://www.gamespot.com', 'Video game news, reviews, previews, and more', 'https://www.gamespot.com/favicon.ico', 'Gaming', 'US', 'en', '{"gaming", "reviews", "previews"}', 82, 'daily', false),
('Polygon', 'https://www.polygon.com/rss/index.xml', 'https://www.polygon.com', 'Gaming news, reviews, and more', 'https://www.polygon.com/favicon.ico', 'Gaming', 'US', 'en', '{"gaming culture", "reviews", "features"}', 80, 'daily', false),
('Kotaku', 'https://kotaku.com/rss', 'https://kotaku.com', 'Gaming news and culture', 'https://kotaku.com/favicon.ico', 'Gaming', 'US', 'en', '{"gaming culture", "news", "opinion"}', 78, 'daily', false),

-- Lifestyle & Fashion
('Vogue', 'https://www.vogue.com/feed/rss', 'https://www.vogue.com', 'Fashion, beauty, and culture', 'https://www.vogue.com/favicon.ico', 'Lifestyle', 'US', 'en', '{"fashion", "beauty", "culture"}', 85, 'daily', true),
('GQ', 'https://www.gq.com/feed/rss', 'https://www.gq.com', 'Style, culture, and beyond', 'https://www.gq.com/favicon.ico', 'Lifestyle', 'US', 'en', '{"mens fashion", "style", "culture"}', 80, 'daily', false),
('Elle', 'https://www.elle.com/rss/all.xml/', 'https://www.elle.com', 'Fashion, beauty, and culture for women', 'https://www.elle.com/favicon.ico', 'Lifestyle', 'US', 'en', '{"womens fashion", "beauty", "lifestyle"}', 78, 'daily', false),

-- Food & Cooking
('Food Network', 'https://www.foodnetwork.com/feeds/all/rss.xml', 'https://www.foodnetwork.com', 'Recipes, cooking tips, and food news', 'https://www.foodnetwork.com/favicon.ico', 'Food', 'US', 'en', '{"recipes", "cooking", "food shows"}', 82, 'daily', true),
('Bon Appétit', 'https://www.bonappetit.com/feed/rss', 'https://www.bonappetit.com', 'Recipes, restaurant reviews, and food culture', 'https://www.bonappetit.com/favicon.ico', 'Food', 'US', 'en', '{"recipes", "restaurant reviews", "food culture"}', 80, 'daily', false),
('Serious Eats', 'https://feeds.feedburner.com/seriouseats/recipes', 'https://www.seriouseats.com', 'Food science and cooking techniques', 'https://www.seriouseats.com/favicon.ico', 'Food', 'US', 'en', '{"food science", "recipes", "techniques"}', 85, 'weekly', true),

-- Travel
('Lonely Planet', 'https://www.lonelyplanet.com/rss/news.xml', 'https://www.lonelyplanet.com', 'Travel guides and destination information', 'https://www.lonelyplanet.com/favicon.ico', 'Travel', 'AU', 'en', '{"travel guides", "destinations", "travel tips"}', 85, 'weekly', true),
('Travel + Leisure', 'https://www.travelandleisure.com/syndication/feed', 'https://www.travelandleisure.com', 'Travel inspiration and guides', 'https://www.travelandleisure.com/favicon.ico', 'Travel', 'US', 'en', '{"luxury travel", "destinations", "hotels"}', 80, 'daily', false),
('National Geographic Travel', 'https://www.nationalgeographic.com/travel/rss/', 'https://www.nationalgeographic.com/travel', 'Travel photography and destination stories', 'https://www.nationalgeographic.com/favicon.ico', 'Travel', 'US', 'en', '{"photography", "adventure travel", "culture"}', 88, 'weekly', true),

-- International News Sources
('Al Jazeera English', 'https://www.aljazeera.com/xml/rss/all.xml', 'https://www.aljazeera.com', 'Breaking news, world news and video from Al Jazeera', 'https://www.aljazeera.com/favicon.ico', 'News', 'QA', 'en', '{"middle east", "world news", "international"}', 82, 'hourly', false),
('Deutsche Welle', 'https://rss.dw.com/xml/rss-en-all', 'https://www.dw.com', 'News and analysis from Germany and Europe', 'https://www.dw.com/favicon.ico', 'News', 'DE', 'en', '{"european news", "germany", "international"}', 78, 'hourly', false),
('France24', 'https://www.france24.com/en/rss', 'https://www.france24.com', 'International news and current affairs', 'https://www.france24.com/favicon.ico', 'News', 'FR', 'en', '{"french perspective", "international", "europe"}', 76, 'hourly', false),

-- Cryptocurrency & Blockchain
('CoinDesk', 'https://feeds.coindesk.com/coindesk/rss', 'https://www.coindesk.com', 'Bitcoin and cryptocurrency news', 'https://www.coindesk.com/favicon.ico', 'Cryptocurrency', 'US', 'en', '{"bitcoin", "blockchain", "crypto news"}', 88, 'hourly', true),
('Cointelegraph', 'https://cointelegraph.com/rss', 'https://cointelegraph.com', 'Cryptocurrency and blockchain news', 'https://cointelegraph.com/favicon.ico', 'Cryptocurrency', 'US', 'en', '{"cryptocurrency", "blockchain", "DeFi"}', 85, 'hourly', true),
('The Block', 'https://www.theblockcrypto.com/rss.xml', 'https://www.theblockcrypto.com', 'Cryptocurrency and blockchain research', 'https://www.theblockcrypto.com/favicon.ico', 'Cryptocurrency', 'US', 'en', '{"crypto research", "institutional", "markets"}', 82, 'daily', false),

-- Environment & Climate
('Climate Central', 'https://www.climatecentral.org/rss.xml', 'https://www.climatecentral.org', 'Climate science and news', 'https://www.climatecentral.org/favicon.ico', 'Environment', 'US', 'en', '{"climate science", "global warming", "research"}', 85, 'weekly', true),
('Environmental News Network', 'https://www.enn.com/rss', 'https://www.enn.com', 'Environmental news and information', 'https://www.enn.com/favicon.ico', 'Environment', 'US', 'en', '{"environment", "sustainability", "conservation"}', 75, 'daily', false),

-- Design & Creativity
('Creative Bloq', 'https://www.creativebloq.com/feed', 'https://www.creativebloq.com', 'Art and design inspiration', 'https://www.creativebloq.com/favicon.ico', 'Design', 'UK', 'en', '{"graphic design", "web design", "creativity"}', 80, 'daily', true),
('Behance', 'https://feeds.feedburner.com/behance/vorr', 'https://www.behance.net', 'Creative portfolios and inspiration', 'https://www.behance.net/favicon.ico', 'Design', 'US', 'en', '{"portfolios", "creative work", "inspiration"}', 78, 'daily', false),
('Dribbble', 'https://dribbble.com/shots/popular.rss', 'https://dribbble.com', 'Design inspiration and portfolios', 'https://dribbble.com/favicon.ico', 'Design', 'US', 'en', '{"UI design", "inspiration", "portfolios"}', 76, 'daily', false),

-- Artificial Intelligence & Machine Learning
('AI News', 'https://www.artificialintelligence-news.com/feed/', 'https://www.artificialintelligence-news.com', 'Latest AI and machine learning news', 'https://www.artificialintelligence-news.com/favicon.ico', 'AI', 'UK', 'en', '{"artificial intelligence", "machine learning", "AI news"}', 85, 'daily', true),
('OpenAI Blog', 'https://openai.com/blog/rss.xml', 'https://openai.com/blog', 'Research and updates from OpenAI', 'https://openai.com/favicon.ico', 'AI', 'US', 'en', '{"AI research", "GPT", "machine learning"}', 90, 'weekly', true),
('Google AI Blog', 'https://ai.googleblog.com/feeds/posts/default', 'https://ai.googleblog.com', 'Latest news from Google AI', 'https://ai.googleblog.com/favicon.ico', 'AI', 'US', 'en', '{"Google AI", "research", "machine learning"}', 88, 'weekly', true),

-- Productivity & Self-Improvement
('Lifehacker', 'https://lifehacker.com/rss', 'https://lifehacker.com', 'Tips and downloads for getting things done', 'https://lifehacker.com/favicon.ico', 'Productivity', 'US', 'en', '{"productivity", "life hacks", "tips"}', 82, 'daily', true),
('Getting Things Done', 'https://gettingthingsdone.com/feed/', 'https://gettingthingsdone.com', 'Productivity methodology and tips', 'https://gettingthingsdone.com/favicon.ico', 'Productivity', 'US', 'en', '{"GTD", "productivity", "organization"}', 75, 'weekly', false),

-- Regional News Sources
-- UK
('The Times', 'https://www.thetimes.co.uk/rss', 'https://www.thetimes.co.uk', 'News and opinion from The Times', 'https://www.thetimes.co.uk/favicon.ico', 'News', 'UK', 'en', '{"UK news", "politics", "quality journalism"}', 85, 'hourly', false),
('The Independent', 'https://www.independent.co.uk/rss', 'https://www.independent.co.uk', 'Latest news, sport and comment', 'https://www.independent.co.uk/favicon.ico', 'News', 'UK', 'en', '{"UK news", "independent journalism", "politics"}', 80, 'hourly', false),

-- Canada
('CBC News', 'https://rss.cbc.ca/lineup/topstories.xml', 'https://www.cbc.ca/news', 'Canadian and world news', 'https://www.cbc.ca/favicon.ico', 'News', 'CA', 'en', '{"canadian news", "public broadcasting", "world news"}', 85, 'hourly', true),
('Globe and Mail', 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/news/', 'https://www.theglobeandmail.com', 'Canadian news and analysis', 'https://www.theglobeandmail.com/favicon.ico', 'News', 'CA', 'en', '{"canadian news", "business", "politics"}', 82, 'hourly', false),

-- Australia
('ABC News Australia', 'https://www.abc.net.au/news/feed/51120/rss.xml', 'https://www.abc.net.au/news', 'Australian and international news', 'https://www.abc.net.au/favicon.ico', 'News', 'AU', 'en', '{"australian news", "public broadcasting", "asia pacific"}', 85, 'hourly', true),
('The Australian', 'https://www.theaustralian.com.au/rss', 'https://www.theaustralian.com.au', 'Australian news and analysis', 'https://www.theaustralian.com.au/favicon.ico', 'News', 'AU', 'en', '{"australian news", "business", "politics"}', 80, 'hourly', false),

-- India
('The Hindu', 'https://www.thehindu.com/feeder/default.rss', 'https://www.thehindu.com', 'Indian news and analysis', 'https://www.thehindu.com/favicon.ico', 'News', 'IN', 'en', '{"indian news", "south asia", "politics"}', 85, 'hourly', true),
('Times of India', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://timesofindia.indiatimes.com', 'Latest news from India and world', 'https://timesofindia.indiatimes.com/favicon.ico', 'News', 'IN', 'en', '{"indian news", "bollywood", "cricket"}', 82, 'hourly', false),

-- Niche Technology
('AnandTech', 'https://www.anandtech.com/rss/', 'https://www.anandtech.com', 'Hardware reviews and analysis', 'https://www.anandtech.com/favicon.ico', 'Technology', 'US', 'en', '{"hardware", "reviews", "benchmarks"}', 85, 'weekly', true),
('Tom''s Hardware', 'https://www.tomshardware.com/feeds/all', 'https://www.tomshardware.com', 'Hardware news and reviews', 'https://www.tomshardware.com/favicon.ico', 'Technology', 'US', 'en', '{"PC hardware", "reviews", "guides"}', 82, 'daily', false),
('9to5Mac', 'https://9to5mac.com/feed/', 'https://9to5mac.com', 'Apple news and rumors', 'https://9to5mac.com/favicon.ico', 'Technology', 'US', 'en', '{"Apple", "iPhone", "Mac"}', 80, 'daily', false),
('Android Police', 'https://www.androidpolice.com/feed/', 'https://www.androidpolice.com', 'Android news and reviews', 'https://www.androidpolice.com/favicon.ico', 'Technology', 'US', 'en', '{"Android", "Google", "mobile"}', 78, 'daily', false),

-- Security & Privacy
('Krebs on Security', 'https://krebsonsecurity.com/feed/', 'https://krebsonsecurity.com', 'In-depth security news and investigation', 'https://krebsonsecurity.com/favicon.ico', 'Security', 'US', 'en', '{"cybersecurity", "data breaches", "investigation"}', 88, 'weekly', true),
('Schneier on Security', 'https://www.schneier.com/feed/', 'https://www.schneier.com', 'Security technologist Bruce Schneier''s blog', 'https://www.schneier.com/favicon.ico', 'Security', 'US', 'en', '{"security analysis", "privacy", "cryptography"}', 85, 'weekly', true),
('The Hacker News', 'https://feeds.feedburner.com/TheHackersNews', 'https://thehackernews.com', 'Cybersecurity news and analysis', 'https://thehackernews.com/favicon.ico', 'Security', 'US', 'en', '{"cybersecurity", "hacking", "data breaches"}', 82, 'daily', false),

-- Space & Astronomy
('NASA News', 'https://www.nasa.gov/rss/dyn/breaking_news.rss', 'https://www.nasa.gov', 'Latest NASA news and discoveries', 'https://www.nasa.gov/favicon.ico', 'Space', 'US', 'en', '{"space exploration", "NASA", "astronomy"}', 90, 'weekly', true),
('Space.com', 'https://www.space.com/feeds/all', 'https://www.space.com', 'Space news and astronomy', 'https://www.space.com/favicon.ico', 'Space', 'US', 'en', '{"space news", "astronomy", "space exploration"}', 85, 'daily', true),
('SpaceX', 'https://www.spacex.com/news.rss', 'https://www.spacex.com', 'SpaceX news and updates', 'https://www.spacex.com/favicon.ico', 'Space', 'US', 'en', '{"SpaceX", "rockets", "Mars"}', 88, 'weekly', false),

-- Philosophy & Ideas
('Aeon', 'https://aeon.co/feed.rss', 'https://aeon.co', 'Ideas and culture', 'https://aeon.co/favicon.ico', 'Philosophy', 'UK', 'en', '{"philosophy", "ideas", "culture"}', 85, 'weekly', true),
('Brain Pickings', 'https://www.brainpickings.org/feed/', 'https://www.brainpickings.org', 'Cross-disciplinary interestingness', 'https://www.brainpickings.org/favicon.ico', 'Philosophy', 'US', 'en', '{"literature", "philosophy", "creativity"}', 82, 'weekly', false),

-- Economics
('The Economist', 'https://www.economist.com/rss', 'https://www.economist.com', 'News and analysis on world politics and economics', 'https://www.economist.com/favicon.ico', 'Economics', 'UK', 'en', '{"economics", "politics", "global affairs"}', 92, 'weekly', true),
('Marginal Revolution', 'https://marginalrevolution.com/feed', 'https://marginalrevolution.com', 'Economics blog by Tyler Cowen and Alex Tabarrok', 'https://marginalrevolution.com/favicon.ico', 'Economics', 'US', 'en', '{"economics", "policy", "culture"}', 80, 'daily', false),

-- Open Source & Linux
('Phoronix', 'https://www.phoronix.com/rss.php', 'https://www.phoronix.com', 'Linux hardware reviews and news', 'https://www.phoronix.com/favicon.ico', 'Linux', 'US', 'en', '{"Linux", "open source", "hardware"}', 82, 'daily', true),
('OMG! Ubuntu!', 'https://www.omgubuntu.co.uk/feed', 'https://www.omgubuntu.co.uk', 'Ubuntu Linux news and tutorials', 'https://www.omgubuntu.co.uk/favicon.ico', 'Linux', 'UK', 'en', '{"Ubuntu", "Linux", "tutorials"}', 78, 'daily', false),
('It''s FOSS', 'https://itsfoss.com/rss/', 'https://itsfoss.com', 'Linux and open source news', 'https://itsfoss.com/favicon.ico', 'Linux', 'IN', 'en', '{"Linux", "FOSS", "tutorials"}', 80, 'daily', false),

-- Photography
('PetaPixel', 'https://petapixel.com/feed/', 'https://petapixel.com', 'Photography news and tutorials', 'https://petapixel.com/favicon.ico', 'Photography', 'US', 'en', '{"photography", "camera reviews", "tutorials"}', 82, 'daily', true),
('Digital Photography School', 'https://digital-photography-school.com/feed/', 'https://digital-photography-school.com', 'Photography tips and tutorials', 'https://digital-photography-school.com/favicon.ico', 'Photography', 'AU', 'en', '{"photography tips", "tutorials", "techniques"}', 80, 'daily', false),

-- Automotive
('Motor Trend', 'https://www.motortrend.com/feed/', 'https://www.motortrend.com', 'Automotive news and reviews', 'https://www.motortrend.com/favicon.ico', 'Automotive', 'US', 'en', '{"cars", "automotive", "reviews"}', 82, 'daily', true),
('Car and Driver', 'https://www.caranddriver.com/rss/all.xml/', 'https://www.caranddriver.com', 'Car reviews and automotive news', 'https://www.caranddriver.com/favicon.ico', 'Automotive', 'US', 'en', '{"car reviews", "automotive news", "road tests"}', 80, 'daily', false),
('Top Gear', 'https://www.topgear.com/rss', 'https://www.topgear.com', 'Car reviews and motoring news', 'https://www.topgear.com/favicon.ico', 'Automotive', 'UK', 'en', '{"supercars", "reviews", "motoring"}', 85, 'daily', true),

-- Music
('Pitchfork', 'https://pitchfork.com/rss/news/', 'https://pitchfork.com', 'Music reviews and news', 'https://pitchfork.com/favicon.ico', 'Music', 'US', 'en', '{"indie music", "reviews", "music news"}', 85, 'daily', true),
('Rolling Stone', 'https://www.rollingstone.com/feed/', 'https://www.rollingstone.com', 'Music, politics and pop culture', 'https://www.rollingstone.com/favicon.ico', 'Music', 'US', 'en', '{"music news", "pop culture", "politics"}', 82, 'daily', false),
('Billboard', 'https://www.billboard.com/feed/', 'https://www.billboard.com', 'Music industry news and charts', 'https://www.billboard.com/favicon.ico', 'Music', 'US', 'en', '{"music industry", "charts", "pop music"}', 80, 'daily', false);