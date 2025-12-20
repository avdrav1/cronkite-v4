export interface TopicCluster {
  id: string;
  topic: string;
  articleIds: string[];
  sources: string[];
  thumbnails: string[];
  articleCount: number;
  latestTimestamp: Date;
  summary?: string;
}

export const MOCK_CLUSTERS: TopicCluster[] = [
  {
    id: 'cluster-1',
    topic: 'GPT-5 Announcement',
    articleIds: ['1', 'c1-2', 'c1-3', 'c1-4', 'c1-5'],
    sources: ['TechCrunch', 'The Verge', 'Ars Technica'],
    thumbnails: [
      '@assets/stock_images/abstract_technology__444bd4e8.jpg',
      '@assets/stock_images/abstract_technology__271dd1f7.jpg',
      '@assets/stock_images/abstract_technology__6049a3f2.jpg'
    ],
    articleCount: 5,
    latestTimestamp: new Date(),
    summary: "Multiple outlets are reporting on OpenAI's next generation model, highlighting reasoning capabilities."
  },
  {
    id: 'cluster-2',
    topic: 'Global Market Shifts',
    articleIds: ['3', 'c2-2', 'c2-3'],
    sources: ['Bloomberg', 'WSJ', 'Reuters'],
    thumbnails: [
      '@assets/stock_images/modern_minimal_archi_57055080.jpg', 
      '@assets/stock_images/modern_minimal_archi_a62f2ad7.jpg'
    ],
    articleCount: 3,
    latestTimestamp: new Date(Date.now() - 3600000),
    summary: "Markets respond to new energy policies across the EU with mixed results."
  },
  {
    id: 'cluster-3',
    topic: 'SpaceX Starship Progress',
    articleIds: ['6', 'c3-2', 'c3-3', 'c3-4'],
    sources: ['SpaceNews', 'TechCrunch', 'NASA'],
    thumbnails: [
      '@assets/stock_images/modern_minimal_archi_104505ba.jpg',
      '@assets/stock_images/modern_minimal_archi_95a2d574.jpg',
      '@assets/stock_images/modern_minimal_archi_57055080.jpg'
    ],
    articleCount: 4,
    latestTimestamp: new Date(Date.now() - 7200000),
    summary: "Starship achieves stable orbit after months of rigorous testing."
  }
];
