#!/usr/bin/env tsx

// Script to replace fake/placeholder feeds with real RSS feeds
// This removes feeds like "History Feed 1", "Tech Feed 5", etc.

import '../server/env';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Real feeds to replace fake ones - organized by category
const realFeedsByCategory: Record<string, any[]> = {
  History: [
    { name: 'History Today', url: 'https://www.historytoday.com/feed/rss.xml', site_url: 'https://www.historytoday.com', description: 'History magazine with articles on all periods and aspects of history', popularity_score: 85, is_featured: true },
    { name: 'Smithsonian Magazine - History', url: 'https://www.smithsonianmag.com/rss/history/', site_url: 'https://www.smithsonianmag.com/history', description: 'History articles from Smithsonian Magazine', popularity_score: 88, is_featured: true },
    { name: 'History Extra', url: 'https://www.historyextra.com/feed/', site_url: 'https://www.historyextra.com', description: 'The official website for BBC History Magazine', popularity_score: 82, is_featured: true },
  ],
  Humor: [
    { name: 'The Onion', url: 'https://www.theonion.com/rss', site_url: 'https://www.theonion.com', description: 'America\'s Finest News Source', popularity_score: 90, is_featured: true },
    { name: 'McSweeney\'s Internet Tendency', url: 'https://www.mcsweeneys.net/feeds/columns', site_url: 'https://www.mcsweeneys.net', description: 'Daily humor and satire', popularity_score: 78, is_featured: true },
    { name: 'Cracked', url: 'https://www.cracked.com/feed', site_url: 'https://www.cracked.com', description: 'Comedy and humor articles', popularity_score: 75, is_featured: false },
  ],
  Beauty: [
    { name: 'Allure', url: 'https://www.allure.com/feed/rss', site_url: 'https://www.allure.com', description: 'Beauty tips, trends, and product reviews', popularity_score: 85, is_featured: true },
    { name: 'Into The Gloss', url: 'https://intothegloss.com/feed/', site_url: 'https://intothegloss.com', description: 'Beauty routines and product recommendations', popularity_score: 80, is_featured: true },
    { name: 'Byrdie', url: 'https://www.byrdie.com/rss', site_url: 'https://www.byrdie.com', description: 'Beauty and wellness advice', popularity_score: 78, is_featured: false },
  ],
  Fashion: [
    { name: 'Vogue', url: 'https://www.vogue.com/feed/rss', site_url: 'https://www.vogue.com', description: 'Fashion news, trends, and runway coverage', popularity_score: 95, is_featured: true },
    { name: 'GQ', url: 'https://www.gq.com/feed/rss', site_url: 'https://www.gq.com', description: 'Men\'s fashion and style', popularity_score: 88, is_featured: true },
    { name: 'Fashionista', url: 'https://fashionista.com/.rss/full/', site_url: 'https://fashionista.com', description: 'Fashion industry news and trends', popularity_score: 82, is_featured: true },
  ],
  Startups: [
    { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/', site_url: 'https://techcrunch.com/startups', description: 'Startup news and funding announcements', popularity_score: 92, is_featured: true },
    { name: 'Startup Grind', url: 'https://www.startupgrind.com/blog/feed/', site_url: 'https://www.startupgrind.com', description: 'Stories and advice for entrepreneurs', popularity_score: 78, is_featured: true },
    { name: 'Y Combinator Blog', url: 'https://www.ycombinator.com/blog/rss/', site_url: 'https://www.ycombinator.com/blog', description: 'Insights from Y Combinator', popularity_score: 85, is_featured: true },
  ],
  Cricket: [
    { name: 'ESPNcricinfo', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', site_url: 'https://www.espncricinfo.com', description: 'Cricket news, scores, and analysis', popularity_score: 90, is_featured: true },
    { name: 'Cricket Australia', url: 'https://www.cricket.com.au/news/rss', site_url: 'https://www.cricket.com.au', description: 'Official Cricket Australia news', popularity_score: 82, is_featured: true },
  ],
  Football: [
    { name: 'ESPN FC', url: 'https://www.espn.com/espn/rss/soccer/news', site_url: 'https://www.espn.com/soccer', description: 'Football/soccer news and analysis', popularity_score: 90, is_featured: true },
    { name: 'The Guardian Football', url: 'https://www.theguardian.com/football/rss', site_url: 'https://www.theguardian.com/football', description: 'Football news from The Guardian', popularity_score: 88, is_featured: true },
    { name: 'Sky Sports Football', url: 'https://www.skysports.com/rss/12040', site_url: 'https://www.skysports.com/football', description: 'Football news from Sky Sports', popularity_score: 85, is_featured: true },
  ],
  Tennis: [
    { name: 'Tennis.com', url: 'https://www.tennis.com/rss/news.xml', site_url: 'https://www.tennis.com', description: 'Tennis news and tournament coverage', popularity_score: 82, is_featured: true },
    { name: 'ATP Tour News', url: 'https://www.atptour.com/en/media/rss-feed/xml-feed', site_url: 'https://www.atptour.com', description: 'Official ATP Tour news', popularity_score: 85, is_featured: true },
  ],
  Photography: [
    { name: 'PetaPixel', url: 'https://petapixel.com/feed/', site_url: 'https://petapixel.com', description: 'Photography news and tutorials', popularity_score: 88, is_featured: true },
    { name: 'Digital Photography Review', url: 'https://www.dpreview.com/feeds/news.xml', site_url: 'https://www.dpreview.com', description: 'Camera reviews and photography news', popularity_score: 85, is_featured: true },
    { name: 'Fstoppers', url: 'https://fstoppers.com/rss.xml', site_url: 'https://fstoppers.com', description: 'Photography and videography community', popularity_score: 80, is_featured: true },
  ],
  'Interior Design': [
    { name: 'Dezeen', url: 'https://www.dezeen.com/feed/', site_url: 'https://www.dezeen.com', description: 'Architecture and design magazine', popularity_score: 90, is_featured: true },
    { name: 'Architectural Digest', url: 'https://www.architecturaldigest.com/feed/rss', site_url: 'https://www.architecturaldigest.com', description: 'Interior design and architecture', popularity_score: 88, is_featured: true },
    { name: 'Dwell', url: 'https://www.dwell.com/feed', site_url: 'https://www.dwell.com', description: 'Modern home design and architecture', popularity_score: 82, is_featured: true },
  ],
  Automotive: [
    { name: 'Car and Driver', url: 'https://www.caranddriver.com/rss/all.xml/', site_url: 'https://www.caranddriver.com', description: 'Car reviews and automotive news', popularity_score: 88, is_featured: true },
    { name: 'Motor Trend', url: 'https://www.motortrend.com/feed/', site_url: 'https://www.motortrend.com', description: 'Automotive news and reviews', popularity_score: 85, is_featured: true },
    { name: 'Jalopnik', url: 'https://jalopnik.com/rss', site_url: 'https://jalopnik.com', description: 'Cars, culture, and everything in between', popularity_score: 82, is_featured: true },
  ],
  DIY: [
    { name: 'Instructables', url: 'https://www.instructables.com/rss/', site_url: 'https://www.instructables.com', description: 'DIY projects and how-to guides', popularity_score: 85, is_featured: true },
    { name: 'Make Magazine', url: 'https://makezine.com/feed/', site_url: 'https://makezine.com', description: 'DIY projects and maker culture', popularity_score: 82, is_featured: true },
    { name: 'Hackaday', url: 'https://hackaday.com/feed/', site_url: 'https://hackaday.com', description: 'Hardware hacking and DIY electronics', popularity_score: 80, is_featured: true },
  ],
  Android: [
    { name: 'Android Police', url: 'https://www.androidpolice.com/feed/', site_url: 'https://www.androidpolice.com', description: 'Android news, reviews, and apps', popularity_score: 88, is_featured: true },
    { name: 'Android Authority', url: 'https://www.androidauthority.com/feed/', site_url: 'https://www.androidauthority.com', description: 'Android news and device reviews', popularity_score: 85, is_featured: true },
    { name: '9to5Google', url: 'https://9to5google.com/feed/', site_url: 'https://9to5google.com', description: 'Google and Android news', popularity_score: 82, is_featured: true },
  ],
  Apple: [
    { name: '9to5Mac', url: 'https://9to5mac.com/feed/', site_url: 'https://9to5mac.com', description: 'Apple news and rumors', popularity_score: 90, is_featured: true },
    { name: 'MacRumors', url: 'https://feeds.macrumors.com/MacRumors-All', site_url: 'https://www.macrumors.com', description: 'Apple news and product rumors', popularity_score: 88, is_featured: true },
    { name: 'AppleInsider', url: 'https://appleinsider.com/rss/news/', site_url: 'https://appleinsider.com', description: 'Apple news and reviews', popularity_score: 85, is_featured: true },
  ],
  Books: [
    { name: 'The New York Times Books', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Books.xml', site_url: 'https://www.nytimes.com/section/books', description: 'Book reviews and literary news', popularity_score: 92, is_featured: true },
    { name: 'The Guardian Books', url: 'https://www.theguardian.com/books/rss', site_url: 'https://www.theguardian.com/books', description: 'Book reviews and author interviews', popularity_score: 88, is_featured: true },
    { name: 'Literary Hub', url: 'https://lithub.com/feed/', site_url: 'https://lithub.com', description: 'Literary news and book culture', popularity_score: 80, is_featured: true },
  ],
};

async function replaceFakeFeeds() {
  console.log('🔄 Starting fake feed replacement...');
  
  try {
    // First, identify and delete fake feeds (those with "Feed X" pattern in name)
    console.log('🔍 Finding fake feeds to remove...');
    
    const { data: allFeeds, error: fetchError } = await supabase
      .from('recommended_feeds')
      .select('id, name, category');
    
    if (fetchError) {
      console.error('❌ Error fetching feeds:', fetchError);
      process.exit(1);
    }

    // Identify fake feeds (pattern: "Category Feed N" or URLs containing "example-")
    const fakeFeeds = allFeeds?.filter(feed => 
      /Feed \d+$/.test(feed.name) || 
      feed.name.includes('example-')
    ) || [];
    
    console.log(`📊 Found ${fakeFeeds.length} fake feeds to remove`);
    
    // Group fake feeds by category
    const fakeFeedsByCategory: Record<string, number> = {};
    fakeFeeds.forEach(feed => {
      fakeFeedsByCategory[feed.category] = (fakeFeedsByCategory[feed.category] || 0) + 1;
    });
    
    console.log('📊 Fake feeds by category:');
    Object.entries(fakeFeedsByCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} fake feeds`);
    });
    
    // Delete fake feeds
    if (fakeFeeds.length > 0) {
      const fakeIds = fakeFeeds.map(f => f.id);
      console.log(`🗑️  Deleting ${fakeIds.length} fake feeds...`);
      
      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < fakeIds.length; i += batchSize) {
        const batch = fakeIds.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('recommended_feeds')
          .delete()
          .in('id', batch);
        
        if (deleteError) {
          console.error('❌ Error deleting batch:', deleteError);
        } else {
          console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}`);
        }
      }
    }

    // Now insert real feeds for categories that had fake ones
    console.log('📝 Inserting real feeds...');
    
    const feedsToInsert: any[] = [];
    
    for (const [category, feeds] of Object.entries(realFeedsByCategory)) {
      feeds.forEach(feed => {
        feedsToInsert.push({
          ...feed,
          category,
          country: 'US',
          language: 'en',
          tags: [category.toLowerCase().replace(/\s+/g, '-'), 'news'],
          article_frequency: 'daily',
          icon_url: feed.icon_url || `${feed.site_url}/favicon.ico`
        });
      });
    }
    
    console.log(`📝 Inserting ${feedsToInsert.length} real feeds...`);
    
    // Insert in batches
    const insertBatchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < feedsToInsert.length; i += insertBatchSize) {
      const batch = feedsToInsert.slice(i, i + insertBatchSize);
      
      const { data, error: insertError } = await supabase
        .from('recommended_feeds')
        .upsert(batch, { onConflict: 'url' })
        .select('id');
      
      if (insertError) {
        console.error('❌ Error inserting batch:', insertError);
      } else {
        totalInserted += data?.length || 0;
        console.log(`✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1} (${totalInserted} total)`);
      }
    }
    
    // Verify final state
    const { count, error: countError } = await supabase
      .from('recommended_feeds')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`📊 Total feeds in database: ${count}`);
    }
    
    // Check for remaining fake feeds
    const { data: remainingFake } = await supabase
      .from('recommended_feeds')
      .select('name, category')
      .or('name.like.%Feed %,url.like.%example-%');
    
    if (remainingFake && remainingFake.length > 0) {
      console.warn(`⚠️  ${remainingFake.length} fake feeds still remain`);
    } else {
      console.log('✅ All fake feeds have been replaced!');
    }
    
    console.log('🎉 Fake feed replacement completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

replaceFakeFeeds();
