/**
 * Fix Broken Feeds Script
 * 
 * Updates or removes feeds that are broken based on the health audit.
 * 
 * Usage: npx tsx scripts/fix-broken-feeds.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Feeds to remove (completely broken, no alternative)
const feedsToRemove = [
  'https://ai.googleblog.com/feeds/posts/default', // 404
  'https://www.topgear.com/rss', // 404
  'https://feeds.coindesk.com/coindesk/rss', // DNS not found
  'https://dribbble.com/shots/popular.rss', // Invalid XML
  'https://ew.com/feed/', // 404
  'https://www.climatecentral.org/rss.xml', // 404
  'https://www.enn.com/rss', // 404
  'https://www.foodnetwork.com/feeds/all/rss.xml', // 404
  'https://www.nejm.org/action/showFeed?type=etoc&feed=rss', // 404
  'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', // DNS not found
  'https://www.thetimes.co.uk/rss', // 404
  'https://www.spacex.com/news.rss', // 404
  'https://www.lonelyplanet.com/rss/news.xml', // 404
  'https://www.nationalgeographic.com/travel/rss/', // 404
  'https://www.travelandleisure.com/syndication/feed', // 404
];

// Feeds to update with new URLs
const feedsToUpdate: { oldUrl: string; newUrl: string; notes: string }[] = [
  // Reuters - try their newer feed format
  {
    oldUrl: 'https://www.reuters.com/rssFeed/worldNews',
    newUrl: 'https://www.reutersagency.com/feed/',
    notes: 'Reuters changed their feed structure'
  },
  // AP News - try their main feed
  {
    oldUrl: 'https://apnews.com/apf-topnews',
    newUrl: 'https://rsshub.app/apnews/topics/apf-topnews',
    notes: 'AP News direct feed has XML issues, using RSSHub proxy'
  },
  // Google AI Blog moved to a new location
  {
    oldUrl: 'https://ai.googleblog.com/feeds/posts/default',
    newUrl: 'https://blog.google/technology/ai/rss/',
    notes: 'Google AI Blog moved to blog.google'
  },
  // Scientific American - try alternate feed
  {
    oldUrl: 'https://rss.sciam.com/ScientificAmerican-Global',
    newUrl: 'https://www.scientificamerican.com/feed/',
    notes: 'Scientific American alternate feed'
  },
  // CNN - try their main RSS
  {
    oldUrl: 'http://rss.cnn.com/rss/edition.rss',
    newUrl: 'https://rss.cnn.com/rss/cnn_topstories.rss',
    notes: 'CNN top stories feed'
  },
];

// Feeds that require subscription/paywall - mark as unavailable but keep for reference
const paywallFeeds = [
  'https://www.forbes.com/real-time/feed2/', // 403
  'https://www.economist.com/rss', // 403
  'https://www.theaustralian.com.au/rss', // 403
  'https://feeds.hbr.org/harvardbusiness', // Connection issues (likely paywall)
];

async function main() {
  console.log('🔧 Fixing Broken Feeds');
  console.log('======================\n');

  let removedCount = 0;
  let updatedCount = 0;
  let markedUnavailable = 0;

  // Remove completely broken feeds
  console.log('🗑️  Removing broken feeds...');
  for (const url of feedsToRemove) {
    const { data, error } = await supabase
      .from('recommended_feeds')
      .delete()
      .eq('url', url)
      .select('name');

    if (error) {
      console.log(`  ❌ Error removing ${url}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`  ✅ Removed: ${data[0].name}`);
      removedCount++;
    } else {
      console.log(`  ⚠️  Not found: ${url}`);
    }
  }

  // Update feeds with new URLs
  console.log('\n📝 Updating feeds with new URLs...');
  for (const update of feedsToUpdate) {
    const { data, error } = await supabase
      .from('recommended_feeds')
      .update({ url: update.newUrl })
      .eq('url', update.oldUrl)
      .select('name');

    if (error) {
      console.log(`  ❌ Error updating ${update.oldUrl}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`  ✅ Updated: ${data[0].name}`);
      console.log(`     Old: ${update.oldUrl}`);
      console.log(`     New: ${update.newUrl}`);
      console.log(`     Note: ${update.notes}`);
      updatedCount++;
    } else {
      console.log(`  ⚠️  Not found: ${update.oldUrl}`);
    }
  }

  // Mark paywall feeds as unavailable (set popularity_score to -1 as a flag)
  console.log('\n🔒 Marking paywall feeds...');
  for (const url of paywallFeeds) {
    const { data, error } = await supabase
      .from('recommended_feeds')
      .update({ 
        popularity_score: -1,
        description: (await supabase.from('recommended_feeds').select('description').eq('url', url).single()).data?.description + ' [PAYWALL - Feed unavailable]'
      })
      .eq('url', url)
      .select('name');

    if (error) {
      console.log(`  ❌ Error marking ${url}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`  🔒 Marked as paywall: ${data[0].name}`);
      markedUnavailable++;
    } else {
      console.log(`  ⚠️  Not found: ${url}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Removed: ${removedCount} feeds`);
  console.log(`Updated: ${updatedCount} feeds`);
  console.log(`Marked as paywall: ${markedUnavailable} feeds`);
}

main().catch(console.error);
