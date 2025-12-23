/**
 * Backfill folder_name for existing feeds from recommended_feeds
 * This script updates feeds that have NULL folder_name by matching against recommended_feeds
 * 
 * Usage:
 *   npx tsx scripts/backfill-folder-names.ts                    # Uses .env
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-folder-names.ts  # Production
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Set these environment variables or create a .env file');
  process.exit(1);
}

console.log(`🔗 Connecting to: ${supabaseUrl}\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillFolderNames() {
  console.log('🔄 Starting folder_name backfill...\n');

  // First, show current distribution
  const { data: distribution, error: distError } = await supabase
    .from('feeds')
    .select('folder_name');

  if (!distError && distribution) {
    const counts: Record<string, number> = {};
    distribution.forEach(f => {
      const key = f.folder_name || '(NULL)';
      counts[key] = (counts[key] || 0) + 1;
    });
    console.log('📊 Current folder_name distribution:');
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`   ${name}: ${count}`);
      });
    console.log('');
  }

  // Get all feeds with NULL folder_name
  const { data: feedsToUpdate, error: fetchError } = await supabase
    .from('feeds')
    .select('id, name, url, folder_name')
    .is('folder_name', null);

  if (fetchError) {
    console.error('❌ Error fetching feeds:', fetchError.message);
    return;
  }

  if (!feedsToUpdate || feedsToUpdate.length === 0) {
    console.log('✅ No feeds with NULL folder_name found.');
    return;
  }

  console.log(`📊 Found ${feedsToUpdate.length} feeds with NULL folder_name\n`);

  // Get all recommended feeds for matching
  const { data: recommendedFeeds, error: recError } = await supabase
    .from('recommended_feeds')
    .select('url, category');

  if (recError) {
    console.error('❌ Error fetching recommended feeds:', recError.message);
    return;
  }

  // Create a URL to category map
  const urlToCategoryMap = new Map<string, string>();
  recommendedFeeds?.forEach(rf => {
    urlToCategoryMap.set(rf.url.toLowerCase(), rf.category);
  });

  let updated = 0;
  let notMatched = 0;

  for (const feed of feedsToUpdate) {
    // Try to match by URL first
    let category = urlToCategoryMap.get(feed.url.toLowerCase());

    // If no match, try to infer from URL/name patterns
    if (!category) {
      category = inferCategory(feed.url, feed.name);
    }

    if (category) {
      const { error: updateError } = await supabase
        .from('feeds')
        .update({ folder_name: category })
        .eq('id', feed.id);

      if (updateError) {
        console.error(`❌ Error updating feed ${feed.name}:`, updateError.message);
      } else {
        console.log(`✅ Updated "${feed.name}" → ${category}`);
        updated++;
      }
    } else {
      // Default to General
      const { error: updateError } = await supabase
        .from('feeds')
        .update({ folder_name: 'General' })
        .eq('id', feed.id);

      if (!updateError) {
        console.log(`⚠️  "${feed.name}" → General (no match found)`);
        notMatched++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated with category: ${updated}`);
  console.log(`   Defaulted to General: ${notMatched}`);
}

function inferCategory(url: string, name: string): string | null {
  const urlLower = url.toLowerCase();
  const nameLower = name.toLowerCase();

  // Technology
  if (urlLower.includes('techcrunch') || urlLower.includes('wired') || urlLower.includes('arstechnica') ||
      urlLower.includes('theverge') || urlLower.includes('engadget') || urlLower.includes('zdnet') ||
      urlLower.includes('9to5mac') || urlLower.includes('macrumors') || urlLower.includes('osxdaily') ||
      urlLower.includes('hackaday') || urlLower.includes('xkcd') ||
      nameLower.includes('tech') || nameLower.includes('gadget') || nameLower.includes('software') ||
      nameLower.includes('mac') || nameLower.includes('apple')) {
    return 'Technology';
  }

  // Business & Finance
  if (urlLower.includes('bloomberg') || urlLower.includes('wsj') || urlLower.includes('forbes') ||
      urlLower.includes('reuters') || urlLower.includes('cnbc') || urlLower.includes('economist') ||
      urlLower.includes('financial') ||
      nameLower.includes('business') || nameLower.includes('finance') || nameLower.includes('market') ||
      nameLower.includes('financial')) {
    return 'Business';
  }

  // Science
  if (urlLower.includes('nature') || urlLower.includes('science') || urlLower.includes('newscientist') ||
      urlLower.includes('phys.org') || urlLower.includes('sciencedaily') || urlLower.includes('ancient') ||
      nameLower.includes('science') || nameLower.includes('research') || nameLower.includes('ancient')) {
    return 'Science';
  }

  // World News
  if (urlLower.includes('bbc') || urlLower.includes('cnn') || urlLower.includes('nytimes') ||
      urlLower.includes('guardian') || urlLower.includes('washingtonpost') || urlLower.includes('apnews') ||
      nameLower.includes('news') || nameLower.includes('world') || nameLower.includes('global')) {
    return 'World News';
  }

  // Sports & Automotive
  if (urlLower.includes('espn') || urlLower.includes('sports') || urlLower.includes('athletic') ||
      urlLower.includes('atp') || urlLower.includes('topgear') || urlLower.includes('jalopnik') ||
      urlLower.includes('caranddriver') ||
      nameLower.includes('sport') || nameLower.includes('football') || nameLower.includes('basketball') ||
      nameLower.includes('atp') || nameLower.includes('gear') || nameLower.includes('car') ||
      nameLower.includes('driver')) {
    return 'Sports';
  }

  // Entertainment & Lifestyle
  if (urlLower.includes('variety') || urlLower.includes('hollywood') || urlLower.includes('entertainment') ||
      urlLower.includes('theonion') || urlLower.includes('vogue') || urlLower.includes('grazia') ||
      urlLower.includes('harpersbazaar') || urlLower.includes('bonappetit') ||
      nameLower.includes('movie') || nameLower.includes('entertainment') || nameLower.includes('celebrity') ||
      nameLower.includes('onion') || nameLower.includes('vogue') || nameLower.includes('fashion') ||
      nameLower.includes('bazaar') || nameLower.includes('appétit') || nameLower.includes('appetit')) {
    return 'Entertainment';
  }

  // Health
  if (urlLower.includes('health') || urlLower.includes('medical') || urlLower.includes('webmd') ||
      nameLower.includes('health') || nameLower.includes('medical') || nameLower.includes('wellness')) {
    return 'Health';
  }

  return null;
}

backfillFolderNames().catch(console.error);
