export interface Feed {
  id: string;
  name: string;
  url: string;
  lastSync: Date;
  articlesPerDay: number;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'error';
  folder: string;
  errorMessage?: string;
  icon?: string;
}

export const MOCK_FEEDS: Feed[] = [
  // Tech
  {
    id: 'f1',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed',
    lastSync: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
    articlesPerDay: 15,
    priority: 'high',
    status: 'active',
    folder: 'Tech'
  },
  {
    id: 'f2',
    name: 'Ars Technica',
    url: 'https://arstechnica.com/feed',
    lastSync: new Date(Date.now() - 1000 * 60 * 12), // 12 min ago
    articlesPerDay: 12,
    priority: 'medium',
    status: 'active',
    folder: 'Tech'
  },
  {
    id: 'f3',
    name: 'The Verge',
    url: 'https://theverge.com/rss/index.xml',
    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    articlesPerDay: 20,
    priority: 'medium',
    status: 'error',
    errorMessage: '403 Forbidden',
    folder: 'Tech'
  },
  {
    id: 'f4',
    name: 'Wired',
    url: 'https://wired.com/feed/rss',
    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    articlesPerDay: 10,
    priority: 'low',
    status: 'paused',
    folder: 'Tech'
  },
  
  // News
  {
    id: 'f5',
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    lastSync: new Date(Date.now() - 1000 * 60 * 30),
    articlesPerDay: 50,
    priority: 'high',
    status: 'active',
    folder: 'News'
  },
  {
    id: 'f6',
    name: 'NPR',
    url: 'https://feeds.npr.org/1001/rss.xml',
    lastSync: new Date(Date.now() - 1000 * 60 * 45),
    articlesPerDay: 40,
    priority: 'medium',
    status: 'active',
    folder: 'News'
  },

  // Gaming
  {
    id: 'f7',
    name: 'Kotaku',
    url: 'https://kotaku.com/rss',
    lastSync: new Date(Date.now() - 1000 * 60 * 15),
    articlesPerDay: 18,
    priority: 'medium',
    status: 'active',
    folder: 'Gaming'
  },
  {
    id: 'f8',
    name: 'IGN',
    url: 'https://feeds.ign.com/ign/news',
    lastSync: new Date(Date.now() - 1000 * 60 * 20),
    articlesPerDay: 25,
    priority: 'low',
    status: 'active',
    folder: 'Gaming'
  }
];
