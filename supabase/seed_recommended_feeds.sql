-- Seed recommended feeds data for Cronkite
-- This populates the recommended_feeds table with feeds that match frontend categories

-- Clear existing data
DELETE FROM recommended_feeds;

-- Insert recommended feeds with categories matching frontend IDs
INSERT INTO recommended_feeds (name, url, site_url, description, icon_url, category, country, language, tags, popularity_score, article_frequency, is_featured) VALUES

-- Tech category feeds
('TechCrunch', 'https://techcrunch.com/feed/', 'https://techcrunch.com', 'The latest technology news and information on startups', 'https://techcrunch.com/favicon.ico', 'tech', 'US', 'en', ARRAY['technology', 'startups', 'venture capital'], 95, 'hourly', true),
('The Verge', 'https://www.theverge.com/rss/index.xml', 'https://www.theverge.com', 'Technology, science, art, and culture', 'https://www.theverge.com/favicon.ico', 'tech', 'US', 'en', ARRAY['technology', 'science', 'culture'], 90, 'daily', true),
('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'https://arstechnica.com', 'Technology news and analysis', 'https://arstechnica.com/favicon.ico', 'tech', 'US', 'en', ARRAY['technology', 'science', 'analysis'], 85, 'daily', false),
('Wired', 'https://www.wired.com/feed/rss', 'https://www.wired.com', 'Ideas, breakthroughs, and the future', 'https://www.wired.com/favicon.ico', 'tech', 'US', 'en', ARRAY['technology', 'future', 'innovation'], 88, 'daily', true),

-- News category feeds
('BBC News', 'http://feeds.bbci.co.uk/news/rss.xml', 'https://www.bbc.com/news', 'Breaking news, sport, TV, radio and a whole lot more', 'https://www.bbc.com/favicon.ico', 'news', 'UK', 'en', ARRAY['news', 'world', 'politics'], 98, 'hourly', true),
('Reuters', 'https://feeds.reuters.com/reuters/topNews', 'https://www.reuters.com', 'Breaking international news and headlines', 'https://www.reuters.com/favicon.ico', 'news', 'US', 'en', ARRAY['news', 'international', 'breaking'], 96, 'hourly', true),
('Associated Press', 'https://feeds.apnews.com/rss/apf-topnews', 'https://apnews.com', 'The definitive source for global and local news', 'https://apnews.com/favicon.ico', 'news', 'US', 'en', ARRAY['news', 'breaking', 'global'], 94, 'hourly', true),

-- Business category feeds
('Wall Street Journal', 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', 'https://www.wsj.com', 'Breaking news and analysis from the U.S. and around the world', 'https://www.wsj.com/favicon.ico', 'business', 'US', 'en', ARRAY['business', 'finance', 'markets'], 92, 'hourly', true),
('Financial Times', 'https://www.ft.com/rss/home', 'https://www.ft.com', 'Global financial news and analysis', 'https://www.ft.com/favicon.ico', 'business', 'UK', 'en', ARRAY['business', 'finance', 'global'], 90, 'daily', true),
('Bloomberg', 'https://feeds.bloomberg.com/markets/news.rss', 'https://www.bloomberg.com', 'Business and financial news', 'https://www.bloomberg.com/favicon.ico', 'business', 'US', 'en', ARRAY['business', 'markets', 'finance'], 88, 'hourly', true),

-- Science category feeds
('Scientific American', 'https://rss.sciam.com/ScientificAmerican-Global', 'https://www.scientificamerican.com', 'Science news and research', 'https://www.scientificamerican.com/favicon.ico', 'science', 'US', 'en', ARRAY['science', 'research', 'discovery'], 85, 'daily', true),
('Nature', 'https://www.nature.com/nature.rss', 'https://www.nature.com', 'International journal of science', 'https://www.nature.com/favicon.ico', 'science', 'UK', 'en', ARRAY['science', 'research', 'journal'], 90, 'weekly', true),

-- Sports category feeds
('ESPN', 'https://www.espn.com/espn/rss/news', 'https://www.espn.com', 'Sports news and analysis', 'https://www.espn.com/favicon.ico', 'sports', 'US', 'en', ARRAY['sports', 'news', 'analysis'], 92, 'hourly', true),
('BBC Sport', 'http://feeds.bbci.co.uk/sport/rss.xml', 'https://www.bbc.com/sport', 'Sports news from the BBC', 'https://www.bbc.com/favicon.ico', 'sports', 'UK', 'en', ARRAY['sports', 'news', 'bbc'], 88, 'hourly', true),

-- Gaming category feeds
('IGN', 'https://feeds.ign.com/ign/games-all', 'https://www.ign.com', 'Video game news and reviews', 'https://www.ign.com/favicon.ico', 'gaming', 'US', 'en', ARRAY['gaming', 'reviews', 'news'], 85, 'daily', true),
('GameSpot', 'https://www.gamespot.com/feeds/mashup/', 'https://www.gamespot.com', 'Video game news, reviews, and guides', 'https://www.gamespot.com/favicon.ico', 'gaming', 'US', 'en', ARRAY['gaming', 'reviews', 'guides'], 82, 'daily', false),

-- Movies category feeds
('The Hollywood Reporter', 'https://www.hollywoodreporter.com/feed/', 'https://www.hollywoodreporter.com', 'Entertainment news and analysis', 'https://www.hollywoodreporter.com/favicon.ico', 'movies', 'US', 'en', ARRAY['movies', 'entertainment', 'hollywood'], 88, 'daily', true),
('Variety', 'https://variety.com/feed/', 'https://variety.com', 'Entertainment news and analysis', 'https://variety.com/favicon.ico', 'movies', 'US', 'en', ARRAY['movies', 'entertainment', 'industry'], 85, 'daily', true),

-- Music category feeds
('Rolling Stone', 'https://www.rollingstone.com/feed/', 'https://www.rollingstone.com', 'Music news and culture', 'https://www.rollingstone.com/favicon.ico', 'music', 'US', 'en', ARRAY['music', 'culture', 'news'], 85, 'daily', true),
('Pitchfork', 'https://pitchfork.com/rss/news/', 'https://pitchfork.com', 'Music reviews and news', 'https://pitchfork.com/favicon.ico', 'music', 'US', 'en', ARRAY['music', 'reviews', 'indie'], 80, 'daily', false),

-- Programming category feeds
('Hacker News', 'https://hnrss.org/frontpage', 'https://news.ycombinator.com', 'Social news website focusing on computer science and entrepreneurship', 'https://news.ycombinator.com/favicon.ico', 'programming', 'US', 'en', ARRAY['programming', 'startups', 'tech'], 95, 'hourly', true),
('Stack Overflow Blog', 'https://stackoverflow.blog/feed/', 'https://stackoverflow.blog', 'Programming and developer community news', 'https://stackoverflow.com/favicon.ico', 'programming', 'US', 'en', ARRAY['programming', 'development', 'community'], 88, 'weekly', true),

-- Design category feeds
('Smashing Magazine', 'https://www.smashingmagazine.com/feed/', 'https://www.smashingmagazine.com', 'Web design and development', 'https://www.smashingmagazine.com/favicon.ico', 'design', 'DE', 'en', ARRAY['design', 'web', 'development'], 85, 'daily', true),
('A List Apart', 'https://alistapart.com/main/feed/', 'https://alistapart.com', 'Web design and development', 'https://alistapart.com/favicon.ico', 'design', 'US', 'en', ARRAY['design', 'web', 'standards'], 82, 'weekly', false),

-- Space category feeds
('NASA News', 'https://www.nasa.gov/rss/dyn/breaking_news.rss', 'https://www.nasa.gov', 'NASA news and updates', 'https://www.nasa.gov/favicon.ico', 'space', 'US', 'en', ARRAY['space', 'nasa', 'science'], 90, 'daily', true),
('SpaceX', 'https://www.spacex.com/news.rss', 'https://www.spacex.com', 'SpaceX news and updates', 'https://www.spacex.com/favicon.ico', 'space', 'US', 'en', ARRAY['space', 'spacex', 'rockets'], 85, 'weekly', true),

-- Food category feeds
('Food & Wine', 'https://www.foodandwine.com/syndication/feed', 'https://www.foodandwine.com', 'Food and cooking news', 'https://www.foodandwine.com/favicon.ico', 'food', 'US', 'en', ARRAY['food', 'cooking', 'recipes'], 80, 'daily', false),
('Bon Appétit', 'https://www.bonappetit.com/feed/rss', 'https://www.bonappetit.com', 'Food and cooking magazine', 'https://www.bonappetit.com/favicon.ico', 'food', 'US', 'en', ARRAY['food', 'cooking', 'magazine'], 78, 'daily', false),

-- Travel category feeds
('Lonely Planet', 'https://www.lonelyplanet.com/news/feed/rss/', 'https://www.lonelyplanet.com', 'Travel guides and news', 'https://www.lonelyplanet.com/favicon.ico', 'travel', 'AU', 'en', ARRAY['travel', 'guides', 'destinations'], 85, 'daily', true),
('Travel + Leisure', 'https://www.travelandleisure.com/syndication/feed', 'https://www.travelandleisure.com', 'Travel news and guides', 'https://www.travelandleisure.com/favicon.ico', 'travel', 'US', 'en', ARRAY['travel', 'leisure', 'destinations'], 82, 'daily', false);

-- Log the number of feeds inserted
SELECT 'Recommended feeds seeded successfully. Total count:' as message, COUNT(*) as count FROM recommended_feeds;