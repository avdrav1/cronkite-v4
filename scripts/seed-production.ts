#!/usr/bin/env tsx

// Production database seeding script
// This script seeds the production database with essential data for the application to function

import '../server/env';
import { createClient } from '@supabase/supabase-js';
import { categoryMappingService, CategoryMappingUtils } from '../shared/category-mapping';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Essential production feeds - high-quality, reliable sources
const productionFeeds = [
  // Technology - High Priority
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    site_url: 'https://techcrunch.com',
    description: 'The latest technology news and information on startups',
    icon_url: 'https://techcrunch.com/favicon.ico',
    category: 'Technology',
    country: 'US',
    language: 'en',
    tags: ['technology', 'startups', 'venture capital'],
    popularity_score: 95,
    article_frequency: 'hourly',
    is_featured: true
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    site_url: 'https://www.theverge.com',
    description: 'Technology, science, art, and culture',
    icon_url: 'https://www.theverge.com/favicon.ico',
    category: 'Technology',
    country: 'US',
    language: 'en',
    tags: ['technology', 'science', 'culture'],
    popularity_score: 90,
    article_frequency: 'daily',
    is_featured: true
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    site_url: 'https://arstechnica.com',
    description: 'Technology news and analysis',
    icon_url: 'https://arstechnica.com/favicon.ico',
    category: 'Technology',
    country: 'US',
    language: 'en',
    tags: ['technology', 'science', 'analysis'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  },

  // News - High Priority
  {
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    site_url: 'https://www.bbc.com/news',
    description: 'Breaking news, sport, TV, radio and a whole lot more',
    icon_url: 'https://www.bbc.com/favicon.ico',
    category: 'News',
    country: 'UK',
    language: 'en',
    tags: ['news', 'world', 'politics'],
    popularity_score: 98,
    article_frequency: 'hourly',
    is_featured: true
  },
  {
    name: 'Reuters',
    url: 'https://feeds.reuters.com/reuters/topNews',
    site_url: 'https://www.reuters.com',
    description: 'Breaking international news and headlines',
    icon_url: 'https://www.reuters.com/favicon.ico',
    category: 'News',
    country: 'US',
    language: 'en',
    tags: ['news', 'international', 'breaking'],
    popularity_score: 96,
    article_frequency: 'hourly',
    is_featured: true
  },
  {
    name: 'Associated Press',
    url: 'https://feeds.apnews.com/rss/apf-topnews',
    site_url: 'https://apnews.com',
    description: 'The definitive source for global and local news',
    icon_url: 'https://apnews.com/favicon.ico',
    category: 'News',
    country: 'US',
    language: 'en',
    tags: ['news', 'breaking', 'world'],
    popularity_score: 94,
    article_frequency: 'hourly',
    is_featured: true
  },

  // Business
  {
    name: 'Wall Street Journal',
    url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
    site_url: 'https://www.wsj.com',
    description: 'Breaking news and analysis from the U.S. and around the world',
    icon_url: 'https://www.wsj.com/favicon.ico',
    category: 'Business',
    country: 'US',
    language: 'en',
    tags: ['business', 'finance', 'markets'],
    popularity_score: 92,
    article_frequency: 'hourly',
    is_featured: true
  },
  {
    name: 'Bloomberg',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    site_url: 'https://www.bloomberg.com',
    description: 'Business and financial news',
    icon_url: 'https://www.bloomberg.com/favicon.ico',
    category: 'Business',
    country: 'US',
    language: 'en',
    tags: ['business', 'finance', 'markets'],
    popularity_score: 88,
    article_frequency: 'hourly',
    is_featured: true
  },

  // Science
  {
    name: 'Scientific American',
    url: 'https://rss.sciam.com/ScientificAmerican-Global',
    site_url: 'https://www.scientificamerican.com',
    description: 'Science news and research',
    icon_url: 'https://www.scientificamerican.com/favicon.ico',
    category: 'Science',
    country: 'US',
    language: 'en',
    tags: ['science', 'research', 'discovery'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  },
  {
    name: 'Nature News',
    url: 'https://www.nature.com/nature.rss',
    site_url: 'https://www.nature.com',
    description: 'International journal of science',
    icon_url: 'https://www.nature.com/favicon.ico',
    category: 'Science',
    country: 'UK',
    language: 'en',
    tags: ['science', 'research', 'journal'],
    popularity_score: 90,
    article_frequency: 'daily',
    is_featured: true
  },

  // Programming
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    site_url: 'https://news.ycombinator.com',
    description: 'Social news website focusing on computer science and entrepreneurship',
    icon_url: 'https://news.ycombinator.com/favicon.ico',
    category: 'Programming',
    country: 'US',
    language: 'en',
    tags: ['programming', 'startups', 'tech'],
    popularity_score: 95,
    article_frequency: 'hourly',
    is_featured: true
  },
  {
    name: 'Stack Overflow Blog',
    url: 'https://stackoverflow.blog/feed/',
    site_url: 'https://stackoverflow.blog',
    description: 'Programming and developer community news',
    icon_url: 'https://stackoverflow.blog/favicon.ico',
    category: 'Programming',
    country: 'US',
    language: 'en',
    tags: ['programming', 'development', 'community'],
    popularity_score: 88,
    article_frequency: 'daily',
    is_featured: true
  },

  // Sports
  {
    name: 'ESPN',
    url: 'https://www.espn.com/espn/rss/news',
    site_url: 'https://www.espn.com',
    description: 'Sports news and analysis',
    icon_url: 'https://www.espn.com/favicon.ico',
    category: 'Sports',
    country: 'US',
    language: 'en',
    tags: ['sports', 'news', 'analysis'],
    popularity_score: 92,
    article_frequency: 'hourly',
    is_featured: true
  },
  {
    name: 'BBC Sport',
    url: 'http://feeds.bbci.co.uk/sport/rss.xml',
    site_url: 'https://www.bbc.com/sport',
    description: 'Sports news from the BBC',
    icon_url: 'https://www.bbc.com/favicon.ico',
    category: 'Sports',
    country: 'UK',
    language: 'en',
    tags: ['sports', 'news', 'international'],
    popularity_score: 88,
    article_frequency: 'hourly',
    is_featured: true
  },

  // Gaming
  {
    name: 'IGN',
    url: 'https://feeds.ign.com/ign/games-all',
    site_url: 'https://www.ign.com',
    description: 'Video game news and reviews',
    icon_url: 'https://www.ign.com/favicon.ico',
    category: 'Gaming',
    country: 'US',
    language: 'en',
    tags: ['gaming', 'reviews', 'news'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  },

  // Space
  {
    name: 'NASA News',
    url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    site_url: 'https://www.nasa.gov',
    description: 'NASA news and updates',
    icon_url: 'https://www.nasa.gov/favicon.ico',
    category: 'Space',
    country: 'US',
    language: 'en',
    tags: ['space', 'nasa', 'science'],
    popularity_score: 90,
    article_frequency: 'daily',
    is_featured: true
  },

  // Design
  {
    name: 'Smashing Magazine',
    url: 'https://www.smashingmagazine.com/feed/',
    site_url: 'https://www.smashingmagazine.com',
    description: 'Web design and development',
    icon_url: 'https://www.smashingmagazine.com/favicon.ico',
    category: 'Design',
    country: 'DE',
    language: 'en',
    tags: ['design', 'web', 'development'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  }
];

export async function seedProductionDatabase(): Promise<void> {
  console.log('🌱 Starting production database seeding...');
  
  try {
    // Validate category mapping completeness
    console.log('🔍 Validating category mapping completeness...');
    const mappingValidation = CategoryMappingUtils.validateMappingCompleteness();
    if (!mappingValidation.isComplete) {
      console.error('❌ Category mapping validation failed. Missing mappings for:', mappingValidation.missingMappings);
      throw new Error('Category mapping validation failed');
    }
    console.log('✅ Category mapping validation passed');

    // Check if feeds already exist
    const { count: existingCount, error: countError } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.warn('⚠️  Warning checking existing feeds:', countError.message);
    }

    if (existingCount && existingCount > 0) {
      console.log(`📊 Found ${existingCount} existing recommended feeds, skipping seeding`);
      return;
    }

    // Validate all feed categories before insertion
    console.log('🔍 Validating feed categories...');
    const invalidFeeds: string[] = [];
    const validatedFeeds = productionFeeds.filter(feed => {
      const isValid = categoryMappingService.isValidDatabaseCategory(feed.category);
      if (!isValid) {
        invalidFeeds.push(`${feed.name} (category: ${feed.category})`);
      }
      return isValid;
    });

    if (invalidFeeds.length > 0) {
      console.error('❌ Found feeds with invalid categories:');
      invalidFeeds.forEach(feed => console.error(`   - ${feed}`));
      throw new Error('Invalid categories found in production feeds');
    }

    console.log(`✅ All ${validatedFeeds.length} feeds have valid categories`);

    // Log category distribution before insertion
    const categoryDistribution: Record<string, number> = {};
    validatedFeeds.forEach(feed => {
      categoryDistribution[feed.category] = (categoryDistribution[feed.category] || 0) + 1;
    });
    
    console.log('📊 Category distribution for production seeding:');
    Object.entries(categoryDistribution).forEach(([category, count]) => {
      const frontendId = categoryMappingService.databaseToFrontend(category);
      console.log(`   ${category} (${frontendId}): ${count} feeds`);
    });

    // Insert production feeds
    console.log(`📝 Inserting ${validatedFeeds.length} production recommended feeds...`);
    const { data, error } = await supabase
      .from('recommended_feeds')
      .insert(validatedFeeds)
      .select('id');
    
    if (error) {
      console.error('❌ Error inserting production feeds:', error);
      throw error;
    }
    
    console.log(`✅ Successfully seeded ${data?.length || 0} production recommended feeds`);
    
    // Verify the data
    const { data: verifyData, error: verifyError } = await supabase
      .from('recommended_feeds')
      .select('category');
    
    if (verifyError) {
      console.warn('⚠️  Warning during verification:', verifyError.message);
    } else {
      console.log('📊 Final production feed distribution by category:');
      const finalCategoryCount: Record<string, number> = {};
      verifyData?.forEach((row: any) => {
        finalCategoryCount[row.category] = (finalCategoryCount[row.category] || 0) + 1;
      });
      Object.entries(finalCategoryCount).forEach(([category, count]) => {
        const frontendId = categoryMappingService.databaseToFrontend(category);
        console.log(`   ${category} (${frontendId}): ${count} feeds`);
      });
    }
    
    console.log('🎉 Production database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Production seeding failed:', error);
    throw error;
  }
}

// Allow running as standalone script
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  seedProductionDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}