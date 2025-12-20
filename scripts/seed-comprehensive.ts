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

// Frontend categories from client/src/data/categories.ts - using database category names
const frontendCategories = [
  'tech', 'business', 'gaming', 'sports', 'science', 'space', 'news', 'movies', 
  'music', 'books', 'food', 'travel', 'programming', 'design', 'cars', 'diy', 
  'android', 'apple', 'history', 'funny', 'beauty', 'fashion', 'startups', 
  'cricket', 'football', 'tennis', 'photography', 'interior'
];

// Convert frontend categories to database categories using mapping service
const getDatabaseCategories = (): string[] => {
  return frontendCategories
    .map(frontendId => categoryMappingService.frontendToDatabase(frontendId))
    .filter((dbCategory): dbCategory is string => dbCategory !== null);
};

// Base feeds for each database category
const baseFeedsByDatabaseCategory: Record<string, any[]> = {
  Technology: [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', site_url: 'https://techcrunch.com', description: 'The latest technology news and information on startups', popularity_score: 95, is_featured: true },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', site_url: 'https://www.theverge.com', description: 'Technology, science, art, and culture', popularity_score: 90, is_featured: true },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', site_url: 'https://arstechnica.com', description: 'Technology news and analysis', popularity_score: 85, is_featured: false },
  ],
  News: [
    { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', site_url: 'https://www.bbc.com/news', description: 'Breaking news, sport, TV, radio and a whole lot more', popularity_score: 98, is_featured: true },
    { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', site_url: 'https://www.reuters.com', description: 'Breaking international news and headlines', popularity_score: 96, is_featured: true },
    { name: 'Associated Press', url: 'https://feeds.apnews.com/rss/apf-topnews', site_url: 'https://apnews.com', description: 'The definitive source for global and local news', popularity_score: 94, is_featured: true },
  ],
  Business: [
    { name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', site_url: 'https://www.wsj.com', description: 'Breaking news and analysis from the U.S. and around the world', popularity_score: 92, is_featured: true },
    { name: 'Financial Times', url: 'https://www.ft.com/rss/home', site_url: 'https://www.ft.com', description: 'Global financial news and analysis', popularity_score: 90, is_featured: true },
    { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', site_url: 'https://www.bloomberg.com', description: 'Business and financial news', popularity_score: 88, is_featured: true },
  ],
  Science: [
    { name: 'Scientific American', url: 'https://rss.sciam.com/ScientificAmerican-Global', site_url: 'https://www.scientificamerican.com', description: 'Science news and research', popularity_score: 85, is_featured: true },
    { name: 'Nature', url: 'https://www.nature.com/nature.rss', site_url: 'https://www.nature.com', description: 'International journal of science', popularity_score: 90, is_featured: true },
  ],
  Sports: [
    { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', site_url: 'https://www.espn.com', description: 'Sports news and analysis', popularity_score: 92, is_featured: true },
    { name: 'BBC Sport', url: 'http://feeds.bbci.co.uk/sport/rss.xml', site_url: 'https://www.bbc.com/sport', description: 'Sports news from the BBC', popularity_score: 88, is_featured: true },
  ],
  Gaming: [
    { name: 'IGN', url: 'https://feeds.ign.com/ign/games-all', site_url: 'https://www.ign.com', description: 'Video game news and reviews', popularity_score: 85, is_featured: true },
    { name: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/', site_url: 'https://www.gamespot.com', description: 'Video game news, reviews, and guides', popularity_score: 82, is_featured: false },
  ],
  Entertainment: [
    { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', site_url: 'https://www.hollywoodreporter.com', description: 'Entertainment news and analysis', popularity_score: 88, is_featured: true },
    { name: 'Variety', url: 'https://variety.com/feed/', site_url: 'https://variety.com', description: 'Entertainment news and analysis', popularity_score: 85, is_featured: true },
  ],
  Music: [
    { name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/', site_url: 'https://www.rollingstone.com', description: 'Music news and culture', popularity_score: 85, is_featured: true },
    { name: 'Pitchfork', url: 'https://pitchfork.com/rss/news/', site_url: 'https://pitchfork.com', description: 'Music reviews and news', popularity_score: 80, is_featured: false },
  ],
  Programming: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', site_url: 'https://news.ycombinator.com', description: 'Social news website focusing on computer science and entrepreneurship', popularity_score: 95, is_featured: true },
    { name: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/', site_url: 'https://stackoverflow.blog', description: 'Programming and developer community news', popularity_score: 88, is_featured: true },
  ],
  Design: [
    { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', site_url: 'https://www.smashingmagazine.com', description: 'Web design and development', popularity_score: 85, is_featured: true },
    { name: 'A List Apart', url: 'https://alistapart.com/main/feed/', site_url: 'https://alistapart.com', description: 'Web design and development', popularity_score: 82, is_featured: false },
  ],
  Space: [
    { name: 'NASA News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', site_url: 'https://www.nasa.gov', description: 'NASA news and updates', popularity_score: 90, is_featured: true },
    { name: 'SpaceX', url: 'https://www.spacex.com/news.rss', site_url: 'https://www.spacex.com', description: 'SpaceX news and updates', popularity_score: 85, is_featured: true },
  ],
  Food: [
    { name: 'Food & Wine', url: 'https://www.foodandwine.com/syndication/feed', site_url: 'https://www.foodandwine.com', description: 'Food and cooking news', popularity_score: 80, is_featured: false },
    { name: 'Bon Appétit', url: 'https://www.bonappetit.com/feed/rss', site_url: 'https://www.bonappetit.com', description: 'Food and cooking magazine', popularity_score: 78, is_featured: false },
  ],
  Travel: [
    { name: 'Lonely Planet', url: 'https://www.lonelyplanet.com/news/feed/rss/', site_url: 'https://www.lonelyplanet.com', description: 'Travel guides and news', popularity_score: 85, is_featured: true },
    { name: 'Travel + Leisure', url: 'https://www.travelandleisure.com/syndication/feed', site_url: 'https://www.travelandleisure.com', description: 'Travel news and guides', popularity_score: 82, is_featured: false },
  ]
};

function generateFeeds(targetCount: number = 865): any[] {
  const feeds: any[] = [];
  const databaseCategories = getDatabaseCategories();
  const feedsPerCategory = Math.ceil(targetCount / databaseCategories.length);
  
  console.log(`📊 Generating feeds for ${databaseCategories.length} database categories`);
  
  databaseCategories.forEach(databaseCategory => {
    const baseFeeds = baseFeedsByDatabaseCategory[databaseCategory] || [];
    const frontendId = categoryMappingService.databaseToFrontend(databaseCategory);
    
    // Add base feeds first
    baseFeeds.forEach(baseFeed => {
      feeds.push({
        ...baseFeed,
        category: databaseCategory, // Use database category name
        country: 'US',
        language: 'en',
        tags: [frontendId || databaseCategory.toLowerCase(), 'news'],
        article_frequency: 'daily',
        icon_url: baseFeed.site_url + '/favicon.ico'
      });
    });
    
    // Generate additional feeds to reach target per category
    const additionalNeeded = feedsPerCategory - baseFeeds.length;
    for (let i = 0; i < additionalNeeded; i++) {
      const feedNumber = i + baseFeeds.length + 1;
      feeds.push({
        name: `${databaseCategory} Feed ${feedNumber}`,
        url: `https://example-${(frontendId || databaseCategory).toLowerCase()}-${feedNumber}.com/feed.rss`,
        site_url: `https://example-${(frontendId || databaseCategory).toLowerCase()}-${feedNumber}.com`,
        description: `${databaseCategory} news and updates`,
        icon_url: `https://example-${(frontendId || databaseCategory).toLowerCase()}-${feedNumber}.com/favicon.ico`,
        category: databaseCategory, // Use database category name
        country: 'US',
        language: 'en',
        tags: [frontendId || databaseCategory.toLowerCase(), 'news'],
        popularity_score: Math.max(50, 90 - i * 2), // Decreasing popularity
        article_frequency: 'daily',
        is_featured: i < 2 // First 2 additional feeds are featured
      });
    }
  });
  
  return feeds.slice(0, targetCount); // Ensure exact count
}

async function seedComprehensive() {
  console.log('🌱 Starting comprehensive database seeding (865 feeds)...');
  
  try {
    // Validate category mapping completeness
    console.log('🔍 Validating category mapping completeness...');
    const mappingValidation = CategoryMappingUtils.validateMappingCompleteness();
    if (!mappingValidation.isComplete) {
      console.error('❌ Category mapping validation failed. Missing mappings for:', mappingValidation.missingMappings);
      process.exit(1);
    }
    console.log('✅ Category mapping validation passed');

    // Clear existing data
    console.log('🧹 Clearing existing recommended feeds...');
    const { error: deleteError } = await supabase
      .from('recommended_feeds')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (deleteError) {
      console.warn('⚠️  Warning during cleanup:', deleteError.message);
    }
    
    // Generate feeds with validation
    const feeds = generateFeeds(865);
    console.log(`📝 Generated ${feeds.length} feeds across database categories`);
    
    // Validate all generated feed categories
    console.log('🔍 Validating generated feed categories...');
    const invalidFeeds: string[] = [];
    const validatedFeeds = feeds.filter(feed => {
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
    Object.entries(categoryDistribution).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
      const frontendId = categoryMappingService.databaseToFrontend(category);
      console.log(`   ${category} (${frontendId}): ${count} feeds`);
    });
    
    // Insert in batches to avoid timeout
    const batchSize = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < validatedFeeds.length; i += batchSize) {
      const batch = validatedFeeds.slice(i, i + batchSize);
      console.log(`📝 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validatedFeeds.length / batchSize)} (${batch.length} feeds)...`);
      
      const { data, error } = await supabase
        .from('recommended_feeds')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error('❌ Error inserting batch:', error);
        process.exit(1);
      }
      
      totalInserted += data?.length || 0;
      console.log(`✅ Batch inserted successfully (${totalInserted}/${validatedFeeds.length} total)`);
    }
    
    console.log(`✅ Successfully seeded ${totalInserted} recommended feeds`);
    
    // Verify the data
    const { count, error: countError } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.warn('⚠️  Warning during count verification:', countError.message);
    } else {
      console.log(`📊 Total feeds in database: ${count}`);
    }
    
    // Get category distribution
    const { data: categoryData, error: categoryError } = await supabase
      .from('recommended_feeds')
      .select('category');
    
    if (categoryError) {
      console.warn('⚠️  Warning during category verification:', categoryError.message);
    } else {
      const finalCategoryCount: Record<string, number> = {};
      categoryData?.forEach((row: any) => {
        finalCategoryCount[row.category] = (finalCategoryCount[row.category] || 0) + 1;
      });
      
      console.log('📊 Final feed distribution by category:');
      Object.entries(finalCategoryCount).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
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
    
    console.log('🎉 Comprehensive database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedComprehensive();