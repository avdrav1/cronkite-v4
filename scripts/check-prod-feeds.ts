import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load production env
dotenv.config({ path: '.env.production' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { count: recCount } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });
  
  console.log('Production recommended_feeds count:', recCount);
  
  // Get category breakdown
  const { data: categories } = await supabase
    .from('recommended_feeds')
    .select('category');
  
  if (categories) {
    const catCounts: Record<string, number> = {};
    for (const c of categories) {
      catCounts[c.category] = (catCounts[c.category] || 0) + 1;
    }
    console.log('\nBy category:');
    Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
  }
}
main();
