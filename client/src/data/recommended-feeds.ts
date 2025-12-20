export interface RecommendedFeed {
  id: string;
  name: string;
  url: string; // Mock URL
  description: string;
  category: string;
  articlesPerDay: number;
  isPopular: boolean;
}

export const RECOMMENDED_FEEDS: RecommendedFeed[] = [
  // Tech
  { id: 'techcrunch', name: 'TechCrunch', category: 'tech', description: 'Latest technology news and startups', url: 'https://techcrunch.com/feed', articlesPerDay: 15, isPopular: true },
  { id: 'arstechnica', name: 'Ars Technica', category: 'tech', description: 'Technology, science, and culture', url: 'https://arstechnica.com/feed', articlesPerDay: 12, isPopular: true },
  { id: 'theverge', name: 'The Verge', category: 'tech', description: 'Technology, science, art, and culture', url: 'https://www.theverge.com/rss/index.xml', articlesPerDay: 20, isPopular: true },
  { id: 'wired', name: 'Wired', category: 'tech', description: 'In-depth technology coverage', url: 'https://www.wired.com/feed/rss', articlesPerDay: 10, isPopular: false },

  // Business
  { id: 'bloomberg', name: 'Bloomberg', category: 'business', description: 'Global business and financial news', url: 'https://www.bloomberg.com/feed', articlesPerDay: 30, isPopular: true },
  { id: 'wsj', name: 'Wall Street Journal', category: 'business', description: 'Breaking news and analysis', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', articlesPerDay: 25, isPopular: true },

  // Gaming
  { id: 'kotaku', name: 'Kotaku', category: 'gaming', description: 'Gaming news, reviews, and culture', url: 'https://kotaku.com/rss', articlesPerDay: 18, isPopular: true },
  { id: 'ign', name: 'IGN', category: 'gaming', description: 'Video game news and reviews', url: 'https://feeds.ign.com/ign/news', articlesPerDay: 25, isPopular: true },
  { id: 'polygon', name: 'Polygon', category: 'gaming', description: 'Gaming news, reviews, and features', url: 'https://www.polygon.com/rss/index.xml', articlesPerDay: 15, isPopular: false },

  // News
  { id: 'bbc', name: 'BBC News', category: 'news', description: 'International news and analysis', url: 'http://feeds.bbci.co.uk/news/rss.xml', articlesPerDay: 50, isPopular: true },
  { id: 'nytimes', name: 'New York Times', category: 'news', description: 'Breaking news and multimedia', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', articlesPerDay: 40, isPopular: true },
  { id: 'guardian', name: 'The Guardian', category: 'news', description: 'Top stories and analysis', url: 'https://www.theguardian.com/world/rss', articlesPerDay: 45, isPopular: false },
  
  // Science
  { id: 'sciam', name: 'Scientific American', category: 'science', description: 'Latest science news', url: 'https://rss.sciam.com/scientificamerican/basic', articlesPerDay: 8, isPopular: true },
  
  // Space
  { id: 'nasa', name: 'NASA Breaking News', category: 'space', description: 'Mission updates and images', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', articlesPerDay: 3, isPopular: true },
  
  // Programming
  { id: 'hackernews', name: 'Hacker News', category: 'programming', description: 'Top tech stories', url: 'https://news.ycombinator.com/rss', articlesPerDay: 30, isPopular: true },
  { id: 'css-tricks', name: 'CSS-Tricks', category: 'programming', description: 'Tips and tricks for web designers', url: 'https://css-tricks.com/feed', articlesPerDay: 1, isPopular: true },

  // Music
  { id: 'pitchfork', name: 'Pitchfork', category: 'music', description: 'Music reviews and news', url: 'https://pitchfork.com/rss/news', articlesPerDay: 10, isPopular: true },

  // Movies
  { id: 'slashfilm', name: '/Film', category: 'movies', description: 'Movie news and reviews', url: 'https://www.slashfilm.com/feed', articlesPerDay: 12, isPopular: true },

  // Food
  { id: 'seriouseats', name: 'Serious Eats', category: 'food', description: 'Recipes and food science', url: 'https://www.seriouseats.com/atom.xml', articlesPerDay: 5, isPopular: true },
  
  // Travel
  { id: 'cntraveler', name: 'Condé Nast Traveler', category: 'travel', description: 'Luxury travel guide', url: 'https://www.cntraveler.com/feed/rss', articlesPerDay: 4, isPopular: true },
  
  // Design
  { id: 'smashing', name: 'Smashing Magazine', category: 'design', description: 'Web design and development', url: 'https://www.smashingmagazine.com/feed', articlesPerDay: 1, isPopular: true },
  
  // Android
  { id: 'androidauthority', name: 'Android Authority', category: 'android', description: 'Android news and reviews', url: 'https://www.androidauthority.com/feed', articlesPerDay: 15, isPopular: true },
  
  // Apple
  { id: 'macrumors', name: 'MacRumors', category: 'apple', description: 'Apple news and rumors', url: 'https://www.macrumors.com/macrumors.xml', articlesPerDay: 15, isPopular: true },
];
