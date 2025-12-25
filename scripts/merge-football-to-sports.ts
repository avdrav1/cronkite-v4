import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('🏈 Merging Football category into Sports...\n');

  // Find all feeds with category "Football"
  const { data: footballFeeds, error: fetchError } = await supabase
    .from('recommended_feeds')
    .select('id, name, category')
    .eq('category', 'Football');

  if (fetchError) {
    console.error('Error fetching:', fetchError.message);
    return;
  }

  console.log(`Found ${footballFeeds?.length || 0} feeds in Football category:\n`);
  footballFeeds?.forEach(f => console.log(`  • ${f.name}`));

  // Update them to Sports
  const { error: updateError, count } = await supabase
    .from('recommended_feeds')
    .update({ category: 'Sports' })
    .eq('category', 'Football');

  if (updateError) {
    console.error('Error updating:', updateError.message);
    return;
  }

  console.log(`\n✅ Merged ${footballFeeds?.length} feeds from Football → Sports`);

  // Show updated category counts (bottom 15)
  const { data: allFeeds } = await supabase
    .from('recommended_feeds')
    .select('category');

  const counts: Record<string, number> = {};
  allFeeds?.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1; });
  
  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  
  console.log('\n📊 Categories with fewest feeds (bottom 15):');
  sorted.slice(0, 15).forEach(([cat, count]) => {
    console.log(`  ${count.toString().padStart(2)} - ${cat}`);
  });

  console.log(`\n📰 Total categories: ${sorted.length}`);
}

main();
