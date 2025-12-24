import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const now = new Date().toISOString();
  console.log('Testing exact query from getClusters...');
  console.log('Current time:', now);
  
  // This is the exact query from getClusters
  const { data, error } = await supabase
    .from('clusters')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Found clusters:', data?.length || 0);
    data?.forEach((c: any) => console.log('  -', c.title, '| relevance:', c.relevance_score));
  }
  
  // Check schema
  if (data && data.length > 0) {
    console.log('\nCluster columns:', Object.keys(data[0]));
    console.log('Has user_id?', 'user_id' in data[0]);
  }
}

testQuery();
