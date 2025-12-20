#!/usr/bin/env tsx

// Load environment variables
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

const recommendedFeeds = [
  // Tech category feeds
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    site_url: 'https://techcrunch.com',
    description: 'The latest technology news and information on startups',
    icon_url: 'https://techcrunch.com/favicon.ico',
    category: 'Technology', // Using database category name
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
    category: 'Technology', // Using database category name
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
    category: 'Technology', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['technology', 'science', 'analysis'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: false
  },
  // News category feeds
  {
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    site_url: 'https://www.bbc.com/news',
    description: 'Breaking news, sport, TV, radio and a whole lot more',
    icon_url: 'https://www.bbc.com/favicon.ico',
    category: 'News', // Using database category name
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
    category: 'News', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['news', 'international', 'breaking'],
    popularity_score: 96,
    article_frequency: 'hourly',
    is_featured: true
  },
  // Business category feeds
  {
    name: 'Wall Street Journal',
    url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
    site_url: 'https://www.wsj.com',
    description: 'Breaking news and analysis from the U.S. and around the world',
    icon_url: 'https://www.wsj.com/favicon.ico',
    category: 'Business', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['business', 'finance', 'markets'],
    popularity_score: 92,
    article_frequency: 'hourly',
    is_featured: true
  },
  // Science category feeds
  {
    name: 'Scientific American',
    url: 'https://rss.sciam.com/ScientificAmerican-Global',
    site_url: 'https://www.scientificamerican.com',
    description: 'Science news and research',
    icon_url: 'https://www.scientificamerican.com/favicon.ico',
    category: 'Science', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['science', 'research', 'discovery'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  },
  // Sports category feeds
  {
    name: 'ESPN',
    url: 'https://www.espn.com/espn/rss/news',
    site_url: 'https://www.espn.com',
    description: 'Sports news and analysis',
    icon_url: 'https://www.espn.com/favicon.ico',
    category: 'Sports', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['sports', 'news', 'analysis'],
    popularity_score: 92,
    article_frequency: 'hourly',
    is_featured: true
  },
  // Gaming category feeds
  {
    name: 'IGN',
    url: 'https://feeds.ign.com/ign/games-all',
    site_url: 'https://www.ign.com',
    description: 'Video game news and reviews',
    icon_url: 'https://www.ign.com/favicon.ico',
    category: 'Gaming', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['gaming', 'reviews', 'news'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  },
  // Movies category feeds
  {
    name: 'The Hollywood Reporter',
    url: 'https://www.hollywoodreporter.com/feed/',
    site_url: 'https://www.hollywoodreporter.com',
    description: 'Entertainment news and analysis',
    icon_url: 'https://www.hollywoodreporter.com/favicon.ico',
    category: 'Entertainment', // Using database category name (movies -> Entertainment)
    country: 'US',
    language: 'en',
    tags: ['movies', 'entertainment', 'hollywood'],
    popularity_score: 88,
    article_frequency: 'daily',
    is_featured: true
  },
  // Music category feeds
  {
    name: 'Rolling Stone',
    url: 'https://www.rollingstone.com/feed/',
    site_url: 'https://www.rollingstone.com',
    description: 'Music news and culture',
    icon_url: 'https://www.rollingstone.com/favicon.ico',
    category: 'Music', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['music', 'culture', 'news'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  },
  // Programming category feeds
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    site_url: 'https://news.ycombinator.com',
    description: 'Social news website focusing on computer science and entrepreneurship',
    icon_url: 'https://news.ycombinator.com/favicon.ico',
    category: 'Programming', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['programming', 'startups', 'tech'],
    popularity_score: 95,
    article_frequency: 'hourly',
    is_featured: true
  },
  // Design category feeds
  {
    name: 'Smashing Magazine',
    url: 'https://www.smashingmagazine.com/feed/',
    site_url: 'https://www.smashingmagazine.com',
    description: 'Web design and development',
    icon_url: 'https://www.smashingmagazine.com/favicon.ico',
    category: 'Design', // Using database category name
    country: 'DE',
    language: 'en',
    tags: ['design', 'web', 'development'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  },
  // Space category feeds
  {
    name: 'NASA News',
    url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    site_url: 'https://www.nasa.gov',
    description: 'NASA news and updates',
    icon_url: 'https://www.nasa.gov/favicon.ico',
    category: 'Space', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['space', 'nasa', 'science'],
    popularity_score: 90,
    article_frequency: 'daily',
    is_featured: true
  },
  // Food category feeds
  {
    name: 'Food & Wine',
    url: 'https://www.foodandwine.com/syndication/feed',
    site_url: 'https://www.foodandwine.com',
    description: 'Food and cooking news',
    icon_url: 'https://www.foodandwine.com/favicon.ico',
    category: 'Food', // Using database category name
    country: 'US',
    language: 'en',
    tags: ['food', 'cooking', 'recipes'],
    popularity_score: 80,
    article_frequency: 'daily',
    is_featured: false
  },
  // Travel category feeds
  {
    name: 'Lonely Planet',
    url: 'https://www.lonelyplanet.com/news/feed/rss/',
    site_url: 'https://www.lonelyplanet.com',
    description: 'Travel guides and news',
    icon_url: 'https://www.lonelyplanet.com/favicon.ico',
    category: 'Travel', // Using database category name
    country: 'AU',
    language: 'en',
    tags: ['travel', 'guides', 'destinations'],
    popularity_score: 85,
    article_frequency: 'daily',
    is_featured: true
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Validate category mapping completeness
    console.log('🔍 Validating category mapping completeness...');
    const mappingValidation = CategoryMappingUtils.validateMappingCompleteness();
    if (!mappingValidation.isComplete) {
      console.error('❌ Category mapping validation failed. Missing mappings for:', mappingValidation.missingMappings);
      process.exit(1);
    }
    console.log('✅ Category mapping validation passed');

    // Validate all feed categories before insertion
    console.log('🔍 Validating feed categories...');
    const invalidFeeds: string[] = [];
    const validatedFeeds = recommendedFeeds.filter(feed => {
      const isValid = categoryMappingService.isValidDatabaseCategory(feed.category);
      if (!isValid) {
        invalidFeeds.push(`${feed.name} (category: ${feed.category})`);
      }
      return isValid;
    });

    if (invalidFeeds.length > 0) {
      console.error('❌ Found feeds with invalid categories:');
      invalidFeeds.forEach(feed => console.error(`   - ${feed}`));
      console.error('❌ Seeding aborted due to invalid categories');
      process.exit(1);
    }

    console.log(`✅ All ${validatedFeeds.length} feeds have valid categories`);

    // Log category distribution before insertion
    const categoryDistribution: Record<string, number> = {};
    validatedFeeds.forEach(feed => {
      categoryDistribution[feed.category] = (categoryDistribution[feed.category] || 0) + 1;
    });
    
    console.log('📊 Category distribution for seeding:');
    Object.entries(categoryDistribution).forEach(([category, count]) => {
      const frontendId = categoryMappingService.databaseToFrontend(category);
      console.log(`   ${category} (${frontendId}): ${count} feeds`);
    });

    // Clear existing data
    console.log('🧹 Clearing existing recommended feeds...');
    const { error: deleteError } = await supabase
      .from('recommended_feeds')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (deleteError) {
      console.warn('⚠️  Warning during cleanup:', deleteError.message);
    }
    
    // Insert new data
    console.log(`📝 Inserting ${validatedFeeds.length} recommended feeds...`);
    const { data, error } = await supabase
      .from('recommended_feeds')
      .insert(validatedFeeds)
      .select();
    
    if (error) {
      console.error('❌ Error inserting feeds:', error);
      process.exit(1);
    }
    
    console.log(`✅ Successfully seeded ${data?.length || 0} recommended feeds`);
    
    // Verify the data
    const { data: verifyData, error: verifyError } = await supabase
      .from('recommended_feeds')
      .select('category');
    
    if (verifyError) {
      console.warn('⚠️  Warning during verification:', verifyError.message);
    } else {
      console.log('📊 Final feed distribution by category:');
      const finalCategoryCount: Record<string, number> = {};
      verifyData?.forEach((row: any) => {
        finalCategoryCount[row.category] = (finalCategoryCount[row.category] || 0) + 1;
      });
      Object.entries(finalCategoryCount).forEach(([category, count]) => {
        const frontendId = categoryMappingService.databaseToFrontend(category);
        console.log(`   ${category} (${frontendId}): ${count} feeds`);
      });

      // Validate that all frontend categories are represented
      const allFrontendCategories = categoryMappingService.getAllFrontendCategories();
      const representedCategories = Object.keys(finalCategoryCount)
        .map(dbCategory => categoryMappingService.databaseToFrontend(dbCategory))
        .filter((id): id is string => id !== null);
      
      const missingCategories = allFrontendCategories.filter(
        frontendId => !representedCategories.includes(frontendId)
      );

      if (missingCategories.length > 0) {
        console.warn('⚠️  Warning: Some frontend categories are not represented in seeded data:');
        missingCategories.forEach(category => console.warn(`   - ${category}`));
      } else {
        console.log('✅ All frontend categories are represented in seeded data');
      }
    }
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();