import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Find Serious Eats
  const { data: serious } = await supabase
    .from('recommended_feeds')
    .select('id, name, url')
    .ilike('name', '%serious%');
  console.log('Serious Eats:', serious);
  
  // Find WSJ
  const { data: wsj } = await supabase
    .from('recommended_feeds')
    .select('id, name, url')
    .ilike('name', '%wall street%');
  console.log('WSJ:', wsj);
  
  // Remove them if found
  if (serious && serious.length > 0) {
    await supabase.from('recommended_feeds').delete().eq('id', serious[0].id);
    console.log('Removed Serious Eats');
  }
  
  if (wsj && wsj.length > 0) {
    await supabase.from('recommended_feeds').delete().eq('id', wsj[0].id);
    console.log('Removed WSJ');
  }
  
  // Final count
  const { count } = await supabase
    .from('recommended_feeds')
    .select('*', { count: 'exact', head: true });
  console.log('Final count:', count);
}
main();
