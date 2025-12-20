export interface BrowseFeed {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  articlesPerDay: number;
  icon?: string;
}

export const BROWSE_FEEDS: BrowseFeed[] = [
  // Tech
  { id: 'browse-tc', name: 'TechCrunch', url: 'https://techcrunch.com/feed', description: 'Startup and technology news', category: 'tech', articlesPerDay: 15 },
  { id: 'browse-ars', name: 'Ars Technica', url: 'https://arstechnica.com/feed', description: 'Technology, science, and culture', category: 'tech', articlesPerDay: 12 },
  { id: 'browse-verge', name: 'The Verge', url: 'https://theverge.com/rss/index.xml', description: 'Tech, science, art, and culture', category: 'tech', articlesPerDay: 20 },
  { id: 'browse-wired', name: 'Wired', url: 'https://wired.com/feed/rss', description: 'In-depth technology coverage', category: 'tech', articlesPerDay: 10 },
  { id: 'browse-engadget', name: 'Engadget', url: 'https://engadget.com/rss.xml', description: 'Gadgets and consumer electronics', category: 'tech', articlesPerDay: 18 },

  // News
  { id: 'browse-bbc', name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', description: 'International news and analysis', category: 'news', articlesPerDay: 50 },
  { id: 'browse-nyt', name: 'NY Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', description: 'Breaking news and multimedia', category: 'news', articlesPerDay: 40 },
  { id: 'browse-npr', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', description: 'News, arts, and life', category: 'news', articlesPerDay: 35 },
  { id: 'browse-cnn', name: 'CNN', url: 'http://rss.cnn.com/rss/edition.rss', description: 'Breaking news and video', category: 'news', articlesPerDay: 45 },

  // Dev
  { id: 'browse-hn', name: 'Hacker News', url: 'https://news.ycombinator.com/rss', description: 'Top tech stories', category: 'dev', articlesPerDay: 30 },
  { id: 'browse-devto', name: 'DEV Community', url: 'https://dev.to/feed', description: 'A constructive and inclusive social network for software developers', category: 'dev', articlesPerDay: 25 },
  { id: 'browse-css', name: 'CSS-Tricks', url: 'https://css-tricks.com/feed', description: 'Tips and tricks for web designers', category: 'dev', articlesPerDay: 1 },
  { id: 'browse-smashing', name: 'Smashing Mag', url: 'https://www.smashingmagazine.com/feed', description: 'Web design and development', category: 'dev', articlesPerDay: 1 },

  // Gaming
  { id: 'browse-kotaku', name: 'Kotaku', url: 'https://kotaku.com/rss', description: 'Gaming news, reviews, and culture', category: 'gaming', articlesPerDay: 18 },
  { id: 'browse-ign', name: 'IGN', url: 'https://feeds.ign.com/ign/news', description: 'Video game news and reviews', category: 'gaming', articlesPerDay: 25 },
  { id: 'browse-poly', name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', description: 'Gaming news, reviews, and features', category: 'gaming', articlesPerDay: 15 },

  // Science
  { id: 'browse-nasa', name: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', description: 'Space exploration news', category: 'science', articlesPerDay: 3 },
  { id: 'browse-sciam', name: 'Scientific American', url: 'https://rss.sciam.com/scientificamerican/basic', description: 'Science news and analysis', category: 'science', articlesPerDay: 5 },
];

export const CATEGORIES_FILTER = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'tech', label: 'Tech', icon: '📱' },
  { id: 'news', label: 'News', icon: '📰' },
  { id: 'dev', label: 'Dev', icon: '💻' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'business', label: 'Business', icon: '💼' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'lifestyle', label: 'Lifestyle', icon: '✨' },
  { id: 'regional', label: 'Regional', icon: '🌍' },
];
