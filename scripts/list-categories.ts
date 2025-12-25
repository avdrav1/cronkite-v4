import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('recommended_feeds')
    .select('category');
  
  if (error) { console.error(error); return; }
  
  const categories = [...new Set(data.map(f => f.category))].sort();
  console.log(`Categories in production (${categories.length}):\n`);
  categories.forEach(c => console.log(`  • ${c}`));
  
  // Count per category
  console.log('\nFeeds per category:');
  const counts: Record<string, number> = {};
  data.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1; });
  Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
}
main();
