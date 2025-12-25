import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function mergeCategory(from: string, to: string) {
  const { data: feeds } = await supabase
    .from('recommended_feeds')
    .select('id, name')
    .eq('category', from);

  if (!feeds?.length) {
    console.log(`⏭️  ${from} → ${to}: No feeds found`);
    return 0;
  }

  const { error } = await supabase
    .from('recommended_feeds')
    .update({ category: to })
    .eq('category', from);

  if (error) {
    console.log(`❌ ${from} → ${to}: ${error.message}`);
    return 0;
  }

  console.log(`✅ ${from} → ${to}: ${feeds.length} feeds merged`);
  return feeds.length;
}

async function main() {
  console.log('🔀 Merging Categories\n');

  // Additional consolidation merges
  await mergeCategory('Space', 'Science');
  await mergeCategory('Environment', 'Science');
  await mergeCategory('Startups', 'Business');
  await mergeCategory('DIY', 'Lifestyle');
  await mergeCategory('Interior', 'Lifestyle');
  await mergeCategory('Android', 'Technology');
  await mergeCategory('Apple', 'Technology');

  // Show updated category list
  const { data: allFeeds } = await supabase
    .from('recommended_feeds')
    .select('category');

  const counts: Record<string, number> = {};
  allFeeds?.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1; });
  
  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  
  console.log('\n📊 All categories (sorted by count):');
  sorted.forEach(([cat, count]) => {
    console.log(`  ${count.toString().padStart(2)} - ${cat}`);
  });

  console.log(`\n📰 Total categories: ${sorted.length}`);
}

main();
